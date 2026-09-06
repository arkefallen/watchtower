// src/server/trpc/routers/settings.ts
import { z } from "zod";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { publicProcedure, router } from "@/server/trpc/trpc";
import { loadSettings, updateSettings } from "@/server/services/settings";
import {
  alertThresholdsSchema,
  type SettingsSnapshot,
} from "@/lib/settings-schema";
import { runBackup } from "../../../../scripts/backup";

const stableTokenItemSchema = z.object({
  address: z.string().regex(/^0x[a-f0-9]{40}$/, "must be a lowercase EVM address"),
  symbol: z.string().trim().min(1),
}).strict();

const settingsUpdateInputSchema = z.object({
  alertThresholds: alertThresholdsSchema.partial().optional(),
  stableTokens: z.object({
    base: z.array(stableTokenItemSchema).optional(),
    bsc: z.array(stableTokenItemSchema).optional(),
    robinhood: z.array(stableTokenItemSchema).optional(),
  }).partial().optional(),
  coEntryWindows: z.array(z.enum(["1h", "6h", "24h", "48h"])).min(1).optional(),
  defaultCoEntryWindow: z.enum(["1h", "6h", "24h", "48h"]).optional(),
  coAccumulationMinWallets: z.number().int().min(1).optional(),
  syncCadenceMinutes: z.number().int().min(1).optional(),
  radarCadenceMinutes: z.number().int().min(1).optional(),
  minEdgeUsd: z.number().finite().nonnegative().optional(),
  maxTraceDepth: z.number().int().min(1).max(6).optional(),
  profitSinkRatioPct: z.number().finite().min(0).max(100).optional(),
  gradedDefinition: z.enum(["ANY_TAG_OR_COMPUTED", "EDGE_TAG_ONLY"]).optional(),
  telegram: z.object({
    enabled: z.boolean().optional(),
    hasCredentials: z.boolean().optional(),
  }).partial().optional(),
  timezone: z.string().trim().min(1).optional(),
  defaultChain: z.enum(["base", "bsc", "robinhood"]).optional(),
  quota: z.object({
    etherscanDailyLimit: z.number().int().min(1).optional(),
    reservedForInteractivePct: z.number().finite().min(0).max(100).optional(),
  }).partial().optional(),
  priceCacheTtlSeconds: z.number().int().min(1).optional(),
});

