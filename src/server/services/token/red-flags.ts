// src/server/services/token/red-flags.ts
import { prisma as defaultPrisma } from "@/server/db/client";
import type { PrismaClient, Chain } from "@/generated/prisma/client";
import { chainSlugToPrisma, prismaToChainSlug } from "@/server/services/wallet/normalize";
import type { ChainSlug, ChainAdapter, Address } from "@/lib/chains/types";
import { CHAIN_REGISTRY } from "@/lib/chains/registry";

export interface PromoterWarning {
  walletAddress: string;
  txHash: string;
  amount?: string | null;
  timestamp?: string | null;
}

export interface TokenRedFlagsResult {
  tokenAddress: string;
  chain: string;
  deployedAt: string | null;
  tokenAgeDays: number | null;
  deployerAddress: string | null;
  hasPromoterWarning: boolean;
  promoterWarnings: PromoterWarning[];
  top10SharePct: number | null;
  holderCount: number | null;
  holderDataUnavailable: boolean;
  checkedAt: string;
}

export interface CheckTokenRedFlagsOptions {
  tokenAddress: string;
  chain: Chain | ChainSlug;
  now?: Date;
  adapter?: ChainAdapter;
  // Direct inputs for standalone/unit testing
  tokenInfo?: {
    deployerAddress?: string | null;
    deployedAt?: Date | null;
  };
  transactions?: Array<{
    hash: string;
    fromAddress: string;
    toAddress: string;
    tokenAddress?: string | null;
    valueRaw?: string | null;
    timestamp?: Date | null;
  }>;
  trackedWallets?: string[];
}

/**
 * Pure evaluation function for token red-flag heuristics (FR-7.2, FR-7.1).
 */
