import type { ChainSlug, Address, RawAmount } from "@/lib/chains/types";

export interface SwapLeg {
  tokenAddress: Address | null;
  amountRaw: RawAmount;
  decimals: number | null;
  isStable: boolean;
  isNative: boolean;
}

export interface SwapGroup {
  chain?: ChainSlug;
  txHash?: string;
  walletAddress?: Address;
  swapGroupKey: string;
  outLegs: SwapLeg[];
  inLegs: SwapLeg[];
  counterparties?: Address[];
  routerHit?: boolean;
}

export interface SwapGroupInput {
  hash: string;
  chain: ChainSlug;
  walletAddress: Address;
  fromAddress: Address;
  toAddress: Address | null;
  tokenAddress: Address | null;
  amountRaw: RawAmount;
  tokenDecimals?: number | null;
  isStable?: boolean;
  isNative?: boolean;
  isRouter?: boolean;
}

export function classifySwap(rows: SwapGroupInput[]): SwapGroup | null {
  if (rows.length === 0) return null;

  const first = rows[0];
  const chain = first.chain;
  const txHash = first.hash.toLowerCase();
  const walletAddress = first.walletAddress.toLowerCase() as Address;
  const swapGroupKey = `${chain}:${txHash}:${walletAddress}`;

  const outLegs: SwapLeg[] = [];
  const inLegs: SwapLeg[] = [];
  const counterparties: Address[] = [];
  let routerHit = false;

  for (const row of rows) {
    const from = row.fromAddress.toLowerCase() as Address;
    const to = row.toAddress ? (row.toAddress.toLowerCase() as Address) : null;
    const isStable = Boolean(row.isStable);
    const isNative = Boolean(row.isNative || row.tokenAddress === null);

    if (row.isRouter) {
      routerHit = true;
    }

    if (from === walletAddress && to && to !== walletAddress) {
      outLegs.push({
        tokenAddress: row.tokenAddress,
        amountRaw: row.amountRaw,
        decimals: row.tokenDecimals ?? null,
        isStable,
        isNative,
      });
      if (!counterparties.includes(to)) {
        counterparties.push(to);
      }
    } else if (to === walletAddress && from !== walletAddress) {
      inLegs.push({
        tokenAddress: row.tokenAddress,
        amountRaw: row.amountRaw,
        decimals: row.tokenDecimals ?? null,
        isStable,
        isNative,
      });
      if (!counterparties.includes(from)) {
        counterparties.push(from);
      }
    }
  }

  if (outLegs.length > 0 && inLegs.length > 0) {
    return {
      chain,
      txHash,
      walletAddress,
      swapGroupKey,
      outLegs,
      inLegs,
      counterparties,
      routerHit,
    };
  }

  return null;
}
