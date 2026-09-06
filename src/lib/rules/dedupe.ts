// src/lib/rules/dedupe.ts
import type { AlertType } from "@/generated/prisma/client";

/**
 * Builds the canonical dedupe key for an alert firing:
 * `<type>:<walletAddress>:<chain>:<tokenAddress|->:<windowBucket>`
 *
 * Ensures idempotent persistence (NFR-3) and suppresses duplicates
 * for the same logical window.
 */
export function buildDedupeKey(args: {
  type: AlertType | string;
  walletAddress: string;
  chain: string;
  tokenAddress?: string | null;
  occurredAt: Date;
  windowHours: number;
}): string {
  const normType = args.type.toUpperCase();
  const normWallet = args.walletAddress.toLowerCase();
  const normChain = args.chain.toLowerCase();
  const normToken = args.tokenAddress ? args.tokenAddress.toLowerCase() : "-";

  // Bucket = index of the window slice in UTC epoch
  const windowMs = Math.max(1, args.windowHours) * 3600 * 1000;
  const bucket = Math.floor(args.occurredAt.getTime() / windowMs);

  return `${normType}:${normWallet}:${normChain}:${normToken}:${bucket}`;
}
