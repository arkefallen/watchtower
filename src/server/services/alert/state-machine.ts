// src/server/services/alert/state-machine.ts
import type { AlertType, WalletAlertState } from "@/generated/prisma/client";
import type { RuleFinding, RuleContext } from "@/lib/rules/types";

export interface DeArmCheckResult {
  satisfied: boolean;
  detail?: Record<string, unknown>;
}

export interface StateTransitionResult {
  nextState: WalletAlertState;
  stateReason: AlertType | null;
  transitionOccurred: boolean;
  // Aliases conforming to plan §4.8
  next: WalletAlertState;
  reason: AlertType | "DEARM" | null;
}

/**
 * Applies state machine transition rules with fixed precedence:
 * 1. De-arm condition takes top precedence -> IDLE (reason: 'DEARM', stateReason: null).
 * 2. Any TRIGGERED finding in findings -> TRIGGERED.
 * 3. Any ARMED finding in findings -> ARMED.
 * 4. EXIT_RISK findings never alter wallet state -> current state preserved.
 *
 * transitionOccurred is true if and only if nextState !== current.
 */
export function applyStateTransition(
  current: WalletAlertState,
  findings: RuleFinding[],
  deArm: DeArmCheckResult = { satisfied: false }
): StateTransitionResult {
  if (deArm.satisfied) {
    const nextState: WalletAlertState = "IDLE";
    return {
      nextState,
      stateReason: null,
      transitionOccurred: current !== nextState,
      next: nextState,
      reason: "DEARM",
    };
  }

  const triggeredFinding = findings.find((f) => f.state === "TRIGGERED");
  if (triggeredFinding) {
    const nextState: WalletAlertState = "TRIGGERED";
    return {
      nextState,
      stateReason: triggeredFinding.type,
      transitionOccurred: current !== nextState,
      next: nextState,
      reason: triggeredFinding.type,
    };
  }

  const armedFinding = findings.find((f) => f.state === "ARMED");
  if (armedFinding) {
    const nextState: WalletAlertState = "ARMED";
    return {
      nextState,
      stateReason: armedFinding.type,
      transitionOccurred: current !== nextState,
      next: nextState,
      reason: armedFinding.type,
    };
  }

  // EXIT_RISK findings or no findings: current state remains unchanged
  return {
    nextState: current,
    stateReason: null,
    transitionOccurred: false,
    next: current,
    reason: null,
  };
}

/**
 * Evaluates the de-arm condition per §4.8:
 * 1. Outflow to a terminal entity (funds return) -> de-arms immediately.
 * 2. Stable AND native balance <= deArmBaselinePct% of 30-day baseline for
 *    deArmConsecutiveDays consecutive daily checks -> de-arms.
 */
export function evaluateDeArm(ctx: RuleContext): DeArmCheckResult {
  // Check 1: funds-return event to a terminal entity
  const terminalFunding = ctx.fundingEvents.find((f) => f.isTerminal);
  if (terminalFunding) {
    return {
      satisfied: true,
      detail: {
        reason: "TERMINAL_OUTFLOW",
        to: terminalFunding.from,
        amountUsd: terminalFunding.amountUsd,
      },
    };
  }

  // Check 2: consecutive days streak at/below baseline
  const deArmBaselinePct = ctx.thresholds.deArmBaselinePct ?? 120;
  const deArmConsecutiveDays = ctx.thresholds.deArmConsecutiveDays ?? 7;

  const baselineStable = ctx.state.baselineStableUsd ? parseFloat(ctx.state.baselineStableUsd) : null;
  const baselineNative = ctx.state.baselineNativeUsd ? parseFloat(ctx.state.baselineNativeUsd) : null;
  const currentStable = ctx.stats.stableBalanceUsd ? parseFloat(ctx.stats.stableBalanceUsd) : null;
  const currentNative = ctx.stats.nativeBalanceUsd ? parseFloat(ctx.stats.nativeBalanceUsd) : null;

  if (baselineStable !== null && baselineNative !== null && currentStable !== null && currentNative !== null) {
    const stableThreshold = (baselineStable * deArmBaselinePct) / 100;
    const nativeThreshold = (baselineNative * deArmBaselinePct) / 100;

    const bothAtOrBelow = currentStable <= stableThreshold && currentNative <= nativeThreshold;

    if (bothAtOrBelow && ctx.state.deArmStreakDays >= deArmConsecutiveDays) {
      return {
        satisfied: true,
        detail: {
          reason: "STREAK_SATISFIED",
          streakDays: ctx.state.deArmStreakDays,
          currentStable,
          currentNative,
          stableThreshold,
          nativeThreshold,
        },
      };
    }
  }

  return { satisfied: false };
}