export function evaluateTokenRedFlags(params: {
  tokenAddress: string;
  chain: string;
  deployerAddress: string | null;
  deployedAt: Date | null;
  transactions: Array<{
    hash: string;
    fromAddress: string;
    toAddress: string;
    tokenAddress?: string | null;
    valueRaw?: string | null;
    timestamp?: Date | null;
  }>;
  trackedWalletAddresses: string[];
  holderSummary?: {
    top10SharePct: number | null;
    holderCount: number | null;
    source: string;
  } | null;
  now?: Date;
}): TokenRedFlagsResult {
  const {
    tokenAddress,
    chain,
    deployerAddress,
    deployedAt,
    transactions,
    trackedWalletAddresses,
    holderSummary,
    now = new Date(),
  } = params;

  const normDeployer = deployerAddress ? deployerAddress.toLowerCase() : null;
  const trackedSet = new Set(trackedWalletAddresses.map((w) => w.toLowerCase()));

  // 1. Paid-Promoter check: Any tracked wallet that received the token directly from deployer
  const promoterWarnings: PromoterWarning[] = [];
  const seenPairs = new Set<string>();

  if (normDeployer) {
    for (const tx of transactions) {
      const from = tx.fromAddress.toLowerCase();
      const to = tx.toAddress.toLowerCase();

      // Must originate from deployer and go to a tracked wallet
      if (from === normDeployer && trackedSet.has(to)) {
        const pairKey = `${to}_${tx.hash}`;
        if (!seenPairs.has(pairKey)) {
          seenPairs.add(pairKey);
          promoterWarnings.push({
            walletAddress: to,
            txHash: tx.hash,
            amount: tx.valueRaw ?? null,
            timestamp: tx.timestamp ? tx.timestamp.toISOString() : null,
          });
        }
      }
    }
  }

  // 2. Token age derived from deployedAt
  let tokenAgeDays: number | null = null;
  if (deployedAt) {
    const diffMs = now.getTime() - deployedAt.getTime();
    tokenAgeDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  // 3. Top-10 holder share from explorer data
  let top10SharePct: number | null = null;
  let holderCount: number | null = null;
  let holderDataUnavailable = true;

  if (holderSummary && holderSummary.source !== "UNAVAILABLE" && holderSummary.top10SharePct !== null) {
    top10SharePct = holderSummary.top10SharePct;
    holderCount = holderSummary.holderCount;
    holderDataUnavailable = false;
  }

  return {
    tokenAddress: tokenAddress.toLowerCase(),
    chain: chain.toLowerCase(),
    deployedAt: deployedAt ? deployedAt.toISOString() : null,
    tokenAgeDays,
    deployerAddress: normDeployer,
    hasPromoterWarning: promoterWarnings.length > 0,
    promoterWarnings,
    top10SharePct,
    holderCount,
    holderDataUnavailable,
    checkedAt: now.toISOString(),
  };
}

/**
 * Executes token red-flag analysis and persists results into Token.redFlagJson.
 */
export async function checkAndPersistTokenRedFlags(
  options: CheckTokenRedFlagsOptions,
  injectedPrisma: PrismaClient = defaultPrisma
): Promise<TokenRedFlagsResult> {
  const { tokenAddress, chain, now = new Date() } = options;
  const normToken = tokenAddress.toLowerCase();
  const chainSlug: ChainSlug =
    typeof chain === "string" && (chain === "base" || chain === "bsc" || chain === "robinhood")
      ? (chain as ChainSlug)
      : prismaToChainSlug(chain as Chain);
  const prismaChain: Chain = chainSlugToPrisma(chainSlug);

  // If standalone mock data provided
  if (options.tokenInfo && options.transactions && options.trackedWallets) {
    let holderSummary = null;
    if (options.adapter) {
      holderSummary = await options.adapter.getTokenHolderSummary(normToken as Address).catch(() => null);
    }
    const result = evaluateTokenRedFlags({
      tokenAddress: normToken,
      chain: chainSlug,
      deployerAddress: options.tokenInfo.deployerAddress ?? null,
      deployedAt: options.tokenInfo.deployedAt ?? null,
      transactions: options.transactions,
      trackedWalletAddresses: options.trackedWallets,
      holderSummary,
      now,
    });

    if (injectedPrisma?.token) {
      await injectedPrisma.token.upsert({
        where: {
          address_chain: {
            address: normToken,
            chain: prismaChain,
          },
        },
        create: {
          address: normToken,
          chain: prismaChain,
          deployerAddress: options.tokenInfo.deployerAddress ?? null,
          deployedAt: options.tokenInfo.deployedAt ?? null,
          redFlagJson: result as unknown as object,
          redFlagCheckedAt: now,
        },
        update: {
          redFlagJson: result as unknown as object,
          redFlagCheckedAt: now,
        },
      });
    }

    return result;
  }

  // Query database for Token
  const token = await injectedPrisma.token.findUnique({
    where: {
      address_chain: {
        address: normToken,
        chain: prismaChain,
      },
    },
  });

  // Query tracked wallets on this chain
  const trackedWallets = await injectedPrisma.wallet.findMany({
    where: {
      chain: prismaChain,
      isBlacklisted: false,
    },
    select: {
      address: true,
    },
  });

  // Query transactions matching this token
  const transactions = await injectedPrisma.transaction.findMany({
    where: {
      chain: prismaChain,
      tokenAddress: normToken,
    },
    select: {
      hash: true,
      fromAddress: true,
      toAddress: true,
      tokenAddress: true,
      amountRaw: true,
      timestamp: true,
    },
  });

  // Get holder summary from chain adapter if available
  let holderSummary = null;
  const adapter = options.adapter;
  if (adapter && typeof adapter.getTokenHolderSummary === "function") {
    try {
      holderSummary = await adapter.getTokenHolderSummary(normToken as Address);
    } catch {
      holderSummary = null;
    }
  }

  const result = evaluateTokenRedFlags({
    tokenAddress: normToken,
    chain: chainSlug,
    deployerAddress: token?.deployerAddress ?? null,
    deployedAt: token?.deployedAt ?? null,
    transactions: transactions.map((t) => ({
      hash: t.hash,
      fromAddress: t.fromAddress,
      toAddress: t.toAddress ?? "",
      tokenAddress: t.tokenAddress,
      valueRaw: t.amountRaw,
      timestamp: t.timestamp,
    })),
    trackedWalletAddresses: trackedWallets.map((w) => w.address),
    holderSummary,
    now,
  });

  // Update token record
  await injectedPrisma.token.upsert({
    where: {
      address_chain: {
        address: normToken,
        chain: prismaChain,
      },
    },
    create: {
      address: normToken,
      chain: prismaChain,
      redFlagJson: result as unknown as object,
      redFlagCheckedAt: now,
    },
    update: {
      redFlagJson: result as unknown as object,
      redFlagCheckedAt: now,
    },
  });

  return result;
}
