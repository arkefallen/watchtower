// src/lib/rules/t1-armed-entry.ts
import type { RuleContext, RuleFinding } from "./types";
import { buildDedupeKey } from "./dedupe";
import { ALERT_RULES_METADATA, getTxExplorerUrl } from "./evidence";
import { parseUsd, satisfiesUsdThreshold } from "./guards";

/**
 * T1 Armed Entry:
 * Wallet state is currently ARMED, and a `BUY` occurs on a token whose age < t1MaxTokenAgeDays (default 7d)
 * with position size >= t1MinPositionUsd (default $500).
 * Null token age suppresses the rule. Strict < for token age.
 * Fires TRIGGERED.
 */
export function evaluateT1ArmedEntry(ctx: RuleContext): RuleFinding[] {
  if (ctx.state.current !== "ARMED") {
    return [];
  }

  const maxTokenAgeDays = ctx.thresholds.t1MaxTokenAgeDays;
  const minPositionUsd = ctx.thresholds.t1MinPositionUsd;
  const findings: RuleFinding[] = [];

  for (const e of ctx.events) {
    if (e.kind !== "BUY") continue;

    // Null token age suppresses the rule (§4.6)
    if (e.tokenAgeSeconds === null || e.tokenAgeSeconds === undefined) {
      continue;
    }

    const tokenAgeDays = e.tokenAgeSeconds / 86400;
    // Strict < comparison: 7 days exactly does NOT fire
    if (tokenAgeDays >= maxTokenAgeDays) {
      continue;
    }

    if (!satisfiesUsdThreshold(e.amountUsd, minPositionUsd)) {
      continue;
    }

    const amountNum = parseUsd(e.amountUsd) ?? 0;
    const occurredAt = e.timestamp;
    const meta = ALERT_RULES_METADATA.T1;
    const txHash = e.txHash ?? "0xt1armedentry";

    const dedupeKey = buildDedupeKey({
      type: "T1",
      walletAddress: ctx.wallet.address,
      chain: ctx.wallet.chain,
      tokenAddress: e.tokenAddress ?? null,
      occurredAt,
      windowHours: 24,
    });

    findings.push({
      type: "T1",
      state: "TRIGGERED",
      occurredAt,
      token: e.tokenAddress
        ? {
            address: e.tokenAddress,
            chain: e.chain ?? ctx.wallet.chain,
            symbol: e.tokenSymbol ?? null,
          }
        : null,
      amountUsd: amountNum.toFixed(2),
      clusterId: ctx.cluster?.id ?? null,
      payload: {
        tokenAddress: e.tokenAddress,
        tokenSymbol: e.tokenSymbol,
        tokenAgeDays,
        maxTokenAgeDays,
        amountUsd: amountNum,
        minPositionUsd,
      },
      evidence: {
        ruleId: "T1",
        ruleText: meta.fullRuleText,
        thresholds: {
          maxTokenAgeDays,
          minPositionUsd,
        },
        observed: {
          tokenAgeDays: tokenAgeDays.toFixed(2),
          positionUsd: amountNum.toFixed(2),
          tokenAddress: e.tokenAddress ?? "unknown",
        },
        txLinks: [
          {
            hash: txHash,
            url: getTxExplorerUrl(txHash, e.chain ?? ctx.wallet.chain),
            label: `Armed entry buy $${amountNum.toFixed(2)} on ${e.tokenSymbol ?? "token"} (age ${tokenAgeDays.toFixed(1)}d)`,
          },
        ],
      },
      dedupeKey,
    });
  }

  return findings;
}
