// src/server/services/alert/peak.ts
import { parseUsd } from "@/lib/rules/guards";

export interface StablePeak {
  peakUsd: string;
  peakAt: Date;
}

/**
 * Resets or initializes stable peak when a wallet transitions to ARMED.
 * On arming, previous peak is reset to initial balance (or 0) at the arming timestamp.
 */
export function resetStablePeakOnArming(
  initialBalanceUsd?: string | number | null,
  armedAt: Date = new Date()
): StablePeak {
  const usdNum = parseUsd(initialBalanceUsd) ?? 0;
  return {
    peakUsd: usdNum.toFixed(2),
    peakAt: armedAt,
  };
}

/**
 * Updates the stable peak tracker with a new balance snapshot.
 * If the new snapshot balance strictly exceeds current peak, updates peak value and peakAt timestamp.
 */
export function updateStablePeak(
  currentPeak: StablePeak | null,
  snapshot: { balanceUsd: string | number | null | unknown; timestamp: Date }
): StablePeak | null {
  const balanceNum = parseUsd(snapshot.balanceUsd as string | number | null | undefined);
  if (balanceNum === null) return currentPeak;

  if (!currentPeak) {
    return {
      peakUsd: balanceNum.toFixed(2),
      peakAt: snapshot.timestamp,
    };
  }

  const currentPeakNum = parseFloat(currentPeak.peakUsd);
  if (balanceNum > currentPeakNum) {
    return {
      peakUsd: balanceNum.toFixed(2),
      peakAt: snapshot.timestamp,
    };
  }

  return currentPeak;
}

/**
 * Computes the maximum stable balance snapshot since arming, returning the peak value with its timestamp.
 */
export function computeStablePeakSinceArmed(
  snapshots: Array<{ balanceUsd: string | number | null | unknown; timestamp: Date }>,
  armedAt: Date
): StablePeak | null {
  const afterArming = snapshots.filter((s) => s.timestamp.getTime() >= armedAt.getTime());
  if (afterArming.length === 0) return null;

  let maxPeak: StablePeak | null = null;
  for (const s of afterArming) {
    maxPeak = updateStablePeak(maxPeak, s);
  }
  return maxPeak;
}
