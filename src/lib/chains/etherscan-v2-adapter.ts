import type { EtherscanPageRequest } from "@/lib/etherscan/client";
import { fetchAllPages } from "@/lib/etherscan/pagination";
import { asAddress, type Address, type ChainAdapter, type ChainSlug, type FetchOptions, type FetchResult, type RawBalance, type RawInternalTx, type RawNativeTx, type RawTokenInfo, type RawTokenTransfer, type TokenHolderSummary } from "./types";

export interface EtherscanV2Client {
  fetchPage<T>(request: EtherscanPageRequest): Promise<{ rows: T[]; fromCache: boolean }>;
  fetchAllPages<T>(request: Omit<EtherscanPageRequest, "page"> & { fromBlock: bigint; toBlock: bigint }, options: { endpoint: "NORMAL_TX" | "INTERNAL_TX" | "ERC20_TRANSFER"; pageCap: number; maxRecords?: number; maxPages?: number; blockOf: (row: T) => bigint; onPage?: (page: import("./types").PageMeta) => void | Promise<void> }): Promise<FetchResult<T>>;
}
export interface EtherscanV2AdapterDeps { client: EtherscanV2Client; chain: ChainSlug; chainId: number; nativeSymbol: string; nativeDecimals: number; explorerBaseUrl: string; pageCap?: number; }

const text = (row: Record<string, unknown>, key: string): string => String(row[key] ?? "");
const optionalText = (row: Record<string, unknown>, key: string): string | null => row[key] === undefined || row[key] === "" ? null : String(row[key]);
const boolError = (row: Record<string, unknown>): boolean => text(row, "isError") === "1" || text(row, "txreceipt_status") === "0";
const timestamp = (row: Record<string, unknown>): Date => new Date(Number(text(row, "timeStamp")) * 1000);
const requestBase = (address: Address, opts: FetchOptions, module: EtherscanPageRequest["module"], action: string): Omit<EtherscanPageRequest, "page"> & { fromBlock: bigint; toBlock: bigint } => ({ chainId: 0, module, action, params: { address, sort: opts.sort ?? "asc" }, offset: 1000, priority: "BACKGROUND", signal: opts.signal, cacheTtlMs: 0, fromBlock: opts.fromBlock, toBlock: opts.toBlock === "latest" ? 0n : opts.toBlock });

function result<T>(r: FetchResult<T>): FetchResult<T> { return r; }

