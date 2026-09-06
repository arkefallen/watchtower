// src/lib/rules/c4-campaign-spent.ts
import type { RuleContext, RuleFinding } from "./types";
import { buildDedupeKey } from "./dedupe";
import { ALERT_RULES_METADATA, getTxExplorerUrl } from "./evidence";
import { parseUsd } from "./guards";

/**
 * C4 Campaign Spent:
 * Within c4WindowHours (default 48h) after a TRIGGERED event, the wallet's stable balance falls
 * strictly > c4DropPct (default 70%) from stablePeakUsd (peak recorded since arming).
 * Emits EXIT_RISK.
 */
export function evaluateC4CampaignSpent(ctx: RuleContext): RuleFinding[] {
  if (!ctx.state.triggeredAt) {
    return [];
  }

  const windowHours = ctx.thresholds.c4WindowHours;
  const windowMs = windowHours * 3600 * 1000;
  const timeSinceTriggerMs = ctx.now.getTime() - ctx.state.triggeredAt.getTime();

  // Must be within c4WindowHours after the trigger event
  if (timeSinceTriggerMs < 0 || timeSinceTriggerMs > windowMs) {
    return [];
  }

  const peakUsd = parseUsd(ctx.state.stablePeakUsd);
  if (peakUsd === null || peakUsd <= 0) {
    return [];
  }

  const currentStableUsd = parseUsd(ctx.stats.stableBalanceUsd);
  if (currentStableUsd === null) {
    return [];
  }

  const dropPct = ((peakUsd - currentStableUsd) / peakUsd) * 100;
  // Strict > check: 70% does NOT fire, 71% fires
  if (dropPct <= ctx.thresholds.c4DropPct) {
    return [];
  }

  const occurredAt = ctx.now;
  const meta = ALERT_RULES_METADATA.C4;
  const minDropPct = ctx.thresholds.c4DropPct;

  const dedupeKey = buildDedupeKey({
    type: "C4",
    walletAddress: ctx.wallet.address,
    chain: ctx.wallet.chain,
    tokenAddress: null,
    occurredAt,
    windowHours,
  });

  return [
    {
      type: "C4",
      state: "EXIT_RISK",
      occurredAt,
      token: null,
      amountUsd: currentStableUsd.toFixed(2),
      clusterId: ctx.cluster?.id ?? null,
      payload: {
        stablePeakUsd: peakUsd,
        currentStableUsd,
        dropPct,
        minDropPct,
        windowHours,
        timeSinceTriggerHours: timeSinceTriggerMs / 3600000,
      },
      evidence: {
        ruleId: "C4",
        ruleText: meta.fullRuleText,
        thresholds: {
          minDropPct,
          windowHours,
        },
        observed: {
          stablePeakUsd: peakUsd.toFixed(2),
          currentStableUsd: currentStableUsd.toFixed(2),
          dropPct: `${dropPct.toFixed(1)}%`,
          timeSinceTrigger: `${(timeSinceTriggerMs / 3600000).toFixed(1)}h`,
        },
        txLinks: [
          {
            hash: "0xcampaignspent",
            url: getTxExplorerUrl("0xcampaignspent", ctx.wallet.chain),
            label: `Stable balance dropped ${dropPct.toFixed(1)}% from peak $${peakUsd.toFixed(2)} to $${currentStableUsd.toFixed(2)}`,
          },
        ],
        windows: {
          window: `${windowHours}h`,
        },
      },
      dedupeKey,
    },
  ];
}
