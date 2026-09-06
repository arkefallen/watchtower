// src/server/trpc/routers/self.ts
import { router, publicProcedure } from "@/server/trpc/trpc";
import { z } from "zod";
import { prisma as defaultPrisma } from "@/server/db/client";
import {
  addTrade,
  updateTrade,
  listTrades,
  ManualTradeSchema,
  UpdateTradeSchema,
} from "@/server/services/self/trades";
import { computeEdgeDecay } from "@/server/services/self/decay";
import { computeSelfDashboard } from "@/server/services/self/dashboard";
import { getTradeComparisonList } from "@/server/services/self/comparison";
import { linkTradeToSignal } from "@/server/services/self/link";
import { getSelfWallets, setSelfWallet } from "@/server/services/wallet/self";
import type { Address, ChainSlug } from "@/lib/chains/types";
import { prismaToChainSlug } from "@/server/services/wallet/normalize";

export const selfRouter = router({
  /** Returns list of registered self wallets */
  wallets: publicProcedure.query(async ({ ctx }) => {
    const prisma = ctx.prisma ?? defaultPrisma;
    const wallets = await getSelfWallets(prisma);
    return wallets.map((w) => ({
      address: w.address,
      chain: prismaToChainSlug(w.chain),
      label: w.label,
      ensName: w.ensName,
      isSelf: w.isSelf,
      syncState: w.syncState
        ? {
            status: w.syncState.status,
            lastSyncedAt: w.syncState.lastSyncedAt,
          }
        : null,
      _count: w._count,
    }));
  }),

  /** Toggles isSelf flag on a wallet */
  toggleSelf: publicProcedure
    .input(
      z.object({
        address: z.string(),
        chain: z.enum(["base", "bsc", "robinhood"]),
        isSelf: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const prisma = ctx.prisma ?? defaultPrisma;
      const updated = await setSelfWallet(input.address, input.chain, input.isSelf, prisma);
      return {
        address: updated.address,
        chain: prismaToChainSlug(updated.chain),
        isSelf: updated.isSelf,
      };
    }),

  /** List user trades with cursor pagination (FR-6.3, NFR-7) */
  trades: publicProcedure
    .input(
      z.object({
        walletAddress: z.string().optional(),
        chain: z.enum(["base", "bsc", "robinhood"]).optional(),
        source: z.enum(["AUTO", "MANUAL"]).optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const prisma = ctx.prisma ?? defaultPrisma;
      const { trades, nextCursor } = await listTrades(input, prisma);
      return {
        rows: trades.map((t) => ({
          id: t.id,
          ownWalletAddress: t.ownWalletAddress,
          ownChain: prismaToChainSlug(t.ownChain),
          tokenAddress: t.tokenAddress,
          tokenChain: prismaToChainSlug(t.tokenChain),
          tokenSymbol: t.token?.symbol || null,
          side: t.side,
          amountUsd: t.amountUsd ? t.amountUsd.toString() : "0",
          entryAt: t.entryAt,
          exitAt: t.exitAt,
          roiPct: t.roiPct ? t.roiPct.toString() : null,
          followedWalletAddress: t.followedWalletAddress,
          followedWalletChain: t.followedWalletChain ? prismaToChainSlug(t.followedWalletChain) : null,
          followedWalletLabel: t.followedWallet?.label || null,
          lagMinutes: t.lagMinutes,
          lagMcDelta: t.lagMcDelta ? t.lagMcDelta.toString() : null,
          walletRoiPct: t.walletRoiPct ? t.walletRoiPct.toString() : null,
          lagBucket: t.lagBucket,
          thesis: t.thesis,
          source: t.source,
          isLinkPinned: t.isLinkPinned,
          entryMarketCap: t.entryMarketCap ? t.entryMarketCap.toString() : null,
          createdAt: t.createdAt,
        })),
        nextCursor,
      };
    }),

  /** Add manual trade with required thesis (FR-6.3) */
  addTrade: publicProcedure
    .input(ManualTradeSchema)
    .mutation(async ({ ctx, input }) => {
      const prisma = ctx.prisma ?? defaultPrisma;
      const trade = await addTrade(input, prisma);
      return trade;
    }),

  /** Update trade (preserves pinned link, validates thesis if manual) */
  updateTrade: publicProcedure
    .input(UpdateTradeSchema)
    .mutation(async ({ ctx, input }) => {
      const prisma = ctx.prisma ?? defaultPrisma;
      const updated = await updateTrade(input, prisma);
      return updated;
    }),

  /** Explicitly re-link a trade to a signal */
  linkTrade: publicProcedure
    .input(
      z.object({
        tradeId: z.string(),
        lookbackMs: z.number().optional(),
        requireGraded: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const prisma = ctx.prisma ?? defaultPrisma;
      const trade = await prisma.userTrade.findUnique({
        where: { id: input.tradeId },
      });
      if (!trade) throw new Error("Trade not found");

      const res = await linkTradeToSignal(
        {
          trade: {
            id: trade.id,
            ownWallet: {
              address: trade.ownWalletAddress as Address,
              chain: prismaToChainSlug(trade.ownChain),
            },
            tokenAddress: trade.tokenAddress as Address,
            tokenChain: prismaToChainSlug(trade.tokenChain),
            side: trade.side as any,
            entryAt: trade.entryAt,
            amountUsd: trade.amountUsd ? trade.amountUsd.toString() : "0",
            entryMarketCap: trade.entryMarketCap ? trade.entryMarketCap.toString() : null,
          },
          lookbackMs: input.lookbackMs,
          requireGraded: input.requireGraded,
        },
        prisma
      );

      return res;
    }),

  /** Edge decay curve per followed wallet (FR-6.4) */
  decay: publicProcedure
    .input(
      z.object({
        followedWallet: z
          .object({
            address: z.string(),
            chain: z.enum(["base", "bsc", "robinhood"]),
          })
          .optional(),
        minSample: z.number().default(5),
      })
    )
    .query(async ({ ctx, input }) => {
      const prisma = ctx.prisma ?? defaultPrisma;
      return computeEdgeDecay(input, prisma);
    }),

  /** Personal performance dashboard (FR-6.5) */
  dashboard: publicProcedure
    .input(
      z.object({
        walletAddress: z.string().optional(),
        asOf: z.coerce.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const prisma = ctx.prisma ?? defaultPrisma;
      return computeSelfDashboard(input, prisma);
    }),

  /** Comparison view with ROI verdicts (FR-6.6) */
  comparison: publicProcedure
    .input(
      z.object({
        walletAddress: z.string().optional(),
        followedWalletAddress: z.string().optional(),
        tokenAddress: z.string().optional(),
        sortBy: z.enum(["timestamp", "lagMinutes", "roiGap", "amountUsd"]).default("timestamp"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
        limit: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const prisma = ctx.prisma ?? defaultPrisma;
      return getTradeComparisonList(input, prisma);
    }),
});
