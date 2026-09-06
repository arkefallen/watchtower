// src/lib/rules/a4-dormancy-wake.ts
import type { RuleContext, RuleFinding } from "./types";
import { buildDedupeKey } from "./dedupe";
import { ALERT_RULES_METADATA, getTxExplorerUrl } from "./evidence";
import { parseUsd, satisfiesUsdThreshold } from "./guards";

/**
 * A4 Dormancy Wake:
 * Wallet inactive >= a4DormancyDays (default 30d) receiving inbound funding >= a4MinFundingUsd (default $500).
 * Dormancy is measured from `lastActivityAt` before the waking event, not after.
 */
export function evaluateA4DormancyWake(ctx: RuleContext): RuleFinding[] {
  const minDormancyDays = ctx.thresholds.a4DormancyDays;
  const minFundingUsd = ctx.thresholds.a4MinFundingUsd;
  const findings: RuleFinding[] = [];

  // Check fundingEvents and incoming movement events (NATIVE_FUNDING_IN, STABLE_PARK, CEX_WITHDRAWAL)
  const candidateEvents: Array<{
    amountUsd: string | null;
    timestamp: Date;
    txHash?: string;
    from?: string;
  }> = [];

  for (const f of ctx.fundingEvents) {
    candidateEvents.push({
      amountUsd: f.amountUsd,
      timestamp: f.at,
      txHash: f.txHash,
      from: f.from,
    });
  }

  for (const e of ctx.events) {
    if (
      e.kind === "NATIVE_FUNDING_IN" ||
      e.kind === "STABLE_PARK" ||
      e.kind === "CEX_WITHDRAWAL"
    ) {
      candidateEvents.push({
        amountUsd: e.amountUsd,
        timestamp: e.timestamp,
        txHash: e.txHash,
        from: e.counterpartyAddress ?? undefined,
      });
    }
  }

  for (const event of candidateEvents) {
    if (!satisfiesUsdThreshold(event.amountUsd, minFundingUsd)) continue;

    // Measure dormancy before this waking event
    let actualDormantDays: number | null = null;
    if (ctx.stats.lastActivityAt) {
      const diffMs = event.timestamp.getTime() - ctx.stats.lastActivityAt.getTime();
      actualDormantDays = diffMs / (86400 * 1000);
    } else if (ctx.stats.dormantDays !== null && ctx.stats.dormantDays !== undefined) {
      actualDormantDays = ctx.stats.dormantDays;
    }

    if (actualDormantDays === null || actualDormantDays < minDormancyDays) {
      continue;
    }

    const amountNum = parseUsd(event.amountUsd) ?? 0;
    const occurredAt = event.timestamp;
    const meta = ALERT_RULES_METADATA.A4;
    const txHash = event.txHash ?? "0xdormancywake";

    const dedupeKey = buildDedupeKey({
      type: "A4",
      walletAddress: ctx.wallet.address,
      chain: ctx.wallet.chain,
      tokenAddress: null,
      occurredAt,
      windowHours: 24,
    });

    if (findings.some((f) => f.dedupeKey === dedupeKey)) continue;

    findings.push({
      type: "A4",
      state: "ARMED",
      occurredAt,
      token: null,
      amountUsd: amountNum.toFixed(2),
      clusterId: ctx.cluster?.id ?? null,
      payload: {
        dormantDays: actualDormantDays,
        minDormancyDays,
        fundingUsd: amountNum,
        minFundingUsd,
        fromAddress: event.from,
      },
      evidence: {
        ruleId: "A4",
        ruleText: meta.fullRuleText,
        thresholds: {
          minDormancyDays,
          minFundingUsd,
        },
        observed: {
          dormantDays: Math.floor(actualDormantDays),
          fundingUsd: amountNum.toFixed(2),
          fromAddress: event.from ?? "unknown",
        },
        txLinks: [
          {
            hash: txHash,
            url: getTxExplorerUrl(txHash, ctx.wallet.chain),
            label: `Waking funding $${amountNum.toFixed(2)} after ${Math.floor(actualDormantDays)}d dormant`,
          },
        ],
      },
      dedupeKey,
    });
  }

  return findings;
}