export function createEtherscanV2Adapter(deps: EtherscanV2AdapterDeps): ChainAdapter {
  const pageCap = deps.pageCap ?? 1000;
  const fetch = async <T>(address: Address, opts: FetchOptions, action: string, endpoint: "NORMAL_TX" | "INTERNAL_TX" | "ERC20_TRANSFER", map: (row: Record<string, unknown>) => T): Promise<FetchResult<T>> => {
    const request = requestBase(address, opts, "account", action);
    request.chainId = deps.chainId;
    return result(await deps.client.fetchAllPages({ ...request }, { endpoint, pageCap, maxRecords: opts.maxRecords, blockOf: (row) => BigInt(text(row as Record<string, unknown>, "blockNumber")), onPage: opts.onPage }));
  };
  return {
    chain: deps.chain, chainId: deps.chainId, nativeSymbol: deps.nativeSymbol, nativeDecimals: deps.nativeDecimals,
    getTransactions: (address, opts) => fetch(address, opts, "txlist", "NORMAL_TX", (row) => ({ hash: text(row, "hash"), blockNumber: BigInt(text(row, "blockNumber")), timestamp: timestamp(row), from: asAddress(text(row, "from")), to: optionalText(row, "to") ? asAddress(text(row, "to")) : null, valueRaw: text(row, "value"), gasUsed: optionalText(row, "gasUsed"), gasPriceWei: optionalText(row, "gasPrice"), isError: boolError(row), methodId: optionalText(row, "methodId"), functionName: optionalText(row, "functionName"), contractCreated: optionalText(row, "contractAddress") ? asAddress(text(row, "contractAddress")) : null } satisfies RawNativeTx)),
    getInternalTxs: (address, opts) => fetch(address, opts, "txlistinternal", "INTERNAL_TX", (row) => ({ hash: text(row, "hash"), traceId: text(row, "traceId"), blockNumber: BigInt(text(row, "blockNumber")), timestamp: timestamp(row), from: asAddress(text(row, "from")), to: optionalText(row, "to") ? asAddress(text(row, "to")) : null, valueRaw: text(row, "value"), isError: boolError(row), callType: optionalText(row, "type") } satisfies RawInternalTx)),
    getTokenTransfers: (address, opts) => fetch(address, opts, "tokentx", "ERC20_TRANSFER", (row) => ({ hash: text(row, "hash"), logIndex: Number(text(row, "logIndex")), blockNumber: BigInt(text(row, "blockNumber")), timestamp: timestamp(row), from: asAddress(text(row, "from")), to: asAddress(text(row, "to")), tokenAddress: asAddress(text(row, "contractAddress")), tokenSymbol: optionalText(row, "tokenSymbol"), tokenName: optionalText(row, "tokenName"), tokenDecimals: optionalText(row, "tokenDecimal") ? Number(text(row, "tokenDecimal")) : null, valueRaw: text(row, "value") } satisfies RawTokenTransfer)),
    async getTokenInfo(tokenAddress) { const r = await deps.client.fetchPage<Record<string, unknown>>({ chainId: deps.chainId, module: "token", action: "tokeninfo", params: { contractaddress: tokenAddress }, page: 1, offset: 1, priority: "INTERACTIVE", cacheTtlMs: 86_400_000 }); const row = r.rows[0]; if (!row) return null; return { address: tokenAddress, symbol: optionalText(row, "symbol"), name: optionalText(row, "tokenName"), decimals: optionalText(row, "divisor") ? Number(text(row, "divisor")) : null, deployedAt: null, deployerAddress: null, deployTxHash: null, totalSupplyRaw: optionalText(row, "totalSupply") } satisfies RawTokenInfo; },
    async getBalances(address, tokenAddresses) { const native = await deps.client.fetchPage<Record<string, unknown>>({ chainId: deps.chainId, module: "account", action: "balance", params: { address, tag: "latest" }, page: 1, offset: 1, priority: "INTERACTIVE", cacheTtlMs: 0 }); const resultRows: RawBalance[] = [{ tokenAddress: null, balanceRaw: String(native.rows[0] ?? "0"), decimals: deps.nativeDecimals, symbol: deps.nativeSymbol }]; for (const tokenAddress of tokenAddresses) { const row = await deps.client.fetchPage<Record<string, unknown>>({ chainId: deps.chainId, module: "account", action: "tokenbalance", params: { address, contractaddress: tokenAddress, tag: "latest" }, page: 1, offset: 1, priority: "INTERACTIVE", cacheTtlMs: 0 }); resultRows.push({ tokenAddress, balanceRaw: String(row.rows[0] ?? "0"), decimals: null, symbol: null }); } return resultRows; },
    async getLatestBlock() { const r = await deps.client.fetchPage<string>({ chainId: deps.chainId, module: "proxy", action: "eth_blockNumber", params: {}, page: 1, offset: 1, priority: "INTERACTIVE", cacheTtlMs: 0 }); return BigInt(r.rows[0] ?? "0"); },
    async getBlockNumberByTimestamp(at) { const r = await deps.client.fetchPage<string>({ chainId: deps.chainId, module: "block", action: "getblocknobytime", params: { timestamp: Math.floor(at.getTime() / 1000), closest: "before" }, page: 1, offset: 1, priority: "INTERACTIVE", cacheTtlMs: 0 }); return BigInt(r.rows[0] ?? "0"); },
    async getTokenHolderSummary(_tokenAddress): Promise<TokenHolderSummary | null> { return null; },
    explorerTxUrl: (hash) => `${deps.explorerBaseUrl}/tx/${hash}`,
    explorerAddressUrl: (address) => `${deps.explorerBaseUrl}/address/${address}`,
  };
}
