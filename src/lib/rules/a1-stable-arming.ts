// src/lib/rules/a1-stable-arming.ts
import type { RuleContext, RuleFinding } from "./types";
import { buildDedupeKey } from "./dedupe";
import { ALERT_RULES_METADATA, getTxExplorerUrl } from "./evidence";
import { parseUsd, satisfiesUsdThreshold } from "./guards";

/**
 * A1 Stablecoin Arming:
 * Sum USD of stable inflow movements (`STABLE_PARK`) in trailing `a1WindowHours`.
 * Fires ARMED when sum >= max(a1MinStableInflowUsd, a1MedianMultiple * medianDailyStableInflowUsd).
 * If fewer than 7 qualifying days exist, median is unavailable and only the floor applies.
 */
export function evaluateA1StableArming(ctx: RuleContext): RuleFinding[] {
  const windowHours = ctx.thresholds.a1WindowHours;
  const windowMs = windowHours * 3600 * 1000;
  const windowStart = ctx.now.getTime() - windowMs;

  const qualifyingEvents = ctx.events.filter((e) => {
    if (e.kind !== "STABLE_PARK") return false;
    const t = e.timestamp.getTime();
    if (t < windowStart || t > ctx.now.getTime()) return false;
    return e.amountUsd !== null && e.amountUsd !== undefined;
  });

  if (qualifyingEvents.length === 0) {
    return [];
  }

  let sumUsd = 0;
  for (const e of qualifyingEvents) {
    const parsed = parseUsd(e.amountUsd);
    if (parsed !== null) {
      sumUsd += parsed;
    }
  }

  const floorUsd = ctx.thresholds.a1MinStableInflowUsd;
  const medianUsd = parseUsd(ctx.stats.medianDailyStableInflowUsd);

  let thresholdUsd: number;
  let bindingArm: "FLOOR" | "MEDIAN";
  let medianArmUsd: number | null = null;

  if (medianUsd === null) {
    thresholdUsd = floorUsd;
    bindingArm = "FLOOR";
  } else {
    medianArmUsd = ctx.thresholds.a1MedianMultiple * medianUsd;
    if (medianArmUsd >= floorUsd) {
      thresholdUsd = medianArmUsd;
      bindingArm = "MEDIAN";
    } else {
      thresholdUsd = floorUsd;
      bindingArm = "FLOOR";
    }
  }

  if (!satisfiesUsdThreshold(sumUsd, thresholdUsd)) {
    return [];
  }

  const latestEvent = qualifyingEvents.reduce((latest, current) =>
    current.timestamp.getTime() > latest.timestamp.getTime() ? current : latest
  );

  const occurredAt = latestEvent.timestamp;
  const meta = ALERT_RULES_METADATA.A1;

  const txLinks = qualifyingEvents
    .filter((e) => Boolean(e.txHash))
    .map((e) => ({
      hash: e.txHash!,
      url: getTxExplorerUrl(e.txHash!, e.chain ?? ctx.wallet.chain),
      label: `Stable parking $${parseUsd(e.amountUsd)?.toFixed(2) ?? "0"}`,
    }));

  if (txLinks.length === 0 && latestEvent.txHash) {
    txLinks.push({
      hash: latestEvent.txHash,
      url: getTxExplorerUrl(latestEvent.txHash, ctx.wallet.chain),
      label: `Stable parking $${sumUsd.toFixed(2)}`,
    });
  }

  const dedupeKey = buildDedupeKey({
    type: "A1",
    walletAddress: ctx.wallet.address,
    chain: ctx.wallet.chain,
    tokenAddress: null,
    occurredAt,
    windowHours,
  });

  return [
    {
      type: "A1",
      state: "ARMED",
      occurredAt,
      token: latestEvent.tokenAddress
        ? {
            address: latestEvent.tokenAddress,
            chain: latestEvent.chain ?? ctx.wallet.chain,
            symbol: latestEvent.tokenSymbol ?? null,
          }
        : null,
      amountUsd: sumUsd.toFixed(2),
      clusterId: ctx.cluster?.id ?? null,
      payload: {
        sumInflowUsd: sumUsd,
        thresholdUsd,
        bindingArm,
        floorUsd,
        medianArmUsd,
        windowHours,
        eventCount: qualifyingEvents.length,
      },
      evidence: {
        ruleId: "A1",
        ruleText: meta.fullRuleText,
        thresholds: {
          floorUsd,
          medianMultiple: ctx.thresholds.a1MedianMultiple,
          medianDailyUsd: medianUsd ?? "UNAVAILABLE",
          medianArmUsd: medianArmUsd ?? "UNAVAILABLE",
          effectiveThresholdUsd: thresholdUsd,
          bindingArm,
        },
        observed: {
          windowInflowUsd: sumUsd.toFixed(2),
          medianDailyStableInflowUsd: ctx.stats.medianDailyStableInflowUsd,
          eventCount: qualifyingEvents.length,
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
