import { z } from "zod";

import type { ProviderCache } from "../cache/provider-cache";
import type { CallPriority, RateLimiter } from "../ratelimit";
import { asAddress, type Address } from "../chains/types";

const transferSchema = z.object({
  blockNum: z.string(),
  uniqueId: z.string().optional(),
  hash: z.string(),
  from: z.string(),
  to: z.string().nullable().optional(),
  value: z.number().nullable().optional(),
  asset: z.string().nullable().optional(),
  category: z.string(),
  rawContract: z.object({ address: z.string().nullable().optional(), value: z.string().nullable().optional(), decimal: z.number().nullable().optional() }).optional(),
  metadata: z.object({ blockTimestamp: z.string().nullable().optional() }).optional(),
});
const transfersResponseSchema = z.object({ result: z.object({ transfers: z.array(transferSchema), pageKey: z.string().optional() }) });
const rpcResponseSchema = z.object({ result: z.unknown() });
const tokenMetadataSchema = z.object({ result: z.object({ name: z.string().nullable().optional(), symbol: z.string().nullable().optional(), decimals: z.number().nullable().optional() }) });

export type AlchemyTransfer = z.infer<typeof transferSchema>;
export type TransferCategory = "external" | "internal" | "erc20";

export type RobinhoodProviderErrorCode = "RATE_LIMITED" | "SERVER_ERROR" | "BAD_REQUEST" | "NETWORK";
export class RobinhoodProviderError extends Error {
  constructor(public readonly code: RobinhoodProviderErrorCode, message: string) { super(message); this.name = "RobinhoodProviderError"; }
}

export interface RobinhoodProviderClient {
  transfers(address: Address, category: TransferCategory, fromBlock: bigint, toBlock: bigint | "latest", pageKey?: string, signal?: AbortSignal): Promise<{ rows: AlchemyTransfer[]; pageKey?: string }>;
  transaction(hash: string, signal?: AbortSignal): Promise<Record<string, unknown> | null>;
  receipt(hash: string, signal?: AbortSignal): Promise<Record<string, unknown> | null>;
  tokenMetadata(address: Address, signal?: AbortSignal): Promise<{ name: string | null; symbol: string | null; decimals: number | null }>;
  rpc(method: string, params: unknown[], signal?: AbortSignal): Promise<unknown>;
}

export interface RobinhoodProviderConfig {
  apiKey: string;
  blockscoutApiKey?: string;
  baseUrl?: string;
  rpcUrl?: string;
  limiter: RateLimiter;
  cache?: ProviderCache;
  fetcher?: typeof fetch;
}

function hexBlock(block: bigint | "latest"): string { return block === "latest" ? "latest" : `0x${block.toString(16)}`; }
function rawValue(value: AlchemyTransfer): string {
  if (value.rawContract?.value) return value.rawContract.value;
  if (value.value === null || value.value === undefined) return "0";
  const [whole, fraction = ""] = String(value.value).split(".");
  return `${whole}${fraction.padEnd(18, "0").slice(0, 18)}`;
}

