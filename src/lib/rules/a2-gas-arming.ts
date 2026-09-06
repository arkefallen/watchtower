// src/lib/rules/a2-gas-arming.ts
import type { RuleContext, RuleFinding } from "./types";
import { buildDedupeKey } from "./dedupe";
import { ALERT_RULES_METADATA, getTxExplorerUrl } from "./evidence";
import { parseUsd, satisfiesUsdThreshold } from "./guards";

/**
 * A2 Gas Arming (Decision D-4):
 * Sum native inflow (`NATIVE_FUNDING_IN`) in trailing `a2WindowHours`.
 * Fires ARMED when sum >= max(a2MinNativeInflowUsd, a2MedianMultiple * medianDailyNativeInflowUsd).
 * Cold-start falls back to floor $100 (or configured floor).
 * Configured floor 0 restores literal median-only behavior.
 */
export function evaluateA2GasArming(ctx: RuleContext): RuleFinding[] {
  const windowHours = ctx.thresholds.a2WindowHours;
  const windowMs = windowHours * 3600 * 1000;
  const windowStart = ctx.now.getTime() - windowMs;

  const qualifyingEvents = ctx.events.filter((e) => {
    if (e.kind !== "NATIVE_FUNDING_IN") return false;
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

  const floorUsd = ctx.thresholds.a2MinNativeInflowUsd;
  const medianUsd = parseUsd(ctx.stats.medianDailyNativeInflowUsd);
  const isColdStart = medianUsd === null;

  let thresholdUsd: number;
  let bindingArm: "FLOOR" | "MEDIAN";
  let medianArmUsd: number | null = null;

  if (isColdStart) {
    thresholdUsd = floorUsd;
    bindingArm = "FLOOR";
  } else {
    medianArmUsd = ctx.thresholds.a2MedianMultiple * medianUsd;
    if (floorUsd === 0) {
      // Configured floor 0 restores literal median-only behavior
      thresholdUsd = medianArmUsd;
      bindingArm = "MEDIAN";
    } else if (medianArmUsd >= floorUsd) {
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
  const meta = ALERT_RULES_METADATA.A2;

  const txLinks = qualifyingEvents
    .filter((e) => Boolean(e.txHash))
    .map((e) => ({
      hash: e.txHash!,
      url: getTxExplorerUrl(e.txHash!, e.chain ?? ctx.wallet.chain),
      label: `Native inflow $${parseUsd(e.amountUsd)?.toFixed(2) ?? "0"}`,
    }));

  if (txLinks.length === 0 && latestEvent.txHash) {
    txLinks.push({
      hash: latestEvent.txHash,
      url: getTxExplorerUrl(latestEvent.txHash, ctx.wallet.chain),
      label: `Native inflow $${sumUsd.toFixed(2)}`,
    });
  }

  const dedupeKey = buildDedupeKey({
    type: "A2",
    walletAddress: ctx.wallet.address,
    chain: ctx.wallet.chain,
    tokenAddress: null,
    occurredAt,
    windowHours,
  });

  return [
    {
      type: "A2",
      state: "ARMED",
      occurredAt,
      token: null,
      amountUsd: sumUsd.toFixed(2),
      clusterId: ctx.cluster?.id ?? null,
      payload: {
        sumInflowUsd: sumUsd,
        thresholdUsd,
        bindingArm,
        floorUsd,
        medianArmUsd,
        isColdStart,
        windowHours,
        eventCount: qualifyingEvents.length,
      },
      evidence: {
        ruleId: "A2",
        ruleText: meta.fullRuleText,
        thresholds: {
          floorUsd,
          medianMultiple: ctx.thresholds.a2MedianMultiple,
          medianDailyUsd: medianUsd ?? "UNAVAILABLE",
          medianArmUsd: medianArmUsd ?? "UNAVAILABLE",
          effectiveThresholdUsd: thresholdUsd,
          bindingArm,
        },
        observed: {
          windowInflowUsd: sumUsd.toFixed(2),
          medianDailyNativeInflowUsd: ctx.stats.medianDailyNativeInflowUsd,
          isColdStart: isColdStart ? "TRUE" : "FALSE",
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
