import type { Job } from "bullmq";
import { prisma as defaultPrisma } from "@/server/db/client";
import type { ChainSlug, Address } from "@/lib/chains/types";
import { classifySwap, type SwapGroupInput } from "@/server/services/pricing/swap";
import { attributeUsd, type PricingContext } from "@/server/services/pricing/attribute";
import { createNativePriceStore } from "@/server/services/pricing/native";
import { persistPriceSnapshots } from "@/server/services/pricing/snapshot";
import { chainSlugToPrisma } from "@/server/services/wallet/normalize";
import { loadSettings } from "@/server/services/settings";

export interface PriceEnrichPayload {
  walletAddress?: string;
  chain?: ChainSlug;
  txHashes?: string[];
}

export async function processPriceEnrichJob(
  job: Job<PriceEnrichPayload>,
  injectedPrisma = defaultPrisma
) {
  const { walletAddress, chain, txHashes } = job.data;
  const prisma = injectedPrisma;
  const settings = await loadSettings();
  const stableTokens = Object.values(settings.stableTokens ?? {})
    .flat()
    .map((t: { address: string; symbol: string }) => t.address.toLowerCase());
  const nativePriceStore = createNativePriceStore(prisma);

  const context: PricingContext = {
    stableTokens,
    nativePriceStore,
  };

  const where: any = {};
  if (chain) where.chain = chainSlugToPrisma(chain);
  if (txHashes && txHashes.length > 0) where.hash = { in: txHashes };
  if (walletAddress) {
    where.OR = [
      { fromAddress: walletAddress.toLowerCase() },
      { toAddress: walletAddress.toLowerCase() },
    ];
  }

  const txRows = await prisma.transaction.findMany({
    where,
    orderBy: [{ timestamp: "asc" }, { ordinal: "asc" }],
  });

  // Group by hash
  const hashGroups = new Map<string, typeof txRows>();
  for (const row of txRows) {
    const list = hashGroups.get(row.hash) ?? [];
    list.push(row);
    hashGroups.set(row.hash, list);
  }

  let priced = 0;
  let unpriced = 0;

  for (const [hash, rows] of hashGroups) {
    const first = rows[0];
    const rowChain = first.chain.toLowerCase() as ChainSlug;
    const targetWallet = walletAddress?.toLowerCase() ?? first.fromAddress.toLowerCase();

    // Map to swap inputs
    const swapInputs: SwapGroupInput[] = rows.map((r) => ({
      hash: r.hash,
      chain: rowChain,
      walletAddress: targetWallet as Address,
      fromAddress: r.fromAddress as Address,
      toAddress: r.toAddress as Address | null,
      tokenAddress: r.tokenAddress as Address | null,
      amountRaw: r.amountRaw,
      tokenDecimals: r.tokenDecimals,
      isStable: Boolean(r.tokenAddress && stableTokens.includes(r.tokenAddress.toLowerCase())),
      isNative: r.tokenAddress === null,
    }));

    const swapGroup = classifySwap(swapInputs);

    for (const row of rows) {
      const attribution = await attributeUsd(
        {
          tokenAddress: row.tokenAddress as Address | null,
          chain: rowChain,
          amountRaw: row.amountRaw,
          decimals: row.tokenDecimals,
          timestamp: row.timestamp,
          swapGroup,
        },
        context
      );

      if (attribution.amountUsd !== null) {
        priced++;
        // If discovered price snapshot for an ERC20 token, persist it
        if (row.tokenAddress && attribution.priceUsdUsed) {
          await persistPriceSnapshots(prisma, [
            {
              tokenAddress: row.tokenAddress,
              chain: rowChain,
              timestamp: row.timestamp,
              priceUsd: attribution.priceUsdUsed,
              marketCap: attribution.marketCap,
              source: attribution.source as any,
              confidence: (attribution.confidence ?? "HIGH") as any,
              txHash: row.hash,
            },
          ]);
        }
      } else {
        unpriced++;
      }

      await prisma.transaction.update({
        where: { id: row.id },
        data: {
          amountUsd: attribution.amountUsd,
          priceUsdUsed: attribution.priceUsdUsed,
          usdSource: attribution.source as any,
          usdConfidence: attribution.confidence as any,
          swapGroupKey: swapGroup?.swapGroupKey,
          txType: swapGroup ? "SWAP" : row.txType,
        },
      });
    }
  }

  return {
    processed: txRows.length,
    priced,
    unpriced,
  };
}
