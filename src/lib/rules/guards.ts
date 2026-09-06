// src/lib/rules/guards.ts

/**
 * Shared helper: null USD never satisfies a >= threshold comparison (§4.6, Risk R2).
 * Unpriced ≠ zero; null USD is strictly insufficient evidence to fire an alert.
 */
export function satisfiesUsdThreshold(
  amountUsd: string | number | null | undefined,
  threshold: number,
): boolean {
  if (amountUsd === null || amountUsd === undefined) {
    return false;
  }
  const numeric = typeof amountUsd === "number" ? amountUsd : parseFloat(amountUsd);
  if (isNaN(numeric)) {
    return false;
  }
  return numeric >= threshold;
}

/**
 * Parses numeric USD value safely, returning null if invalid or null/undefined.
 */
export function parseUsd(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  const num = typeof val === "number" ? val : parseFloat(val);
  return isNaN(num) ? null : num;
}
