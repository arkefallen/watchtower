import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ENV_KEYS, parseEnv } from "../../src/lib/env";

const requiredEnv = {
  DATABASE_URL: "postgresql://watchtower:watchtower@localhost:5432/watchtower",
  REDIS_URL: "redis://localhost:6379",
  ETHERSCAN_API_KEY: "test-etherscan-key",
};

describe("environment validation", () => {
  it("rejects missing DATABASE_URL with the key name", () => {
    expect(() => parseEnv({ ...requiredEnv, DATABASE_URL: undefined })).toThrow(
      "Missing required environment variable: DATABASE_URL",
    );
  });

  it("rejects missing ETHERSCAN_API_KEY with the key name", () => {
    expect(() =>
      parseEnv({ ...requiredEnv, ETHERSCAN_API_KEY: undefined }),
    ).toThrow("Missing required environment variable: ETHERSCAN_API_KEY");
  });

  it("allows absent optional Telegram and CoinGecko keys", () => {
    const parsed = parseEnv(requiredEnv);

    expect(parsed.COINGECKO_API_KEY).toBeUndefined();
    expect(parsed.TELEGRAM_BOT_TOKEN).toBeUndefined();
    expect(parsed.TELEGRAM_CHAT_ID).toBeUndefined();
  });

  it("lists every schema key exactly once in .env.example", () => {
    const contents = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");
    const keys = contents
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1])
      .filter((key): key is string => key !== undefined);

    expect(keys).toHaveLength(ENV_KEYS.length);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(keys)).toEqual(new Set(ENV_KEYS));
  });

  it("requires DEFAULT_CHAIN to be a known ChainSlug", () => {
    expect(() => parseEnv({ ...requiredEnv, DEFAULT_CHAIN: "unknown" })).toThrow(
      /DEFAULT_CHAIN/,
    );
    expect(parseEnv({ ...requiredEnv, DEFAULT_CHAIN: "base" }).DEFAULT_CHAIN).toBe(
      "base",
    );
  });
});
