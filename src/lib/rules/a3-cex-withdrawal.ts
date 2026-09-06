// src/lib/rules/a3-cex-withdrawal.ts
import type { RuleContext, RuleFinding } from "./types";
import { buildDedupeKey } from "./dedupe";
import { ALERT_RULES_METADATA, getTxExplorerUrl } from "./evidence";
import { parseUsd, satisfiesUsdThreshold } from "./guards";

/**
 * A3 CEX Withdrawal:
 * Inflow from a labeled CEX entity >= a3MinCexWithdrawalUsd ($1,000).
 * Fires ARMED, naming the entity and linking the transaction.
 */
export function evaluateA3CexWithdrawal(ctx: RuleContext): RuleFinding[] {
  const thresholdUsd = ctx.thresholds.a3MinCexWithdrawalUsd;
  const findings: RuleFinding[] = [];

  // Check fundingEvents first
  for (const f of ctx.fundingEvents) {
    if (f.fromEntityKind !== "CEX") continue;
    if (!satisfiesUsdThreshold(f.amountUsd, thresholdUsd)) continue;

    const amountNum = parseUsd(f.amountUsd) ?? 0;
    const occurredAt = f.at;
    const meta = ALERT_RULES_METADATA.A3;
    const entityName = f.fromEntityName ?? "CEX";
    const txHash = f.txHash ?? "0xcexwithdrawal";

    const dedupeKey = buildDedupeKey({
      type: "A3",
      walletAddress: ctx.wallet.address,
      chain: ctx.wallet.chain,
      tokenAddress: null,
      occurredAt,
      windowHours: 24,
    });

    findings.push({
      type: "A3",
      state: "ARMED",
      occurredAt,
      token: null,
      amountUsd: amountNum.toFixed(2),
      clusterId: ctx.cluster?.id ?? null,
      payload: {
        amountUsd: amountNum,
        thresholdUsd,
        entityName,
        fromAddress: f.from,
      },
      evidence: {
        ruleId: "A3",
        ruleText: meta.fullRuleText,
        thresholds: {
          minCexWithdrawalUsd: thresholdUsd,
        },
        observed: {
          withdrawalUsd: amountNum.toFixed(2),
          cexEntity: entityName,
          fromAddress: f.from,
        },
        txLinks: [
          {
            hash: txHash,
            url: getTxExplorerUrl(txHash, ctx.wallet.chain),
            label: `CEX withdrawal from ${entityName} ($${amountNum.toFixed(2)})`,
          },
        ],
      },
      dedupeKey,
    });
  }

  // Also check movement events of kind CEX_WITHDRAWAL or with counterpartyEntityKind === 'CEX'
  for (const e of ctx.events) {
    const isCexKind = e.counterpartyEntityKind === "CEX" || e.kind === "CEX_WITHDRAWAL";
    if (!isCexKind) continue;
    if (!satisfiesUsdThreshold(e.amountUsd, thresholdUsd)) continue;

    const amountNum = parseUsd(e.amountUsd) ?? 0;
    const occurredAt = e.timestamp;
    const meta = ALERT_RULES_METADATA.A3;
    const entityName = e.counterpartyEntityName ?? "CEX";
    const txHash = e.txHash ?? "0xcexwithdrawal";

    const dedupeKey = buildDedupeKey({
      type: "A3",
      walletAddress: ctx.wallet.address,
      chain: ctx.wallet.chain,
      tokenAddress: null,
      occurredAt,
      windowHours: 24,
    });

    // Avoid duplicate if same event was already captured from fundingEvents
    if (findings.some((f) => f.dedupeKey === dedupeKey)) continue;

    findings.push({
      type: "A3",
      state: "ARMED",
      occurredAt,
      token: null,
      amountUsd: amountNum.toFixed(2),
      clusterId: ctx.cluster?.id ?? null,
      payload: {
        amountUsd: amountNum,
        thresholdUsd,
        entityName,
        fromAddress: e.counterpartyAddress ?? "unknown",
      },
      evidence: {
        ruleId: "A3",
        ruleText: meta.fullRuleText,
        thresholds: {
          minCexWithdrawalUsd: thresholdUsd,
        },
        observed: {
          withdrawalUsd: amountNum.toFixed(2),
          cexEntity: entityName,
          fromAddress: e.counterpartyAddress ?? "unknown",
        },
        txLinks: [
          {
            hash: txHash,
            url: getTxExplorerUrl(txHash, e.chain ?? ctx.wallet.chain),
            label: `CEX withdrawal from ${entityName} ($${amountNum.toFixed(2)})`,
          },
        ],
      },
      dedupeKey,
    });
  }

  return findings;
}
