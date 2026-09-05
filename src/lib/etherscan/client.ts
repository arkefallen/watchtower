import { z } from "zod";

import type { ProviderCache } from "@/lib/cache/provider-cache";
import type { CallPriority, RateLimiter } from "@/lib/ratelimit";
import { EtherscanClientError, classifyEtherscanMessage, type EtherscanErrorCode } from "./errors";
import { fetchAllPages as walkPages, type PaginationOptions, type PaginationRequest, type PaginationResult } from "./pagination";

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: "full";
  retryableErrors: EtherscanErrorCode[];
}

export interface EtherscanPageRequest {
  chainId: number;
  module: "account" | "contract" | "token" | "block" | "stats" | "proxy";
  action: string;
  params: Record<string, string | number | bigint>;
  page: number;
  offset: number;
  priority: CallPriority;
  signal?: AbortSignal;
  cacheTtlMs: number;
}

export interface UsageRecorder {
  record(provider: string, outcome: "ok" | "error" | "rate_limited", records: number): Promise<void>;
}

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

const responseSchema = z.object({
  status: z.string(),
  message: z.string(),
  result: z.unknown(),
});

export interface EtherscanClientConfig {
  apiKey: string;
  baseUrl: string;
  limiter: RateLimiter;
  cache: ProviderCache;
  pageCap: number;
  retry: RetryPolicy;
  usage: UsageRecorder;
  logger: Logger;
  fetcher?: typeof fetch;
}

const defaultLogger: Logger = { debug() {}, info() {}, warn() {}, error() {} };

function queryParams(req: EtherscanPageRequest, apiKey: string): Record<string, string> {
  const params: Record<string, string> = { module: req.module, action: req.action, chainid: String(req.chainId), page: String(req.page), offset: String(req.offset), apikey: apiKey };
  for (const [key, value] of Object.entries(req.params)) params[key] = typeof value === "bigint" ? value.toString() : String(value);
  return params;
}

function retryable(code: EtherscanErrorCode, policy: RetryPolicy): boolean {
  return policy.retryableErrors.includes(code);
}

export function createEtherscanClient(config: EtherscanClientConfig) {
  const logger = config.logger ?? defaultLogger;
  const fetcher = config.fetcher ?? fetch;
  const api = {
    async fetchPage<T>(req: EtherscanPageRequest): Promise<{ rows: T[]; fromCache: boolean }> {
      const params = queryParams(req, config.apiKey);
      const cacheKey = config.cache.keyFor("etherscan", `${req.module}.${req.action}`, params);
      if (req.cacheTtlMs > 0) {
        const cached = await config.cache.get<T[]>(cacheKey);
        if (cached) return { rows: cached, fromCache: true };
      }
      let attempt = 0;
      while (attempt < config.retry.maxAttempts) {
        attempt += 1;
        await config.limiter.acquire(1, req.priority);
        try {
          const url = `${config.baseUrl}?${new URLSearchParams(params)}`;
          const response = await fetcher(url, { signal: req.signal });
          if (!response.ok) {
            const code: EtherscanErrorCode = response.status >= 500 ? "SERVER_ERROR" : response.status === 429 ? "RATE_LIMITED" : "BAD_REQUEST";
            throw new EtherscanClientError(code, `Etherscan HTTP ${response.status}`);
          }
          const parsed = responseSchema.parse(await response.json());
          const message = parsed.message;
          const code = parsed.status === "0" ? classifyEtherscanMessage(message) : null;
          if (code && code !== "EMPTY_RESULT") throw new EtherscanClientError(code, message);
          const rows = code === "EMPTY_RESULT" ? [] : (Array.isArray(parsed.result) ? z.array(z.unknown()).parse(parsed.result) : [parsed.result]) as T[];
          await config.usage.record("etherscan", "ok", rows.length);
          if (req.cacheTtlMs > 0) await config.cache.set(cacheKey, rows, req.cacheTtlMs);
          return { rows, fromCache: false };
        } catch (error) {
          const clientError = error instanceof EtherscanClientError ? error : new EtherscanClientError(error instanceof TypeError ? "NETWORK" : "UNKNOWN", error instanceof Error ? error.message : "Unknown Etherscan error");
          await config.usage.record("etherscan", clientError.code === "RATE_LIMITED" ? "rate_limited" : "error", 0);
          if (clientError.code === "RATE_LIMITED" && "brake" in config.limiter) await (config.limiter as RateLimiter & { brake: () => Promise<void> }).brake();
          if (!retryable(clientError.code, config.retry) || attempt >= config.retry.maxAttempts) throw clientError;
          const maxDelay = Math.min(config.retry.maxDelayMs, config.retry.baseDelayMs * 2 ** (attempt - 1));
          await new Promise<void>((resolve) => setTimeout(resolve, Math.floor(Math.random() * maxDelay)));
          logger.warn("Retrying Etherscan request", { attempt, code: clientError.code });
        }
      }
      throw new EtherscanClientError("UNKNOWN", "Etherscan request exhausted retries");
    },
    async fetchAllPages<T>(
      req: Omit<EtherscanPageRequest, "page"> & { fromBlock: bigint; toBlock: bigint },
      options: PaginationOptions<T>,
    ): Promise<PaginationResult<T>> {
      return walkPages(
        { fromBlock: req.fromBlock, toBlock: req.toBlock, priority: req.priority, signal: req.signal } satisfies PaginationRequest,
        options,
        async ({ page, fromBlock, toBlock }) => {
          const result = await api.fetchPage<T>({
            ...req,
            params: { ...req.params, fromBlock: fromBlock.toString(), toBlock: toBlock.toString() },
            page,
          });
          return result.rows;
        },
      );
    },
  };
  return api;
}