export function createRobinhoodProviderClient(config: RobinhoodProviderConfig): RobinhoodProviderClient {
  const fetcher = config.fetcher ?? fetch;
  const baseUrl = config.baseUrl ?? "https://robinhood-mainnet.g.alchemy.com/v2";
  const rpcUrl = config.rpcUrl ?? `https://robinhood-mainnet.g.alchemy.com/v2/${config.apiKey}`;
  const blockscoutUrl = "https://api.blockscout.com/4663/api/v2";
  async function post(url: string, body: unknown, priority: CallPriority, signal?: AbortSignal): Promise<unknown> {
    await config.limiter.acquire(1, priority);
    const response = await fetcher(url, { method: "POST", signal, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) throw new RobinhoodProviderError(response.status === 429 ? "RATE_LIMITED" : response.status >= 500 ? "SERVER_ERROR" : "BAD_REQUEST", `Robinhood provider HTTP ${response.status}`);
    return response.json();
  }
  return {
    async transfers(address, category, fromBlock, toBlock, pageKey, signal) {
      if (category === "internal" && config.blockscoutApiKey) {
        await config.limiter.acquire(1, "BACKGROUND");
        const query = new URLSearchParams({ apikey: config.blockscoutApiKey, items_count: "50" });
        if (pageKey) { const decoded = JSON.parse(Buffer.from(pageKey, "base64url").toString("utf8")) as Record<string, string | number>; for (const [key, value] of Object.entries(decoded)) query.set(key, String(value)); }
        const response = await fetcher(`${blockscoutUrl}/addresses/${address}/internal-transactions?${query}`, { signal, headers: { accept: "application/json" } });
        if (!response.ok) throw new RobinhoodProviderError(response.status === 429 ? "RATE_LIMITED" : response.status >= 500 ? "SERVER_ERROR" : "BAD_REQUEST", `Blockscout provider HTTP ${response.status}`);
        const parsed = z.object({ items: z.array(z.unknown()), next_page_params: z.record(z.string(), z.union([z.string(), z.number()])).nullable().optional() }).parse(await response.json());
        const rows = parsed.items.flatMap((item): AlchemyTransfer[] => {
          const row = z.object({ block_number: z.number(), transaction_hash: z.string(), index: z.number().optional(), value: z.string(), timestamp: z.string().optional(), from: z.object({ hash: z.string() }).optional(), to: z.object({ hash: z.string() }).nullable().optional() }).passthrough().safeParse(item);
          if (!row.success || !row.data.from?.hash) return [];
          return [{ blockNum: `0x${row.data.block_number.toString(16)}`, uniqueId: `${row.data.transaction_hash}:${row.data.index ?? 0}`, hash: row.data.transaction_hash, from: row.data.from.hash, to: row.data.to?.hash ?? null, value: null, asset: "ETH", category: "internal", rawContract: { value: row.data.value, decimal: 18 }, metadata: { blockTimestamp: row.data.timestamp ?? undefined } }];
        }).filter((row) => BigInt(row.blockNum) >= fromBlock && (toBlock === "latest" || BigInt(row.blockNum) <= toBlock));
        return { rows, pageKey: parsed.next_page_params ? Buffer.from(JSON.stringify(parsed.next_page_params), "utf8").toString("base64url") : undefined };
      }
      await config.limiter.acquire(1, "BACKGROUND");
      const response = await fetcher(`${baseUrl}/${config.apiKey}`, { method: "POST", signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "alchemy_getAssetTransfers", params: [{ fromBlock: hexBlock(fromBlock), toBlock: hexBlock(toBlock), fromAddress: address, category: [category], withMetadata: true, excludeZeroValue: false, maxCount: "0x3e8", ...(pageKey ? { pageKey } : {}) }] }) });
      if (!response.ok) throw new RobinhoodProviderError(response.status === 429 ? "RATE_LIMITED" : response.status >= 500 ? "SERVER_ERROR" : "BAD_REQUEST", `Robinhood provider HTTP ${response.status}`);
      const parsed = transfersResponseSchema.parse(await response.json());
      return { rows: parsed.result.transfers, pageKey: parsed.result.pageKey };
    },
    async transaction(hash, signal) { const parsed = rpcResponseSchema.parse(await post(rpcUrl, { jsonrpc: "2.0", id: 1, method: "eth_getTransactionByHash", params: [hash] }, "BACKGROUND", signal)); return parsed.result && typeof parsed.result === "object" ? parsed.result as Record<string, unknown> : null; },
    async receipt(hash, signal) { const parsed = rpcResponseSchema.parse(await post(rpcUrl, { jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [hash] }, "BACKGROUND", signal)); return parsed.result && typeof parsed.result === "object" ? parsed.result as Record<string, unknown> : null; },
    async tokenMetadata(address, signal) { const parsed = tokenMetadataSchema.parse(await post(baseUrl + "/" + config.apiKey, { jsonrpc: "2.0", id: 1, method: "alchemy_getTokenMetadata", params: [address] }, "INTERACTIVE", signal)); return { name: parsed.result.name ?? null, symbol: parsed.result.symbol ?? null, decimals: parsed.result.decimals ?? null }; },
    async rpc(method, params, signal) { const parsed = rpcResponseSchema.parse(await post(rpcUrl, { jsonrpc: "2.0", id: 1, method, params }, "INTERACTIVE", signal)); return parsed.result; },
  };
}

export function transferToAddress(value: string): Address { return asAddress(value); }
export { rawValue };
