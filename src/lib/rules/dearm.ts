// src/lib/rules/dearm.ts
import type { RuleContext } from "./types";
import { parseUsd } from "./guards";

export interface DeArmEvaluationResult {
  satisfied: boolean;
  reason: "BASELINE_7D" | "TERMINAL_OUTFLOW" | null;
  newStreakDays: number;
  detail: {
    terminalOutflowFound?: boolean;
    terminalEntityName?: string | null;
    streakDays: number;
    consecutiveDaysNeeded: number;
    baselinePct: number;
    currentStableUsd?: number | null;
    baselineStableUsd?: number | null;
    currentNativeUsd?: number | null;
    baselineNativeUsd?: number | null;
    stableRatioPct?: number | null;
    nativeRatioPct?: number | null;
  };
}

/**
 * Evaluates the De-Arm condition for an ARMED or TRIGGERED wallet:
 * 1. Immediate de-arm: Outflow to a terminal entity (any outflow to an EntityLabel with isTerminal: true).
 * 2. 7-consecutive-day de-arm: Stable AND native balance <= deArmBaselinePct% (default 120%) of 30-day baseline
 *    for deArmConsecutiveDays (default 7) consecutive daily checks.
 *    A single day above 120% resets the streak to 0.
 */
export function evaluateDeArm(ctx: RuleContext): DeArmEvaluationResult {
  const baselinePct = ctx.thresholds.deArmBaselinePct;
  const consecutiveDaysNeeded = ctx.thresholds.deArmConsecutiveDays;
  const currentStreak = ctx.state.deArmStreakDays ?? 0;

  // Path 1: Check for outflow to a terminal entity
  for (const f of ctx.fundingEvents) {
    if (f.isTerminal) {
      return {
        satisfied: true,
        reason: "TERMINAL_OUTFLOW",
        newStreakDays: 0,
        detail: {
          terminalOutflowFound: true,
          terminalEntityName: f.fromEntityName ?? "Terminal Entity",
          streakDays: currentStreak,
          consecutiveDaysNeeded,
          baselinePct,
        },
      };
    }
  }

  for (const e of ctx.events) {
    // Check for outgoing movements to terminal entity
    if (
      (e.kind === "NATIVE_FUNDING_OUT" || e.kind === "STABLE_SPEND" || e.kind === "CEX_DEPOSIT") &&
      e.counterpartyEntityKind === "CEX" // Or terminal entity
    ) {
      // In events, if marked or labeled as terminal
    }
  }

  // Path 2: 7-day baseline streak evaluation
  const currentStable = parseUsd(ctx.stats.stableBalanceUsd);
  const baselineStable = parseUsd(ctx.state.baselineStableUsd);
  const currentNative = parseUsd(ctx.stats.nativeBalanceUsd);
  const baselineNative = parseUsd(ctx.state.baselineNativeUsd);

  let stableWithinLimit = false;
  let nativeWithinLimit = false;
  let stableRatioPct: number | null = null;
  let nativeRatioPct: number | null = null;

  const thresholdRatio = baselinePct / 100;

  if (baselineStable !== null && currentStable !== null) {
    stableRatioPct = (currentStable / (baselineStable || 1)) * 100;
    stableWithinLimit = currentStable <= baselineStable * thresholdRatio + 1e-9;
  } else if (currentStable === 0 || currentStable === null) {
    // 0 balance is <= baseline
    stableWithinLimit = true;
  }

  if (baselineNative !== null && currentNative !== null) {
    nativeRatioPct = (currentNative / (baselineNative || 1)) * 100;
    nativeWithinLimit = currentNative <= baselineNative * thresholdRatio + 1e-9;
  } else if (currentNative === 0 || currentNative === null) {
    // 0 balance is <= baseline
    nativeWithinLimit = true;
  }

  // Condition requires BOTH stable AND native <= 120% of baseline
  const conditionMet = stableWithinLimit && nativeWithinLimit;

  if (!conditionMet) {
    // A single day above 120% resets the streak
    return {
      satisfied: false,
      reason: null,
      newStreakDays: 0,
      detail: {
        streakDays: 0,
        consecutiveDaysNeeded,
        baselinePct,
        currentStableUsd: currentStable,
        baselineStableUsd: baselineStable,
        currentNativeUsd: currentNative,
        baselineNativeUsd: baselineNative,
        stableRatioPct,
        nativeRatioPct,
      },
    };
  }

  const newStreakDays = currentStreak + 1;
  const satisfied = newStreakDays >= consecutiveDaysNeeded;

  return {
    satisfied,
    reason: satisfied ? "BASELINE_7D" : null,
    newStreakDays,
    detail: {
      streakDays: newStreakDays,
      consecutiveDaysNeeded,
      baselinePct,
      currentStableUsd: currentStable,
      baselineStableUsd: baselineStable,
      currentNativeUsd: currentNative,
      baselineNativeUsd: baselineNative,
      stableRatioPct,
      nativeRatioPct,
    },
  };
}
