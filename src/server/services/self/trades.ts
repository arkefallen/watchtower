// src/server/services/self/trades.ts
import { prisma as defaultPrisma } from "@/server/db/client";
import type { PrismaClient, TradeSide, TradeSource } from "@/generated/prisma/client";
import { chainSlugToPrisma } from "@/server/services/wallet/normalize";
import type { Address, ChainSlug } from "@/lib/chains/types";
import { z } from "zod";
import { linkTradeToSignal } from "./link";
import { getLagBucket, getWalletTokenRoi } from "./roi";

/**
 * Zod schema enforcing thesis requirements (FR-6.3).
 * Non-empty and non-whitespace string required for MANUAL trades.
 */
export const ManualTradeSchema = z
  .object({
    ownWalletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid wallet address"),
    ownChain: z.enum(["base", "bsc", "robinhood"]),
    tokenAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid token address"),
    tokenChain: z.enum(["base", "bsc", "robinhood"]),
    side: z.enum(["BUY", "SELL"]),
    amountUsd: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Amount USD must be a positive number",
    }),
    entryAt: z.coerce.date(),
    exitAt: z.coerce.date().optional(),
    roiPct: z.string().optional(),
    followedWalletAddress: z
      .string()
      .regex(/^0x[0-9a-fA-F]{40}$/, "Invalid followed wallet address")
      .optional()
      .nullable(),
    followedWalletChain: z.enum(["base", "bsc", "robinhood"]).optional().nullable(),
    thesis: z.string().optional().nullable(),
    source: z.enum(["AUTO", "MANUAL"]).default("MANUAL"),
    entryMarketCap: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.source === "MANUAL") {
      if (!data.thesis || data.thesis.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Thesis is required for manual trades",
          path: ["thesis"],
        });
      }
    }
  });

export type AddTradeInput = z.infer<typeof ManualTradeSchema>;

export async function addTrade(
  input: AddTradeInput,
  injectedPrisma: PrismaClient = defaultPrisma
) {
  // Validate schema
  const parsed = ManualTradeSchema.parse(input);
  const prisma = injectedPrisma;

  const normOwnAddress = parsed.ownWalletAddress.toLowerCase();
  const prismaOwnChain = chainSlugToPrisma(parsed.ownChain);
  const normTokenAddress = parsed.tokenAddress.toLowerCase();
  const prismaTokenChain = chainSlugToPrisma(parsed.tokenChain);

  // Ensure token exists in Token table
  await prisma.token.upsert({
    where: {
      address_chain: {
        address: normTokenAddress,
        chain: prismaTokenChain,
      },
    },
    create: {
      address: normTokenAddress,
      chain: prismaTokenChain,
      symbol: "TOKEN",
    },
    update: {},
  });

  // Ensure own wallet exists
  await prisma.wallet.upsert({
    where: {
      address_chain: {
        address: normOwnAddress,
        chain: prismaOwnChain,
      },
    },
    create: {
      address: normOwnAddress,
      chain: prismaOwnChain,
      isSelf: true,
    },
    update: {
      isSelf: true,
    },
  });

  const hasExplicitFollowed = Boolean(
    parsed.followedWalletAddress && parsed.followedWalletAddress.trim().length > 0
  );

  let followedAddress: string | null = null;
  let followedChain = null;
  let isLinkPinned = false;
  let lagMinutes: number | null = null;
  let lagBucket = null;
  let walletRoiPct: string | null = null;

  if (hasExplicitFollowed) {
    followedAddress = parsed.followedWalletAddress!.toLowerCase();
    followedChain = chainSlugToPrisma(parsed.followedWalletChain || parsed.ownChain);
    isLinkPinned = true; // DoD: explicit followedWallet sets isLinkPinned

    // Ensure followed wallet exists
    await prisma.wallet.upsert({
      where: {
        address_chain: {
          address: followedAddress,
          chain: followedChain,
        },
      },
      create: {
        address: followedAddress,
        chain: followedChain,
      },
      update: {},
    });

    // Query followed wallet's prior BUY movement to calculate lag if available
    const priorMovement = await prisma.movementEvent.findFirst({
      where: {
        walletAddress: followedAddress,
        walletChain: followedChain,
        tokenAddress: normTokenAddress,
        tokenChain: prismaTokenChain,
        kind: "BUY",
        timestamp: { lte: parsed.entryAt },
      },
      orderBy: { timestamp: "desc" },
    });

    if (priorMovement) {
      lagMinutes = Math.max(
        0,
        Math.round((parsed.entryAt.getTime() - priorMovement.timestamp.getTime()) / 60000)
      );
      lagBucket = getLagBucket(lagMinutes);
    }

    const followedRoi = await getWalletTokenRoi(
      prisma,
      followedAddress,
      parsed.followedWalletChain || parsed.ownChain,
      normTokenAddress
    );
    walletRoiPct = followedRoi?.roiPct ?? null;
  }

  const trade = await prisma.userTrade.create({
    data: {
      ownWalletAddress: normOwnAddress,
      ownChain: prismaOwnChain,
      tokenAddress: normTokenAddress,
      tokenChain: prismaTokenChain,
      side: parsed.side as TradeSide,
      amountUsd: parsed.amountUsd,
      entryAt: parsed.entryAt,
      exitAt: parsed.exitAt,
      roiPct: parsed.roiPct ? parsed.roiPct : null,
      followedWalletAddress: followedAddress,
      followedWalletChain: followedChain,
      lagMinutes,
      lagBucket,
      walletRoiPct: walletRoiPct ? walletRoiPct : null,
      thesis: parsed.thesis ? parsed.thesis.trim() : null,
      source: parsed.source as TradeSource,
      isLinkPinned,
      entryMarketCap: parsed.entryMarketCap ? parsed.entryMarketCap : null,
      linkedAt: isLinkPinned ? new Date() : null,
    },
  });

  // If trade is BUY and not explicitly pinned, trigger auto-linking
  if (!isLinkPinned && parsed.side === "BUY") {
    await linkTradeToSignal(
      {
        trade: {
          id: trade.id,
          ownWallet: { address: normOwnAddress as Address, chain: parsed.ownChain },
          tokenAddress: normTokenAddress as Address,
          tokenChain: parsed.tokenChain,
          side: "BUY",
          entryAt: parsed.entryAt,
          amountUsd: parsed.amountUsd,
          entryMarketCap: parsed.entryMarketCap || null,
        },
      },
      prisma
    );
  }

  return prisma.userTrade.findUnique({
    where: { id: trade.id },
    include: {
      ownWallet: true,
      followedWallet: true,
      token: true,
    },
  });
}

