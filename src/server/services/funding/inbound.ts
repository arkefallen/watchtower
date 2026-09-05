import { formatUnits } from "viem";
import type {
  Address,
  ChainSlug,
  ChainAdapter,
  RawNativeTx,
  RawInternalTx,
  RawAmount,
} from "@/lib/chains/types";

export interface InboundFundingEvent {
  funderAddress: Address;
  amountRaw: RawAmount;
  amountUsd: string | null;
  timestamp: Date;
  isInternal: boolean;
  txHash: string;
}

export interface InboundFunderSummary {
  funderAddress: Address;
  totalUsd: string;
  fundingCount: number;
  internalFundingCount: number;
  nativeFundingCount: number;
  firstFundedAt: Date | null;
  lastFundedAt: Date | null;
  fundedFirstGas: boolean;
}

export async function fetchInboundFunding(
  address: Address,
  adapter: ChainAdapter,
  nativePriceUsd: string | null = null
): Promise<InboundFunderSummary[]> {
  const normAddress = address.toLowerCase();

  // 1. Fetch native transactions
  const nativeResult = await adapter.getTransactions(address, {
    fromBlock: 0n,
    toBlock: "latest",
    sort: "asc",
  });

  // 2. Fetch internal transactions
  const internalResult = await adapter.getInternalTxs(address, {
    fromBlock: 0n,
    toBlock: "latest",
    sort: "asc",
  });

  const events: InboundFundingEvent[] = [];

  // Filter native inbound transfers with value > 0
  for (const tx of nativeResult.records) {
    if (tx.isError) continue;
    if (tx.to && tx.to.toLowerCase() === normAddress) {
      if (BigInt(tx.valueRaw) > 0n) {
        let usd: string | null = null;
        if (nativePriceUsd !== null) {
          const val =
            parseFloat(formatUnits(BigInt(tx.valueRaw), adapter.nativeDecimals)) *
            parseFloat(nativePriceUsd);
          usd = val.toFixed(8);
        }
        events.push({
          funderAddress: tx.from.toLowerCase() as Address,
          amountRaw: tx.valueRaw,
          amountUsd: usd,
          timestamp: tx.timestamp,
          isInternal: false,
          txHash: tx.hash,
        });
      }
    }
  }

  // Filter internal inbound transfers with value > 0
  for (const tx of internalResult.records) {
    if (tx.isError) continue;
    if (tx.to && tx.to.toLowerCase() === normAddress) {
      if (BigInt(tx.valueRaw) > 0n) {
        let usd: string | null = null;
        if (nativePriceUsd !== null) {
          const val =
            parseFloat(formatUnits(BigInt(tx.valueRaw), adapter.nativeDecimals)) *
            parseFloat(nativePriceUsd);
          usd = val.toFixed(8);
        }
        events.push({
          funderAddress: tx.from.toLowerCase() as Address,
          amountRaw: tx.valueRaw,
          amountUsd: usd,
          timestamp: tx.timestamp,
          isInternal: true,
          txHash: tx.hash,
        });
      }
    }
  }

  if (events.length === 0) {
    return [];
  }

  // Sort events chronologically to determine first gas
  events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const earliestFunder = events[0].funderAddress;

  // Group by funder
  const funderGroups = new Map<
    string,
    {
      funderAddress: Address;
      totalUsd: number;
      fundingCount: number;
      internalFundingCount: number;
      nativeFundingCount: number;
      firstFundedAt: Date | null;
      lastFundedAt: Date | null;
      fundedFirstGas: boolean;
    }
  >();

  for (const ev of events) {
    const key = ev.funderAddress;
    const existing = funderGroups.get(key) ?? {
      funderAddress: ev.funderAddress,
      totalUsd: 0,
      fundingCount: 0,
      internalFundingCount: 0,
      nativeFundingCount: 0,
      firstFundedAt: null,
      lastFundedAt: null,
      fundedFirstGas: key === earliestFunder,
    };

    existing.fundingCount++;
    if (ev.isInternal) {
      existing.internalFundingCount++;
    } else {
      existing.nativeFundingCount++;
    }

    if (ev.amountUsd) {
      existing.totalUsd += parseFloat(ev.amountUsd);
    }

    if (!existing.firstFundedAt || ev.timestamp < existing.firstFundedAt) {
      existing.firstFundedAt = ev.timestamp;
    }
    if (!existing.lastFundedAt || ev.timestamp > existing.lastFundedAt) {
      existing.lastFundedAt = ev.timestamp;
    }

    funderGroups.set(key, existing);
  }

  return Array.from(funderGroups.values()).map((g) => ({
    funderAddress: g.funderAddress,
    totalUsd: g.totalUsd.toFixed(8),
    fundingCount: g.fundingCount,
    internalFundingCount: g.internalFundingCount,
    nativeFundingCount: g.nativeFundingCount,
    firstFundedAt: g.firstFundedAt,
    lastFundedAt: g.lastFundedAt,
    fundedFirstGas: g.fundedFirstGas,
  }));
}
