import { readFile } from "node:fs/promises";
import { z } from "zod";

import type { Address, ChainAdapter, FetchOptions, FetchResult, PageMeta, RawBalance, RawInternalTx, RawNativeTx, RawTokenInfo, RawTokenTransfer, TokenHolderSummary } from "./types";
import { asAddress } from "./types";

export interface MockScenario {
  name: string;
  latestBlock: bigint;
  nativeTxs: Record<string, RawNativeTx[]>;
  internalTxs: Record<string, RawInternalTx[]>;
  tokenTransfers: Record<string, RawTokenTransfer[]>;
  tokens: Record<string, RawTokenInfo>;
  balances: Record<string, RawBalance[]>;
  holders?: Record<string, TokenHolderSummary>;
  pageCap?: number;
}

type Stats = Record<string, number>;
const address = z.string().regex(/^0x[0-9a-f]{40}$/);
const rawRecord = z.record(z.string(), z.unknown());
const scenarioInput = z.object({
  name: z.string(), latestBlock: z.union([z.string(), z.number()]),
  nativeTxs: z.record(z.string(), z.array(rawRecord)).default({}),
  internalTxs: z.record(z.string(), z.array(rawRecord)).default({}),
  tokenTransfers: z.record(z.string(), z.array(rawRecord)).default({}),
  tokens: z.record(z.string(), rawRecord).default({}),
  balances: z.record(z.string(), z.array(rawRecord)).default({}),
  holders: z.record(z.string(), rawRecord).optional(), pageCap: z.number().optional(),
});

function date(value: unknown): Date { return new Date(typeof value === "number" ? value : String(value)); }
function parseNative(row: Record<string, unknown>): RawNativeTx { return { hash: String(row.hash), blockNumber: BigInt(String(row.blockNumber)), timestamp: date(row.timestamp), from: asAddress(String(row.from)), to: row.to ? asAddress(String(row.to)) : null, valueRaw: String(row.valueRaw ?? "0"), gasUsed: row.gasUsed ? String(row.gasUsed) : null, gasPriceWei: row.gasPriceWei ? String(row.gasPriceWei) : null, isError: Boolean(row.isError), methodId: row.methodId ? String(row.methodId) : null, functionName: row.functionName ? String(row.functionName) : null, contractCreated: row.contractCreated ? asAddress(String(row.contractCreated)) : null }; }
function parseInternal(row: Record<string, unknown>): RawInternalTx { return { hash: String(row.hash), traceId: String(row.traceId), blockNumber: BigInt(String(row.blockNumber)), timestamp: date(row.timestamp), from: asAddress(String(row.from)), to: row.to ? asAddress(String(row.to)) : null, valueRaw: String(row.valueRaw ?? "0"), isError: Boolean(row.isError), callType: row.callType ? String(row.callType) : null }; }
function parseTransfer(row: Record<string, unknown>): RawTokenTransfer { return { hash: String(row.hash), logIndex: Number(row.logIndex), blockNumber: BigInt(String(row.blockNumber)), timestamp: date(row.timestamp), from: asAddress(String(row.from)), to: asAddress(String(row.to)), tokenAddress: asAddress(String(row.tokenAddress)), tokenSymbol: row.tokenSymbol ? String(row.tokenSymbol) : null, tokenName: row.tokenName ? String(row.tokenName) : null, tokenDecimals: row.tokenDecimals == null ? null : Number(row.tokenDecimals), valueRaw: String(row.valueRaw ?? "0") }; }
function parseToken(row: Record<string, unknown>): RawTokenInfo { return { address: asAddress(String(row.address)), symbol: row.symbol ? String(row.symbol) : null, name: row.name ? String(row.name) : null, decimals: row.decimals == null ? null : Number(row.decimals), deployedAt: row.deployedAt ? date(row.deployedAt) : null, deployerAddress: row.deployerAddress ? asAddress(String(row.deployerAddress)) : null, deployTxHash: row.deployTxHash ? String(row.deployTxHash) : null, totalSupplyRaw: row.totalSupplyRaw ? String(row.totalSupplyRaw) : null }; }
function parseBalance(row: Record<string, unknown>): RawBalance { return { tokenAddress: row.tokenAddress ? asAddress(String(row.tokenAddress)) : null, balanceRaw: String(row.balanceRaw ?? "0"), decimals: row.decimals == null ? null : Number(row.decimals), symbol: row.symbol ? String(row.symbol) : null }; }

function increment(stats: Stats, name: string): void { stats[name] = (stats[name] ?? 0) + 1; }