export const UpdateTradeSchema = z.object({
  id: z.string(),
  thesis: z.string().optional(),
  roiPct: z.string().optional(),
  exitAt: z.coerce.date().optional(),
  followedWalletAddress: z.string().optional().nullable(),
  followedWalletChain: z.enum(["base", "bsc", "robinhood"]).optional().nullable(),
});

export async function updateTrade(
  input: z.infer<typeof UpdateTradeSchema>,
  injectedPrisma: PrismaClient = defaultPrisma
) {
  const prisma = injectedPrisma;
  const existing = await prisma.userTrade.findUnique({
    where: { id: input.id },
  });

  if (!existing) {
    throw new Error(`Trade not found: ${input.id}`);
  }

  // Validate thesis if MANUAL
  if (existing.source === "MANUAL" && input.thesis !== undefined) {
    if (!input.thesis || input.thesis.trim().length === 0) {
      throw new Error("Thesis is required for manual trades");
    }
  }

  let followedAddress = existing.followedWalletAddress;
  let followedChain = existing.followedWalletChain;
  let isLinkPinned = existing.isLinkPinned;

  if (input.followedWalletAddress !== undefined) {
    if (input.followedWalletAddress) {
      followedAddress = input.followedWalletAddress.toLowerCase();
      followedChain = chainSlugToPrisma(input.followedWalletChain || "base");
      isLinkPinned = true;
    } else {
      followedAddress = null;
      followedChain = null;
      isLinkPinned = false;
    }
  }

  return prisma.userTrade.update({
    where: { id: input.id },
    data: {
      thesis: input.thesis !== undefined ? input.thesis.trim() : undefined,
      roiPct: input.roiPct !== undefined ? input.roiPct : undefined,
      exitAt: input.exitAt !== undefined ? input.exitAt : undefined,
      followedWalletAddress: followedAddress,
      followedWalletChain: followedChain,
      isLinkPinned,
    },
    include: {
      ownWallet: true,
      followedWallet: true,
      token: true,
    },
  });
}

export async function listTrades(
  params: {
    walletAddress?: string;
    chain?: ChainSlug;
    source?: "AUTO" | "MANUAL";
    limit?: number;
    cursor?: string;
  } = {},
  injectedPrisma: PrismaClient = defaultPrisma
) {
  const { walletAddress, chain, source, limit = 50, cursor } = params;
  const where: any = {};

  if (walletAddress) {
    where.ownWalletAddress = walletAddress.toLowerCase();
  } else {
    // Default to trades from all self wallets
    where.ownWallet = { isSelf: true };
  }

  if (chain) {
    where.ownChain = chainSlugToPrisma(chain);
  }

  if (source) {
    where.source = source;
  }

  const trades = await injectedPrisma.userTrade.findMany({
    where,
    orderBy: { entryAt: "desc" },
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    include: {
      ownWallet: true,
      followedWallet: {
        include: {
          profile: true,
        },
      },
      token: true,
    },
  });

  let nextCursor: string | undefined = undefined;
  if (trades.length > limit) {
    const nextItem = trades.pop();
    nextCursor = nextItem?.id;
  }

  return { trades, nextCursor };
}
