// src/lib/rules/a6-consolidation.ts
import type { RuleContext, RuleFinding } from "./types";
import { buildDedupeKey } from "./dedupe";
import { ALERT_RULES_METADATA, getTxExplorerUrl } from "./evidence";
import { parseUsd } from "./guards";

/**
 * A6 Consolidation:
 * Wallet receives sweeps from >= a6MinSweepSources (default 2) addresses it previously funded within a6WindowHours (default 48h).
 * Operator gathering ammunition.
 */
export function evaluateA6Consolidation(ctx: RuleContext): RuleFinding[] {
  const windowHours = ctx.thresholds.a6WindowHours;
  const windowMs = windowHours * 3600 * 1000;
  const minSweepSources = ctx.thresholds.a6MinSweepSources;

  const sweepEvents = ctx.fundingEvents.filter((f) => {
    if (!f.wasFundedByWallet) return false;
    const t = f.at.getTime();
    return t >= ctx.now.getTime() - windowMs && t <= ctx.now.getTime();
  });

  if (sweepEvents.length === 0) {
    return [];
  }

  // Group by distinct source address
  const sourceMap = new Map<
    string,
    Array<{
      at: Date;
      amountUsd: string | null;
      txHash?: string;
    }>
  >();

  for (const s of sweepEvents) {
    const src = s.from.toLowerCase();
    const list = sourceMap.get(src) ?? [];
    list.push({
      at: s.at,
      amountUsd: s.amountUsd,
      txHash: s.txHash,
    });
    sourceMap.set(src, list);
  }

  if (sourceMap.size < minSweepSources) {
    return [];
  }

  // Sort events to find latest
  sweepEvents.sort((a, b) => a.at.getTime() - b.at.getTime());
  const latestEvent = sweepEvents[sweepEvents.length - 1];
  const occurredAt = latestEvent.at;
  const meta = ALERT_RULES_METADATA.A6;

  let totalSweepUsd = 0;
  const sourcesSummary: Array<{ address: string; totalUsd: number; txHash?: string }> = [];

  for (const [address, events] of sourceMap.entries()) {
    let sourceUsd = 0;
    let lastTx: string | undefined;
    for (const e of events) {
      const parsed = parseUsd(e.amountUsd);
      if (parsed !== null) {
        sourceUsd += parsed;
        totalSweepUsd += parsed;
      }
      if (e.txHash) lastTx = e.txHash;
    }
    sourcesSummary.push({
      address,
      totalUsd: sourceUsd,
      txHash: lastTx,
    });
  }

  const txLinks = sweepEvents
    .filter((e) => Boolean(e.txHash))
    .map((e) => ({
      hash: e.txHash!,
      url: getTxExplorerUrl(e.txHash!, ctx.wallet.chain),
      label: `Sweep from ${e.from.slice(0, 8)}... ($${parseUsd(e.amountUsd)?.toFixed(2) ?? "0"})`,
    }));

  if (txLinks.length === 0) {
    txLinks.push({
      hash: "0xconsolidation",
      url: getTxExplorerUrl("0xconsolidation", ctx.wallet.chain),
      label: `Consolidation from ${sourceMap.size} sweep sources ($${totalSweepUsd.toFixed(2)})`,
    });
  }

  const dedupeKey = buildDedupeKey({
    type: "A6",
    walletAddress: ctx.wallet.address,
    chain: ctx.wallet.chain,
    tokenAddress: null,
    occurredAt,
    windowHours,
  });

  return [
    {
      type: "A6",
      state: "ARMED",
      occurredAt,
      token: null,
      amountUsd: totalSweepUsd.toFixed(2),
      clusterId: ctx.cluster?.id ?? null,
      payload: {
        sweepSourceCount: sourceMap.size,
        minSweepSources,
        sources: sourcesSummary,
        totalSweepUsd,
        windowHours,
      },
      evidence: {
        ruleId: "A6",
        ruleText: meta.fullRuleText,
        thresholds: {
          minSweepSources,
          windowHours,
        },
        observed: {
          sweepSourceCount: sourceMap.size,
          sources: sourcesSummary.map((s) => `${s.address} ($${s.totalUsd.toFixed(2)})`).join(", "),
          totalSweepUsd: totalSweepUsd.toFixed(2),
        },
        txLinks,
        windows: {
          window: `${windowHours}h`,
        },
      },
      dedupeKey,
    },
  ];
}