export function createMockChainAdapter(chain: "base" | "bsc" | "robinhood", scenario: MockScenario): ChainAdapter & { stats(): Record<string, number>; reset(): void } {
  const stats: Stats = {};
  const pageCap = scenario.pageCap ?? 1000;
  const fetch = async <T>(endpoint: PageMeta["endpoint"], all: T[], opts: FetchOptions): Promise<FetchResult<T>> => {
    const filtered = all.filter((row) => { const block = endpoint === "NORMAL_TX" ? (row as RawNativeTx).blockNumber : endpoint === "INTERNAL_TX" ? (row as RawInternalTx).blockNumber : (row as RawTokenTransfer).blockNumber; return block >= opts.fromBlock && (opts.toBlock === "latest" || block <= opts.toBlock); });
    const sorted = [...filtered].sort((a, b) => { const ab = endpoint === "NORMAL_TX" ? (a as RawNativeTx).blockNumber : endpoint === "INTERNAL_TX" ? (a as RawInternalTx).blockNumber : (a as RawTokenTransfer).blockNumber; const bb = endpoint === "NORMAL_TX" ? (b as RawNativeTx).blockNumber : endpoint === "INTERNAL_TX" ? (b as RawInternalTx).blockNumber : (b as RawTokenTransfer).blockNumber; return (opts.sort ?? "asc") === "asc" ? Number(ab - bb) : Number(bb - ab); });
    const records = opts.maxRecords === undefined ? sorted : sorted.slice(0, opts.maxRecords);
    const pages: PageMeta[] = []; for (let offset = 0; offset < records.length || offset === 0; offset += pageCap) { const chunk = records.slice(offset, offset + pageCap); const highest = chunk.length ? chunk.reduce((max, row) => { const block = endpoint === "NORMAL_TX" ? (row as RawNativeTx).blockNumber : endpoint === "INTERNAL_TX" ? (row as RawInternalTx).blockNumber : (row as RawTokenTransfer).blockNumber; return block > max ? block : max; }, opts.fromBlock) : opts.fromBlock; const meta: PageMeta = { endpoint, pageNumber: pages.length + 1, recordsInPage: chunk.length, pageWasFull: chunk.length === pageCap, highestBlockSeen: highest, cumulativeRecords: Math.min(records.length, offset + chunk.length) }; pages.push(meta); await opts.onPage?.(meta); if (chunk.length < pageCap) break; }
    return { records, coveredThroughBlock: records.length === sorted.length ? (opts.toBlock === "latest" ? scenario.latestBlock : opts.toBlock) : opts.fromBlock - 1n, truncated: records.length < sorted.length, pages, callsSpent: pages.length };
  };
  const byAddress = (table: Record<string, RawNativeTx[]>, key: Address): RawNativeTx[] => table[key.toLowerCase()] ?? [];
  return {
    chain, chainId: chain === "base" ? 8453 : chain === "bsc" ? 56 : 4663, nativeSymbol: chain === "bsc" ? "BNB" : "ETH", nativeDecimals: 18,
    getTransactions: (a, o) => { increment(stats, "getTransactions"); return fetch("NORMAL_TX", byAddress(scenario.nativeTxs, a), o); },
    getInternalTxs: (a, o) => { increment(stats, "getInternalTxs"); return fetch("INTERNAL_TX", (scenario.internalTxs[a.toLowerCase()] ?? []), o); },
    getTokenTransfers: (a, o) => { increment(stats, "getTokenTransfers"); return fetch("ERC20_TRANSFER", scenario.tokenTransfers[a.toLowerCase()] ?? [], o); },
    async getTokenInfo(tokenAddress) { increment(stats, "getTokenInfo"); return scenario.tokens[tokenAddress.toLowerCase()] ?? null; },
    async getBalances(a) { increment(stats, "getBalances"); return scenario.balances[a.toLowerCase()] ?? []; },
    async getLatestBlock() { increment(stats, "getLatestBlock"); return scenario.latestBlock; },
    async getBlockNumberByTimestamp() { increment(stats, "getBlockNumberByTimestamp"); return scenario.latestBlock; },
    async getTokenHolderSummary(tokenAddress) { increment(stats, "getTokenHolderSummary"); return scenario.holders?.[tokenAddress.toLowerCase()] ?? null; },
    explorerTxUrl: (hash) => `mock://${chain}/tx/${hash}`,
    explorerAddressUrl: (a) => `mock://${chain}/address/${a}`,
    stats: () => ({ ...stats }),
    reset: () => { for (const name of Object.keys(stats)) delete stats[name]; },
  };
}

export async function loadScenario(name: string): Promise<MockScenario> {
  const url = new URL(`../../../tests/fixtures/scenarios/${name}.json`, import.meta.url);
  const parsed = scenarioInput.parse(JSON.parse(await readFile(url, "utf8")));
  const nativeTxs: Record<string, RawNativeTx[]> = {}; for (const [key, rows] of Object.entries(parsed.nativeTxs)) nativeTxs[key] = rows.map(parseNative);
  const internalTxs: Record<string, RawInternalTx[]> = {}; for (const [key, rows] of Object.entries(parsed.internalTxs)) internalTxs[key] = rows.map(parseInternal);
  const tokenTransfers: Record<string, RawTokenTransfer[]> = {}; for (const [key, rows] of Object.entries(parsed.tokenTransfers)) tokenTransfers[key] = rows.map(parseTransfer);
  const tokens: Record<string, RawTokenInfo> = {}; for (const [key, row] of Object.entries(parsed.tokens)) tokens[key] = parseToken(row);
  const balances: Record<string, RawBalance[]> = {}; for (const [key, rows] of Object.entries(parsed.balances)) balances[key] = rows.map(parseBalance);
  if (name === "hot-block-2500") {
    const hotWallet = "0x0000000000000000000000000000000000000001";
    nativeTxs[hotWallet] = Array.from({ length: 2500 }, (_, index) => ({
      hash: `0x${index.toString(16).padStart(64, "0")}`,
      blockNumber: 1000n,
      timestamp: new Date("2026-01-01T00:00:00Z"),
      from: asAddress(hotWallet), to: null, valueRaw: "1", gasUsed: null,
      gasPriceWei: null, isError: false, methodId: null, functionName: null, contractCreated: null,
    }));
  }
  return { name: parsed.name, latestBlock: BigInt(String(parsed.latestBlock)), nativeTxs, internalTxs, tokenTransfers, tokens, balances, pageCap: parsed.pageCap };
}