export const settingsRouter = router({
  get: publicProcedure.query(async (): Promise<SettingsSnapshot> => {
    return loadSettings();
  }),

  update: publicProcedure
    .input(settingsUpdateInputSchema)
    .mutation(async ({ input, ctx }): Promise<SettingsSnapshot> => {
      const updated = await updateSettings(input);

      // If radarCadenceMinutes was modified and radar queue is available, re-register repeatable job
      if (input.radarCadenceMinutes && ctx.queues?.radar) {
        try {
          const queue = ctx.queues.radar;
          if (typeof queue.getRepeatableJobs === "function") {
            const repeatableJobs = await queue.getRepeatableJobs();
            for (const job of repeatableJobs) {
              if (job.name === "radar.evaluate") {
                await queue.removeRepeatableByKey(job.key);
              }
            }
            await queue.add(
              "radar.evaluate",
              {},
              {
                repeat: { every: input.radarCadenceMinutes * 60 * 1000 },
                jobId: "radar.evaluate.repeatable",
              }
            );
          }
        } catch (err) {
          console.warn("Failed to re-register radar repeatable job:", err);
        }
      }

      return updated;
    }),

  testTelegram: publicProcedure
    .input(
      z.object({
        botToken: z.string().trim().min(1, "Bot token is required"),
        chatId: z.string().trim().min(1, "Chat ID is required"),
      })
    )
    .mutation(async ({ input }): Promise<{ success: boolean; message: string }> => {
      try {
        const url = `https://api.telegram.org/bot${encodeURIComponent(input.botToken)}/sendMessage`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: input.chatId,
            text: "Watchtower Alert Test",
          }),
        });

        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          description?: string;
        } | null;

        if (res.ok && data?.ok) {
          return {
            success: true,
            message: "Watchtower Alert Test delivered successfully",
          };
        }

        return {
          success: false,
          message: data?.description ?? `Telegram API error: HTTP ${res.status} ${res.statusText}`,
        };
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : "Failed to contact Telegram API",
        };
      }
    }),

  runBackup: publicProcedure.mutation(
    async (): Promise<{ success: boolean; message: string; timestamp: string }> => {
      const now = new Date();
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        return {
          success: false,
          message: "DATABASE_URL environment variable is missing",
          timestamp: now.toISOString(),
        };
      }

      try {
        const output = await runBackup({ databaseUrl, now });
        return {
          success: true,
          message: `Backup created successfully at ${output}`,
          timestamp: now.toISOString(),
        };
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : "Backup execution failed",
          timestamp: now.toISOString(),
        };
      }
    }
  ),

  backupStatus: publicProcedure.query(
    async (): Promise<{
      lastBackupAt: string | null;
      daysAgo: number | null;
      isHealthy: boolean;
      totalBackups: number;
    }> => {
      try {
        const backupDir = join(process.cwd(), "backups");
        const files = await readdir(backupDir).catch(() => []);
        const jsonFiles = files.filter((f) => f.endsWith(".sql.gz.json"));

        if (jsonFiles.length === 0) {
          return {
            lastBackupAt: null,
            daysAgo: null,
            isHealthy: false,
            totalBackups: 0,
          };
        }

        let latestTimestamp: Date | null = null;

        for (const file of jsonFiles) {
          try {
            const content = await readFile(join(backupDir, file), "utf8");
            const parsed = JSON.parse(content) as { createdAt?: string };
            if (parsed.createdAt) {
              const d = new Date(parsed.createdAt);
              if (!latestTimestamp || d.getTime() > latestTimestamp.getTime()) {
                latestTimestamp = d;
              }
            }
          } catch {
            // Ignore malformed individual metadata
          }
        }

        if (!latestTimestamp) {
          return {
            lastBackupAt: null,
            daysAgo: null,
            isHealthy: false,
            totalBackups: jsonFiles.length,
          };
        }

        const now = Date.now();
        const diffMs = now - latestTimestamp.getTime();
        const daysAgo = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        const isHealthy = daysAgo <= 7;

        return {
          lastBackupAt: latestTimestamp.toISOString(),
          daysAgo,
          isHealthy,
          totalBackups: jsonFiles.length,
        };
      } catch {
        return {
          lastBackupAt: null,
          daysAgo: null,
          isHealthy: false,
          totalBackups: 0,
        };
      }
    }
  ),

  pruneTokenHistory: publicProcedure
    .input(
      z.object({
        tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM token address"),
        chain: z.enum(["base", "bsc", "robinhood"]),
        confirmation: z.literal("PRUNE"),
      })
    )
    .mutation(
      async ({
        input,
        ctx,
      }): Promise<{
        success: boolean;
        message: string;
        rowsDeleted: Record<string, number>;
        timestamp: string;
      }> => {
        const timestamp = new Date().toISOString();
        const chainEnum = input.chain.toUpperCase() as "BASE" | "BSC" | "ROBINHOOD";
        const tokenAddr = input.tokenAddress.toLowerCase();
        const rowsDeleted: Record<string, number> = {
          transactions: 0,
          positions: 0,
        };

        if (ctx.prisma) {
          const [txs, positions] = await Promise.all([
            ctx.prisma.transaction.deleteMany({
              where: { chain: chainEnum, tokenAddress: tokenAddr },
            }),
            ctx.prisma.position.deleteMany({
              where: { walletChain: chainEnum, tokenAddress: tokenAddr },
            }),
          ]);
          rowsDeleted.transactions = txs.count;
          rowsDeleted.positions = positions.count;
        }

        const totalDeleted = rowsDeleted.transactions + rowsDeleted.positions;
        return {
          success: true,
          message: `Pruned ${totalDeleted} record(s) for token ${tokenAddr} on ${input.chain.toUpperCase()}`,
          rowsDeleted,
          timestamp,
        };
      }
    ),
});
