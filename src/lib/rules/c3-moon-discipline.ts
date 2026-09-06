// src/lib/rules/c3-moon-discipline.ts
import type { RuleContext, RuleFinding } from "./types";
import { buildDedupeKey } from "./dedupe";
import { ALERT_RULES_METADATA, getTxExplorerUrl } from "./evidence";
import { parseUsd } from "./guards";

/**
 * C3 Moon Discipline (Decision D-7):
 * Open position with unrealizedMultiple > c3MinMultiple (default 10x) and older than c3MinAgeDays (default 3d).
 * Strict > for both multiple and age.
 * Evaluates all tracked wallets by default; c3SelfOnly suppresses non-self wallets.
 * Findings for isSelf carry prominent markers (selfPriority: true).
 * Deduped daily (24h bucket). Emits EXIT_RISK.
 */
export function evaluateC3MoonDiscipline(ctx: RuleContext): RuleFinding[] {
  // If c3SelfOnly is enabled, suppress for non-self wallets
  if (ctx.thresholds.c3SelfOnly && !ctx.wallet.isSelf) {
    return [];
  }

  const minMultiple = ctx.thresholds.c3MinMultiple;
  const minAgeDays = ctx.thresholds.c3MinAgeDays;
  const findings: RuleFinding[] = [];

  for (const p of ctx.positions) {
    if (!p.isOpen) continue;

    const multiple = parseUsd(p.unrealizedMultiple);
    if (multiple === null) continue;

    // Strict > check: 10.0x does NOT fire
    if (multiple <= minMultiple) {
      continue;
    }

    const ageMs = ctx.now.getTime() - p.openedAt.getTime();
    const ageDays = ageMs / (86400 * 1000);

    // Strict > check: 3.0 days or less does NOT fire
    if (ageDays <= minAgeDays) {
      continue;
    }

    const occurredAt = ctx.now;
    const meta = ALERT_RULES_METADATA.C3;
    const isSelf = Boolean(ctx.wallet.isSelf);

    const dedupeKey = buildDedupeKey({
      type: "C3",
      walletAddress: ctx.wallet.address,
      chain: ctx.wallet.chain,
      tokenAddress: p.tokenAddress,
      occurredAt,
      windowHours: 24, // Once per day
    });

    findings.push({
      type: "C3",
      state: "EXIT_RISK",
      occurredAt,
      token: {
        address: p.tokenAddress,
        chain: p.tokenChain ?? ctx.wallet.chain,
        symbol: p.tokenSymbol ?? null,
      },
      amountUsd: p.unrealizedUsd ?? null,
      clusterId: ctx.cluster?.id ?? null,
      payload: {
        tokenAddress: p.tokenAddress,
        tokenSymbol: p.tokenSymbol,
        unrealizedMultiple: multiple,
        minMultiple,
        ageDays,
        minAgeDays,
        isSelf,
        selfPriority: isSelf,
        prominent: isSelf,
      },
      evidence: {
        ruleId: "C3",
        ruleText: meta.fullRuleText,
        thresholds: {
          minMultiple,
          minAgeDays,
        },
        observed: {
          tokenAddress: p.tokenAddress,
          tokenSymbol: p.tokenSymbol ?? "token",
          unrealizedMultiple: `${multiple.toFixed(1)}x`,
          positionAgeDays: `${ageDays.toFixed(1)}d`,
          isSelf: isSelf ? "TRUE" : "FALSE",
        },
        txLinks: [
          {
            hash: "0xmoondiscipline",
            url: getTxExplorerUrl("0xmoondiscipline", p.tokenChain ?? ctx.wallet.chain),
            label: `Open position on ${p.tokenSymbol ?? "token"} reached ${multiple.toFixed(1)}x over ${Math.floor(ageDays)}d`,
          },
        ],
        windows: {
          cadence: "24h",
        },
      },
      dedupeKey,
    });
  }

  return findings;
}
