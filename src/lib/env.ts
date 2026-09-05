import { z } from "zod";

import { ConfigurationError } from "./errors";

export const ENV_KEYS = [
  "DATABASE_URL",
  "REDIS_URL",
  "ETHERSCAN_API_KEY",
  "ALCHEMY_API_KEY",
  "BLOCKSCOUT_API_KEY",
  "DEXSCREENER_ENABLED",
  "COINGECKO_API_KEY",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "APP_TIMEZONE",
  "DEFAULT_CHAIN",
] as const;

export type EnvKey = (typeof ENV_KEYS)[number];
export type EnvInput = Record<string, string | undefined>;

const requiredString = z.preprocess(
  (value: unknown) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().min(1),
);

const optionalString = z.preprocess(
  (value: unknown) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().min(1).optional(),
);

const booleanFromEnv = z.preprocess((value: unknown) => {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean());

export const envSchema = z.object({
  DATABASE_URL: requiredString,
  REDIS_URL: requiredString,
  ETHERSCAN_API_KEY: requiredString,
  ALCHEMY_API_KEY: optionalString,
  BLOCKSCOUT_API_KEY: optionalString,
  DEXSCREENER_ENABLED: booleanFromEnv.default(true),
  COINGECKO_API_KEY: optionalString,
  TELEGRAM_BOT_TOKEN: optionalString,
  TELEGRAM_CHAT_ID: optionalString,
  APP_TIMEZONE: requiredString.default("Asia/Jakarta"),
  DEFAULT_CHAIN: z
    .enum(["ethereum", "base", "bsc", "robinhood"])
    .default("base"),
});

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(input: EnvInput): AppEnv {
  const result = envSchema.safeParse(input);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  const key = issue?.path[0];
  if (typeof key === "string" && input[key] === undefined) {
    throw new ConfigurationError(
      `Missing required environment variable: ${key}`,
    );
  }

  throw new ConfigurationError(
    `Invalid environment variable${typeof key === "string" ? ` ${key}` : ""}: ${issue?.message ?? "unknown validation error"}`,
  );
}

export function loadEnv(): AppEnv {
  return parseEnv(process.env);
}
