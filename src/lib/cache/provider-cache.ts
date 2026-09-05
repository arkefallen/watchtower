import { createHash } from "node:crypto";

export interface ProviderCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  keyFor(provider: string, endpoint: string, params: Record<string, unknown>): string;
}

export interface CacheRedis {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, mode: "PX", ttlMs: number) => Promise<unknown>;
}

export interface CacheStore {
  findUnique: (args: { where: { cacheKey: string } }) => Promise<{ payload: unknown; expiresAt: Date | null } | null>;
  upsert: (args: { where: { cacheKey: string }; create: { cacheKey: string; provider: string; endpoint: string; paramsJson: unknown; payload: unknown; expiresAt: Date }; update: { payload: unknown; expiresAt: Date } }) => Promise<unknown>;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function createProviderCache(redis: CacheRedis, cold: CacheStore, now = () => new Date()): ProviderCache {
  return {
    keyFor(provider, endpoint, params) {
      return createHash("sha256").update(`${provider}|${endpoint}|${stable(params)}`).digest("hex");
    },
    async get<T>(key: string): Promise<T | null> {
      const hot = await redis.get(key);
      if (hot) return JSON.parse(hot) as T;
      const row = await cold.findUnique({ where: { cacheKey: key } });
      if (!row || (row.expiresAt && row.expiresAt <= now())) return null;
      return row.payload as T;
    },
    async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
      const expiresAt = new Date(now().getTime() + ttlMs);
      await redis.set(key, JSON.stringify(value), "PX", ttlMs);
      await cold.upsert({
        where: { cacheKey: key },
        create: { cacheKey: key, provider: "etherscan", endpoint: "unknown", paramsJson: {}, payload: value, expiresAt },
        update: { payload: value, expiresAt },
      });
    },
  };
}
