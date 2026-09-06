import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { prisma as dbClient } from "@/server/db/client";
import { createWalletRegistry } from "@/server/services/wallet/registry";
import { isEnsName, resolveWalletInput } from "@/server/services/wallet/ens";
import { processImportBatch } from "@/server/services/wallet/import";
import { computeParking } from "@/server/services/funding/parking";
import { updateWalletTags } from "@/server/services/wallet/tags";
import { loadSettings } from "@/server/services/settings";
import type { Address } from "@/lib/chains/types";

const chainSchema = z.enum(["base", "bsc", "robinhood"]);
const edgeSchema = z.enum(["SMART", "INSIDER", "EARLY", "BOT", "KOL", "DEGEN", "FRESH", "DEV"]);
const styleSchema = z.enum(["SNIPER", "JEET", "RIDER", "SWING", "DIAMOND"]);
const sizeSchema = z.enum(["W", "M", "S"]);
const watchPrioritySchema = z.enum(["HIGH", "NORMAL"]);

export const walletRouter = router({
  resolveEns: publicProcedure
    .input(z.object({ nameOrAddress: z.string().min(1) }))
    .mutation(async ({ input }) => {
      return resolveWalletInput({
        addressOrName: input.nameOrAddress,
        chain: "base",
      });
    }),

  add: publicProcedure
    .input(
      z.object({
        address: z.string().min(1),
        chain: chainSchema,
        label: z.string().optional(),
        ensName: z.string().optional(),
        edge: edgeSchema.optional(),
        style: styleSchema.optional(),
        size: sizeSchema.optional(),
        notes: z.string().optional(),
        isBlacklisted: z.boolean().optional(),
        isSelf: z.boolean().optional(),
        watchPriority: watchPrioritySchema.optional(),
        forceFullResync: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let finalAddress = input.address;
      let finalEnsName = input.ensName;

      if (isEnsName(input.address) || !input.ensName) {
        const resolved = await resolveWalletInput({
          addressOrName: input.address,
          chain: input.chain,
        });
        finalAddress = resolved.address;
        if (!finalEnsName && resolved.ensName) {
          finalEnsName = resolved.ensName;
        }
      }

      const registry = createWalletRegistry({
        prisma: ctx.prisma ?? dbClient,
        queues: ctx.queues,
      });
      return registry.addWallet({
        ...input,
        address: finalAddress,
        ensName: finalEnsName,
      });
    }),

  addBatch: publicProcedure
    .input(
      z.object({
        rawText: z.string().min(1),
        defaultChain: chainSchema.optional().default("base"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return processImportBatch(input.rawText, {
        prisma: ctx.prisma ?? dbClient,
        defaultChain: input.defaultChain,
        queues: ctx.queues,
      });
    }),

  get: publicProcedure
    .input(
      z.object({
        address: z.string().min(1),
        chain: chainSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const registry = createWalletRegistry({
        prisma: ctx.prisma ?? dbClient,
        queues: ctx.queues,
      });
      return registry.getWallet(input);
    }),

  update: publicProcedure
    .input(
      z.object({
        address: z.string().min(1),
        chain: chainSchema,
        label: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        edge: edgeSchema.nullable().optional(),
        style: styleSchema.nullable().optional(),
        size: sizeSchema.nullable().optional(),
        isBlacklisted: z.boolean().optional(),
        isSelf: z.boolean().optional(),
        watchPriority: watchPrioritySchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const registry = createWalletRegistry({
        prisma: ctx.prisma ?? dbClient,
        queues: ctx.queues,
      });
      return registry.updateWallet(input);
    }),

  delete: publicProcedure
    .input(
      z.object({
        address: z.string().min(1),
        chain: chainSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const registry = createWalletRegistry({
        prisma: ctx.prisma ?? dbClient,
        queues: ctx.queues,
      });
      return registry.deleteWallet(input);
    }),

  list: publicProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          chain: chainSchema.optional(),
          edge: edgeSchema.optional(),
          style: styleSchema.optional(),
          size: sizeSchema.optional(),
          isBlacklisted: z.boolean().optional(),
          isSelf: z.boolean().optional(),
          watchPriority: watchPrioritySchema.optional(),
          clusterId: z.string().optional(),
          cursor: z
            .object({
              address: z.string(),
              chain: z.string(),
            })
            .optional(),
          take: z.number().int().min(1).max(200).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const registry = createWalletRegistry({
        prisma: ctx.prisma ?? dbClient,
        queues: ctx.queues,
      });
      return registry.listWallets(input ?? {});
    }),

  parking: publicProcedure
    .input(
      z.object({
        address: z.string().min(1),
        chain: chainSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const settings = await loadSettings();
      return computeParking(input.address.toLowerCase() as Address, input.chain, {
        prisma: ctx.prisma ?? dbClient,
        settings,
      });
    }),

  updateTags: publicProcedure
    .input(
      z.object({
        address: z.string().min(1),
        chain: chainSchema,
        label: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        edge: edgeSchema.nullable().optional(),
        style: styleSchema.nullable().optional(),
        size: sizeSchema.nullable().optional(),
        isBlacklisted: z.boolean().optional(),
        isSelf: z.boolean().optional(),
        watchPriority: watchPrioritySchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return updateWalletTags(ctx.prisma ?? dbClient, input);
    }),

  resync: publicProcedure
    .input(
      z.object({
        address: z.string().min(1),
        chain: chainSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const registry = createWalletRegistry({
        prisma: ctx.prisma ?? dbClient,
        queues: ctx.queues,
      });
      return registry.addWallet({
        address: input.address,
        chain: input.chain,
        forceFullResync: true,
      });
    }),

  setEntityLabel: publicProcedure
    .input(
      z.object({
        address: z.string().min(1),
        chain: chainSchema,
        name: z.string().min(1),
        kind: z.enum(["CEX", "BRIDGE", "ROUTER", "CONTRACT", "HUMAN"]),
        isTerminal: z.boolean(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const prisma = ctx.prisma ?? dbClient;
      const { createEntityService } = await import("@/server/services/entity");
      const service = createEntityService({ entityLabel: prisma.entityLabel });
      return service.upsertUserLabel(input);
    }),

  getEntityLabel: publicProcedure
    .input(
      z.object({
        address: z.string().min(1),
        chain: chainSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const prisma = ctx.prisma ?? dbClient;
      const { createEntityService } = await import("@/server/services/entity");
      const service = createEntityService({ entityLabel: prisma.entityLabel });
      return service.lookup(input.address, input.chain);
    }),

  grade: publicProcedure
    .input(
      z.object({
        address: z.string().min(1),
        chain: chainSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const { computeAndPersistWalletGrade } = await import("@/server/services/wallet/grade");
      return computeAndPersistWalletGrade(
        {
          walletAddress: input.address,
          chain: input.chain,
        },
        ctx.prisma ?? dbClient
      );
    }),

  recomputeGrade: publicProcedure
    .input(
      z.object({
        address: z.string().min(1),
        chain: chainSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { computeAndPersistWalletGrade } = await import("@/server/services/wallet/grade");
      return computeAndPersistWalletGrade(
        {
          walletAddress: input.address,
          chain: input.chain,
        },
        ctx.prisma ?? dbClient
      );
    }),
});

