/**
 * Formats a numeric USD amount into a compact human-readable string:
 * - $450 (< $1K)
 * - $1.5K (>= $1K)
 * - $2.4M (>= $1M)
 * Exact zero renders "$0".
 */
export function formatCompactUsd(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "$0";
  }
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  if (abs >= 1_000_000) {
    const val = (abs / 1_000_000).toFixed(1).replace(/\.0$/, "");
    return `${sign}$${val}M`;
  }
  if (abs >= 1_000) {
    const val = (abs / 1_000).toFixed(1).replace(/\.0$/, "");
    return `${sign}$${val}K`;
  }
  return `${sign}$${Math.round(abs)}`;
}

/**
 * Formats full USD with cents, e.g. "$45,200.00"
 */
export function formatFullUsd(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "$0.00";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
