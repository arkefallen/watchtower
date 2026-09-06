// src/lib/rules/t3-fresh-launch.ts
import type { RuleContext, RuleFinding } from "./types";
import { buildDedupeKey } from "./dedupe";
import { ALERT_RULES_METADATA, getTxExplorerUrl } from "./evidence";
import { parseUsd } from "./guards";
import { isWalletGraded } from "./graded";

/**
 * T3 Fresh-Launch Entry:
 * Graded wallet buys a token whose age < t3MaxTokenAgeMinutes (default 60m).
 * Null token age suppresses the rule. Strict < for token age.
 * Fires TRIGGERED.
 */
export function evaluateT3FreshLaunch(ctx: RuleContext): RuleFinding[] {
  const gradedDef = ctx.gradedDefinition ?? ctx.thresholds.gradedDefinition ?? "ANY_TAG_OR_COMPUTED";
  if (!isWalletGraded(ctx.wallet, gradedDef)) {
    return [];
  }

  const maxTokenAgeMinutes = ctx.thresholds.t3MaxTokenAgeMinutes;
  const findings: RuleFinding[] = [];

  for (const e of ctx.events) {
    if (e.kind !== "BUY" || !e.tokenAddress) continue;

    // Null token age suppresses the rule
    if (e.tokenAgeSeconds === null || e.tokenAgeSeconds === undefined) {
      continue;
    }

    const tokenAgeMinutes = e.tokenAgeSeconds / 60;
    // Strict < comparison: 60m or 61m does NOT fire, 59m fires
    if (tokenAgeMinutes >= maxTokenAgeMinutes) {
      continue;
    }

    const amountNum = parseUsd(e.amountUsd) ?? 0;
    const occurredAt = e.timestamp;
    const meta = ALERT_RULES_METADATA.T3;
    const txHash = e.txHash ?? "0xt3freshlaunch";

    const dedupeKey = buildDedupeKey({
      type: "T3",
      walletAddress: ctx.wallet.address,
      chain: ctx.wallet.chain,
      tokenAddress: e.tokenAddress,
      occurredAt,
      windowHours: 24,
    });

    findings.push({
      type: "T3",
      state: "TRIGGERED",
      occurredAt,
      token: {
        address: e.tokenAddress,
        chain: e.chain ?? ctx.wallet.chain,
        symbol: e.tokenSymbol ?? null,
      },
      amountUsd: e.amountUsd ?? null,
      clusterId: ctx.cluster?.id ?? null,
      payload: {
        tokenAddress: e.tokenAddress,
        tokenSymbol: e.tokenSymbol,
        tokenAgeMinutes,
        maxTokenAgeMinutes,
        amountUsd: amountNum,
      },
      evidence: {
        ruleId: "T3",
        ruleText: meta.fullRuleText,
        thresholds: {
          maxTokenAgeMinutes,
        },
        observed: {
          tokenAddress: e.tokenAddress,
          tokenAgeMinutes: Math.round(tokenAgeMinutes),
          amountUsd: amountNum.toFixed(2),
        },
        txLinks: [
          {
            hash: txHash,
            url: getTxExplorerUrl(txHash, e.chain ?? ctx.wallet.chain),
            label: `Fresh-launch entry on ${e.tokenSymbol ?? "token"} (age ${tokenAgeMinutes.toFixed(1)}m)`,
          },
        ],
      },
      dedupeKey,
    });
  }

  return findings;
}
