import { isAddress } from "viem";
import type { ChainSlug } from "@/lib/chains/types";
import type { Chain } from "@/generated/prisma/client";

export class InvalidAddressError extends Error {
  constructor(address: string, reason?: string) {
    super(`Invalid EVM address '${address}'${reason ? `: ${reason}` : ""}`);
    this.name = "InvalidAddressError";
  }
}

export function normalizeAddress(address: string): `0x${string}` {
  const trimmed = address.trim();
  if (!trimmed.startsWith("0x") || trimmed.length !== 42) {
    throw new InvalidAddressError(address, "Must be 42 characters hex starting with 0x");
  }
  if (!isAddress(trimmed, { strict: false })) {
    throw new InvalidAddressError(address, "Not a valid hex address");
  }
  return trimmed.toLowerCase() as `0x${string}`;
}

export function normalizeChain(chain: string): ChainSlug {
  const lower = chain.trim().toLowerCase();
  if (lower === "base" || lower === "bsc" || lower === "robinhood") {
    return lower as ChainSlug;
  }
  throw new Error(`Unsupported chain: ${chain}`);
}

export function chainSlugToPrisma(chain: ChainSlug | string): Chain {
  const lower = chain.trim().toLowerCase();
  switch (lower) {
    case "base":
      return "BASE";
    case "bsc":
      return "BSC";
    case "robinhood":
      return "ROBINHOOD";
    default:
      throw new Error(`Unsupported chain slug for Prisma: ${chain}`);
  }
}

export function prismaToChainSlug(chain: Chain | string): ChainSlug {
  const lower = chain.trim().toLowerCase();
  switch (lower) {
    case "base":
      return "base";
    case "bsc":
      return "bsc";
    case "robinhood":
      return "robinhood";
    default:
      throw new Error(`Unsupported Prisma chain enum: ${chain}`);
  }
}
