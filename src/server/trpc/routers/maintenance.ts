// src/server/trpc/routers/maintenance.ts
import { z } from "zod";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { router, publicProcedure } from "../trpc";
import { prisma as dbClient } from "@/server/db/client";
import { pruneTokenHistory } from "@/server/services/maintenance/prune";
import { processDeriveRebuild } from "@/server/workers/processors/derive-rebuild";

const chainSchema = z.enum(["base", "bsc", "robinhood"]);

export const maintenanceRouter = router({
  pruneToken: publicProcedure
    .input(
      z.object({
        tokenAddress: z.string().min(1),
        chain: chainSchema,
        confirmation: z.literal("PRUNE"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return pruneTokenHistory(
        {
          tokenAddress: input.tokenAddress,
          chain: input.chain,
          confirmation: input.confirmation,
        },
        ctx.prisma ?? dbClient
      );
    }),

  backupInfo: publicProcedure.query(async (): Promise<{
    lastBackupAt: string | null;
    daysAgo: number | null;
    isHealthy: boolean;
    needsReminder: boolean;
    totalBackups: number;
    manualCommand: string;
  }> => {
    const manualCommand = "npm run backup";
    try {
      const backupDir = join(process.cwd(), "backups");
      const files = await readdir(backupDir).catch(() => []);
      const jsonFiles = files.filter((f) => f.endsWith(".sql.gz.json"));

      if (jsonFiles.length === 0) {
        return {
          lastBackupAt: null,
          daysAgo: null,
          isHealthy: false,
          needsReminder: true,
          totalBackups: 0,
          manualCommand,
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
          // ignore malformed file
        }
      }

      if (!latestTimestamp) {
        return {
          lastBackupAt: null,
          daysAgo: null,
          isHealthy: false,
          needsReminder: true,
          totalBackups: jsonFiles.length,
          manualCommand,
        };
      }

      const diffMs = Date.now() - latestTimestamp.getTime();
      const daysAgo = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      const isHealthy = daysAgo <= 7;
      const needsReminder = !isHealthy;

      return {
        lastBackupAt: latestTimestamp.toISOString(),
        daysAgo,
        isHealthy,
        needsReminder,
        totalBackups: jsonFiles.length,
        manualCommand,
      };
    } catch {
      return {
        lastBackupAt: null,
        daysAgo: null,
        isHealthy: false,
        needsReminder: true,
        totalBackups: 0,
        manualCommand,
      };
    }
  }),

  quotaReport: publicProcedure.query(async ({ ctx }) => {
    if (ctx.health && typeof ctx.health.quotas === "function") {
      try {
        const providers = await ctx.health.quotas();
        return { providers };
      } catch {
        return { providers: [] };
      }
    }
    return { providers: [] };
  }),

  rebuildDerivations: publicProcedure
    .input(
      z.object({
        target: z.enum(["INTERACTION_EDGES", "WALLET_RELATIONS", "ALL"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const prisma = ctx.prisma ?? dbClient;
      return processDeriveRebuild(prisma, { target: input.target });
    }),
});
