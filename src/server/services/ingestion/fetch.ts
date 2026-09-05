import type {
  ChainAdapter,
  Address,
  PageMeta,
  BlockRange,
} from "@/lib/chains/types";
import {
  normalizeNativeTx,
  normalizeInternalTx,
  normalizeTokenTransfer,
  extractTokenStub,
  type NormalizedTxRow,
  type TokenStub,
} from "./normalize";

export interface FetchEndpointOptions {
  fromBlock?: bigint;
  toBlock?: bigint | "latest";
  maxRecords?: number;
  signal?: AbortSignal;
  onPage?: (page: PageMeta) => void | Promise<void>;
}

export interface IngestionFetchResult {
  native: {
    transactions: NormalizedTxRow[];
    coveredThroughBlock: bigint;
    truncated: boolean;
    callsSpent: number;
  };
  internal: {
    transactions: NormalizedTxRow[];
    coveredThroughBlock: bigint;
    truncated: boolean;
    callsSpent: number;
  };
  erc20: {
    transactions: NormalizedTxRow[];
    tokenStubs: TokenStub[];
    coveredThroughBlock: bigint;
    truncated: boolean;
    callsSpent: number;
  };
  totalCallsSpent: number;
  allTransactions: NormalizedTxRow[];
  tokenStubs: TokenStub[];
}

export async function fetchAllEndpointTransactions(
  adapter: ChainAdapter,
  address: Address,
  options: {
    nativeOpts?: FetchEndpointOptions;
    internalOpts?: FetchEndpointOptions;
    erc20Opts?: FetchEndpointOptions;
  } = {}
): Promise<IngestionFetchResult> {
  const chain = adapter.chain;

  // 1. Fetch normal native transactions
  const nativeRes = await adapter.getTransactions(address, {
    fromBlock: options.nativeOpts?.fromBlock ?? 0n,
    toBlock: options.nativeOpts?.toBlock ?? "latest",
    maxRecords: options.nativeOpts?.maxRecords,
    signal: options.nativeOpts?.signal,
    onPage: options.nativeOpts?.onPage,
  });
  const nativeTxs = nativeRes.records.map((tx) => normalizeNativeTx(tx, chain));

  // 2. Fetch internal transactions
  const internalRes = await adapter.getInternalTxs(address, {
    fromBlock: options.internalOpts?.fromBlock ?? 0n,
    toBlock: options.internalOpts?.toBlock ?? "latest",
    maxRecords: options.internalOpts?.maxRecords,
    signal: options.internalOpts?.signal,
    onPage: options.internalOpts?.onPage,
  });
  // Assign stable ordinals per internal trace
  const internalTxs = internalRes.records.map((tx, idx) =>
    normalizeInternalTx(tx, chain, idx)
  );

  // 3. Fetch ERC20 token transfers
  const erc20Res = await adapter.getTokenTransfers(address, {
    fromBlock: options.erc20Opts?.fromBlock ?? 0n,
    toBlock: options.erc20Opts?.toBlock ?? "latest",
    maxRecords: options.erc20Opts?.maxRecords,
    signal: options.erc20Opts?.signal,
    onPage: options.erc20Opts?.onPage,
  });
  const erc20Txs = erc20Res.records.map((tx) => normalizeTokenTransfer(tx, chain));
  const tokenStubs = erc20Res.records.map((tx) => extractTokenStub(tx, chain));

  const totalCallsSpent = nativeRes.callsSpent + internalRes.callsSpent + erc20Res.callsSpent;
  const allTransactions = [...nativeTxs, ...internalTxs, ...erc20Txs];

  return {
    native: {
      transactions: nativeTxs,
      coveredThroughBlock: nativeRes.coveredThroughBlock,
      truncated: nativeRes.truncated,
      callsSpent: nativeRes.callsSpent,
    },
    internal: {
      transactions: internalTxs,
      coveredThroughBlock: internalRes.coveredThroughBlock,
      truncated: internalRes.truncated,
      callsSpent: internalRes.callsSpent,
    },
    erc20: {
      transactions: erc20Txs,
      tokenStubs,
      coveredThroughBlock: erc20Res.coveredThroughBlock,
      truncated: erc20Res.truncated,
      callsSpent: erc20Res.callsSpent,
    },
    totalCallsSpent,
    allTransactions,
    tokenStubs,
  };
}
