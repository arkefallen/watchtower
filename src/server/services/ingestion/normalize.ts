import type {
  RawNativeTx,
  RawInternalTx,
  RawTokenTransfer,
  ChainSlug,
} from "@/lib/chains/types";
import { normalizeAddress } from "../wallet/normalize";

export interface NormalizedTxRow {
  hash: string;
  chain: ChainSlug;
  blockNumber: bigint;
  timestamp: Date;
  fromAddress: string;
  toAddress: string | null;
  tokenAddress: string | null;
  kind: "NATIVE" | "INTERNAL" | "ERC20";
  amountRaw: string;
  txType: "TRANSFER" | "SWAP" | "DEPLOY";
  ordinal: number;
  logIndex?: number | null;
  traceId?: string | null;
  tokenDecimals?: number | null;
  tokenSymbol?: string | null;
  gasUsed?: string | null;
  gasPriceWei?: string | null;
  isError: boolean;
  methodId?: string | null;
  functionName?: string | null;
  contractCreated?: string | null;
}

export interface TokenStub {
  address: string;
  chain: ChainSlug;
  symbol?: string | null;
  name?: string | null;
  decimals?: number | null;
}

export function normalizeNativeTx(tx: RawNativeTx, chain: ChainSlug): NormalizedTxRow {
  return {
    hash: tx.hash.toLowerCase(),
    chain,
    blockNumber: tx.blockNumber,
    timestamp: tx.timestamp,
    fromAddress: normalizeAddress(tx.from),
    toAddress: tx.to ? normalizeAddress(tx.to) : null,
    tokenAddress: null,
    kind: "NATIVE",
    amountRaw: tx.valueRaw,
    txType: tx.contractCreated ? "DEPLOY" : "TRANSFER",
    ordinal: 0,
    gasUsed: tx.gasUsed,
    gasPriceWei: tx.gasPriceWei,
    isError: tx.isError,
    methodId: tx.methodId,
    functionName: tx.functionName,
    contractCreated: tx.contractCreated ? normalizeAddress(tx.contractCreated) : null,
  };
}

export function normalizeInternalTx(
  tx: RawInternalTx,
  chain: ChainSlug,
  ordinal: number = 0
): NormalizedTxRow {
  return {
    hash: tx.hash.toLowerCase(),
    chain,
    blockNumber: tx.blockNumber,
    timestamp: tx.timestamp,
    fromAddress: normalizeAddress(tx.from),
    toAddress: tx.to ? normalizeAddress(tx.to) : null,
    tokenAddress: null,
    kind: "INTERNAL",
    amountRaw: tx.valueRaw,
    txType: "TRANSFER",
    ordinal,
    traceId: tx.traceId,
    isError: tx.isError,
  };
}

export function normalizeTokenTransfer(tx: RawTokenTransfer, chain: ChainSlug): NormalizedTxRow {
  const tokenAddress = normalizeAddress(tx.tokenAddress);
  return {
    hash: tx.hash.toLowerCase(),
    chain,
    blockNumber: tx.blockNumber,
    timestamp: tx.timestamp,
    fromAddress: normalizeAddress(tx.from),
    toAddress: normalizeAddress(tx.to),
    tokenAddress,
    kind: "ERC20",
    amountRaw: tx.valueRaw,
    txType: "TRANSFER",
    ordinal: tx.logIndex,
    logIndex: tx.logIndex,
    tokenSymbol: tx.tokenSymbol,
    tokenDecimals: tx.tokenDecimals,
    isError: false,
  };
}

export function extractTokenStub(tx: RawTokenTransfer, chain: ChainSlug): TokenStub {
  return {
    address: normalizeAddress(tx.tokenAddress),
    chain,
    symbol: tx.tokenSymbol,
    name: tx.tokenName,
    decimals: tx.tokenDecimals,
  };
}
