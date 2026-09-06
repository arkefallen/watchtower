// src/lib/rules/c1-distribution-prep.ts
import type { RuleContext, RuleFinding } from "./types";
import { buildDedupeKey } from "./dedupe";
import { ALERT_RULES_METADATA, getTxExplorerUrl } from "./evidence";
import { parseUsd, satisfiesUsdThreshold } from "./guards";
import { isWalletGraded } from "./graded";

const STABLE_SYMBOLS = new Set(["USDC", "USDT", "USDG", "DAI", "BUSD", "USDE"]);

/**
 * C1 Distribution Prep:
 * Graded wallet deposits a non-stable memecoin to a labeled CEX address >= c1MinDepositUsd.
 * Emits an EXIT_RISK finding (does NOT alter wallet state machine).
 */
export function evaluateC1DistributionPrep(ctx: RuleContext): RuleFinding[] {
  const gradedDef = ctx.gradedDefinition ?? ctx.thresholds.gradedDefinition ?? "ANY_TAG_OR_COMPUTED";
  if (!isWalletGraded(ctx.wallet, gradedDef)) {
    return [];
  }

  const minDepositUsd = ctx.thresholds.c1MinDepositUsd;
  const findings: RuleFinding[] = [];

  for (const e of ctx.events) {
    if (e.kind !== "CEX_DEPOSIT" || !e.tokenAddress) continue;

    // Reject stablecoins
    const sym = (e.tokenSymbol ?? "").toUpperCase();
    if (STABLE_SYMBOLS.has(sym)) {
      continue;
    }

    if (!satisfiesUsdThreshold(e.amountUsd, minDepositUsd)) {
      continue;
    }

    const amountNum = parseUsd(e.amountUsd) ?? 0;
    const occurredAt = e.timestamp;
    const meta = ALERT_RULES_METADATA.C1;
    const txHash = e.txHash ?? "0xc1distprep";
    const cexName = e.counterpartyEntityName ?? "CEX";

    const dedupeKey = buildDedupeKey({
      type: "C1",
      walletAddress: ctx.wallet.address,
      chain: ctx.wallet.chain,
      tokenAddress: e.tokenAddress,
      occurredAt,
      windowHours: 24,
    });

    findings.push({
      type: "C1",
      state: "EXIT_RISK",
      occurredAt,
      token: {
        address: e.tokenAddress,
        chain: e.chain ?? ctx.wallet.chain,
        symbol: e.tokenSymbol ?? null,
      },
      amountUsd: amountNum.toFixed(2),
      clusterId: ctx.cluster?.id ?? null,
      payload: {
        tokenAddress: e.tokenAddress,
        tokenSymbol: e.tokenSymbol,
        amountUsd: amountNum,
        cexName,
        minDepositUsd,
      },
      evidence: {
        ruleId: "C1",
        ruleText: meta.fullRuleText,
        thresholds: {
          minDepositUsd,
        },
        observed: {
          tokenAddress: e.tokenAddress,
          tokenSymbol: e.tokenSymbol ?? "MEME",
          depositUsd: amountNum.toFixed(2),
          cexDestination: cexName,
        },
        txLinks: [
          {
            hash: txHash,
            url: getTxExplorerUrl(txHash, e.chain ?? ctx.wallet.chain),
            label: `Memecoin CEX deposit of ${e.tokenSymbol ?? "token"} ($${amountNum.toFixed(2)}) to ${cexName}`,
          },
        ],
      },
      dedupeKey,
    });
  }

  return findings;
}
