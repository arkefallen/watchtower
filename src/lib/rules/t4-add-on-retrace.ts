// src/lib/rules/t4-add-on-retrace.ts
import type { RuleContext, RuleFinding } from "./types";
import { buildDedupeKey } from "./dedupe";
import { ALERT_RULES_METADATA, getTxExplorerUrl } from "./evidence";
import { parseUsd } from "./guards";

/**
 * T4 Add-On-Retrace:
 * Wallet holds an open position in the token, and a new BUY occurs at price <= (1 - t4MinDrawdownPct/100) * peakPriceUsd.
 * Requires a priced buy and a known peak price; otherwise suppressed.
 * Fires TRIGGERED.
 */
export function evaluateT4AddOnRetrace(ctx: RuleContext): RuleFinding[] {
  const minDrawdownPct = ctx.thresholds.t4MinDrawdownPct;
  const findings: RuleFinding[] = [];

  for (const e of ctx.events) {
    if (e.kind !== "BUY" || !e.tokenAddress) continue;

    // Requires a priced buy
    const buyPrice = parseUsd(e.priceUsdAtAction);
    if (buyPrice === null || buyPrice <= 0) {
      continue;
    }

    // Must have an open position in this token
    const openPosition = ctx.positions.find(
      (p) =>
        p.isOpen &&
        p.tokenAddress.toLowerCase() === e.tokenAddress!.toLowerCase()
    );

    if (!openPosition) {
      continue;
    }

    // Must have a known peak price
    const peakPrice = parseUsd(openPosition.peakPriceUsd);
    if (peakPrice === null || peakPrice <= 0) {
      continue;
    }

    // Threshold price calculation
    const retraceThresholdPrice = (1 - minDrawdownPct / 100) * peakPrice;
    // Allow slight float tolerance (e.g. 1e-9) to avoid precision errors on exact matches
    if (buyPrice > retraceThresholdPrice + 1e-9) {
      continue;
    }

    const actualDrawdownPct = ((peakPrice - buyPrice) / peakPrice) * 100;
    const occurredAt = e.timestamp;
    const meta = ALERT_RULES_METADATA.T4;
    const txHash = e.txHash ?? "0xt4addonretrace";

    const dedupeKey = buildDedupeKey({
      type: "T4",
      walletAddress: ctx.wallet.address,
      chain: ctx.wallet.chain,
      tokenAddress: e.tokenAddress,
      occurredAt,
      windowHours: 24,
    });

    findings.push({
      type: "T4",
      state: "TRIGGERED",
      occurredAt,
      token: {
        address: e.tokenAddress,
        chain: e.chain ?? ctx.wallet.chain,
        symbol: e.tokenSymbol ?? openPosition.tokenSymbol ?? null,
      },
      amountUsd: e.amountUsd ?? null,
      clusterId: ctx.cluster?.id ?? null,
      payload: {
        tokenAddress: e.tokenAddress,
        tokenSymbol: e.tokenSymbol,
        buyPrice,
        peakPrice,
        drawdownPct: actualDrawdownPct,
        minDrawdownPct,
        retraceThresholdPrice,
      },
      evidence: {
        ruleId: "T4",
        ruleText: meta.fullRuleText,
        thresholds: {
          minDrawdownPct,
          peakPriceUsd: peakPrice.toFixed(6),
          maxBuyPriceUsd: retraceThresholdPrice.toFixed(6),
        },
        observed: {
          tokenAddress: e.tokenAddress,
          buyPriceUsd: buyPrice.toFixed(6),
          drawdownPct: actualDrawdownPct.toFixed(2),
        },
        txLinks: [
          {
            hash: txHash,
            url: getTxExplorerUrl(txHash, e.chain ?? ctx.wallet.chain),
            label: `Add-on retrace buy at $${buyPrice.toFixed(4)} (${actualDrawdownPct.toFixed(1)}% below peak $${peakPrice.toFixed(4)})`,
          },
        ],
      },
      dedupeKey,
    });
  }

  return findings;
}
