import { formatCompactUsd } from "../interaction/graph-query";

export function formatShortAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function buildSharedFunderStatement(
  otherWallet: string,
  funderAddress: string,
  funderLabel?: string | null
): string {
  const target = formatShortAddress(otherWallet);
  const funder = funderLabel ?? formatShortAddress(funderAddress);
  return `Connected to ${target} via shared funder ${funder}`;
}

export function buildDirectTransferStatement(
  otherWallet: string,
  txCount: number,
  totalUsd: number
): string {
  const target = formatShortAddress(otherWallet);
  const usdFormatted = formatCompactUsd(totalUsd);
  return `Connected to ${target} via direct transfers (${txCount} txs, ${usdFormatted})`;
}

export function buildSameClusterStatement(
  otherWallet: string,
  clusterName: string
): string {
  const target = formatShortAddress(otherWallet);
  return `Connected to ${target} via cluster ${clusterName}`;
}

export function buildCoEntryStatement(
  otherWallet: string,
  tokenCount: number,
  windowHours: number = 24
): string {
  const target = formatShortAddress(otherWallet);
  return `Connected to ${target} via co-entry (${tokenCount} tokens within ${windowHours}h)`;
}

export const INDEPENDENT_VERBATIM =
  "INDEPENDENT — no funding, transfer, or co-entry relationship with any other tracked wallet.";
