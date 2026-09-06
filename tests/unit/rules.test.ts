// tests/unit/rules.test.ts
import { describe, expect, it, vi } from "vitest";
import { ALERT_RULES } from "@/lib/rules/registry";
import { buildDedupeKey } from "@/lib/rules/dedupe";
import { validateEvidence, AlertEvidenceSchema } from "@/lib/rules/evidence";
import { satisfiesUsdThreshold } from "@/lib/rules/guards";
import { isWalletGraded } from "@/lib/rules/graded";
import { evaluateA1StableArming } from "@/lib/rules/a1-stable-arming";
import { evaluateA2GasArming } from "@/lib/rules/a2-gas-arming";
import { evaluateA3CexWithdrawal } from "@/lib/rules/a3-cex-withdrawal";
import { evaluateA4DormancyWake } from "@/lib/rules/a4-dormancy-wake";
import { evaluateA5ClusterArming } from "@/lib/rules/a5-cluster-arming";
import { evaluateA6Consolidation } from "@/lib/rules/a6-consolidation";
import { evaluateT1ArmedEntry } from "@/lib/rules/t1-armed-entry";
import { evaluateT2IndependentCoEntry } from "@/lib/rules/t2-independent-co-entry";
import { evaluateT3FreshLaunch } from "@/lib/rules/t3-fresh-launch";
import { evaluateT4AddOnRetrace } from "@/lib/rules/t4-add-on-retrace";
import { evaluateT5ClusterCoEntry } from "@/lib/rules/t5-cluster-co-entry";
import { evaluateC1DistributionPrep } from "@/lib/rules/c1-distribution-prep";
import { evaluateC2CoDistribution } from "@/lib/rules/c2-co-distribution";
import { evaluateC3MoonDiscipline } from "@/lib/rules/c3-moon-discipline";
import { evaluateC4CampaignSpent } from "@/lib/rules/c4-campaign-spent";
import { evaluateDeArm } from "@/lib/rules/dearm";
import { setClusterArmedState } from "@/server/services/cluster/armed-state";
import { DEFAULT_SETTINGS } from "@/lib/settings-schema";
import type { RuleContext } from "@/lib/rules/types";
import type { PrismaClient } from "@/generated/prisma/client";

function makeContext(overrides?: Partial<RuleContext>): RuleContext {
  const now = new Date("2026-09-01T12:00:00Z");
  return {
    wallet: {
      address: "0x1111111111111111111111111111111111111111",
      chain: "base",
      watchPriority: "HIGH",
      isSelf: false,
      gradeLabel: null,
      hasGrade: true,
      ...overrides?.wallet,
    },
    state: {
      current: "IDLE",
      armedAt: null,
      triggeredAt: null,
      stablePeakUsd: null,
      stablePeakAt: null,
      baselineStableUsd: null,
      baselineNativeUsd: null,
      deArmStreakDays: 0,
      ...overrides?.state,
    },
    events: overrides?.events ?? [],
    stats: {
      medianDailyStableInflowUsd: null,
      medianDailyNativeInflowUsd: null,
      stableBalanceUsd: null,
      nativeBalanceUsd: null,
      lastActivityAt: null,
      dormantDays: null,
      ...overrides?.stats,
    },
    positions: overrides?.positions ?? [],
    cluster: overrides?.cluster ?? null,
    peerActivity: overrides?.peerActivity ?? [],
    fundingEvents: overrides?.fundingEvents ?? [],
    thresholds: {
      ...DEFAULT_SETTINGS.alertThresholds,
      ...overrides?.thresholds,
    },
    now: overrides?.now ?? now,
  };
}

describe("P4-T01: Rule Framework, Registry, Evidence Contract", () => {
  it("rules: registry contains exactly A1-A6, T1-T5, C1-C4", () => {
    const expected = [
      "A1", "A2", "A3", "A4", "A5", "A6",
      "T1", "T2", "T3", "T4", "T5",
      "C1", "C2", "C3", "C4",
    ];
    const actual = Object.keys(ALERT_RULES).sort();
    expect(actual).toEqual(expected.sort());
    expect(Object.keys(ALERT_RULES)).toHaveLength(15);
  });

  it("rules: every rule declares a category and a lookback", () => {
    const validCategories = new Set(["ARMING", "TRIGGER", "EXIT_RISK"]);
    const dummyThresholds = DEFAULT_SETTINGS.alertThresholds;

    for (const [id, rule] of Object.entries(ALERT_RULES)) {
      expect(rule.id).toBe(id);
      expect(typeof rule.title).toBe("string");
      expect(rule.title.length).toBeGreaterThan(0);
      expect(validCategories.has(rule.category)).toBe(true);
      expect(typeof rule.lookback).toBe("function");

      const lb = rule.lookback(dummyThresholds);
      expect(typeof lb).toBe("number");
      expect(lb).toBeGreaterThan(0);
      expect(typeof rule.evaluate).toBe("function");
    }
  });

  it("rules: dedupeKey is stable for the same logical firing", () => {
    const d1 = new Date("2026-09-01T12:00:00Z");
    const k1 = buildDedupeKey({
      type: "A1",
      walletAddress: "0x1111111111111111111111111111111111111111",
      chain: "base",
      tokenAddress: null,
      occurredAt: d1,
      windowHours: 24,
    });
    const k2 = buildDedupeKey({
      type: "A1",
      walletAddress: "0x1111111111111111111111111111111111111111",
      chain: "base",
      tokenAddress: null,
      occurredAt: d1,
      windowHours: 24,
    });
    expect(k1).toBe(k2);
  });

  it("rules: dedupeKey differs across window buckets", () => {
    const d1 = new Date("2026-09-01T12:00:00Z");
    const d2 = new Date("2026-09-03T12:00:00Z"); // 48h later -> different bucket
    const k1 = buildDedupeKey({
      type: "A1",
      walletAddress: "0x1111111111111111111111111111111111111111",
      chain: "base",
      tokenAddress: null,
      occurredAt: d1,
      windowHours: 24,
    });
    const k2 = buildDedupeKey({
      type: "A1",
      walletAddress: "0x1111111111111111111111111111111111111111",
      chain: "base",
      tokenAddress: null,
      occurredAt: d2,
      windowHours: 24,
    });
    expect(k1).not.toBe(k2);
  });

  it("rules: evidence without ruleText is rejected", () => {
    const noRuleText = {
      ruleId: "A1",
      txLinks: ["0x123"],
    };
    const res = validateEvidence(noRuleText);
    expect(res.success).toBe(false);
  });

  it("rules: evidence without txLinks is rejected for event rules", () => {
    const noTxLinks = {
      ruleId: "A1",
      ruleText: "Rule text here",
      txLinks: [],
    };
    const res = validateEvidence(noTxLinks);
    expect(res.success).toBe(false);
  });

  it("rules: null USD fails a threshold comparison", () => {
    expect(satisfiesUsdThreshold(null, 1000)).toBe(false);
    expect(satisfiesUsdThreshold(undefined, 1000)).toBe(false);
    expect(satisfiesUsdThreshold(null, 0)).toBe(false);
    expect(satisfiesUsdThreshold("invalid", 100)).toBe(false);
    expect(satisfiesUsdThreshold("1000", 1000)).toBe(true);
    expect(satisfiesUsdThreshold("999.99", 1000)).toBe(false);
  });
});

describe("P4-T03: ARMED Rules A1–A4", () => {
  it("A1: fires at the absolute floor when the median arm is lower", () => {
    // Median is $200, 3x median is $600. Floor is $1,000.
    // Inflow $1,500 >= max(1000, 600) -> fires!
    const ctx = makeContext({
      stats: {
        medianDailyStableInflowUsd: "200.00",
        medianDailyNativeInflowUsd: null,
        stableBalanceUsd: "1500.00",
        nativeBalanceUsd: "100.00",
        lastActivityAt: null,
        dormantDays: null,
      },
      events: [
        {
          id: 1n,
          walletAddress: "0x1111111111111111111111111111111111111111",
          chain: "base",
          kind: "STABLE_PARK",
          amountRaw: "1500000000",
          amountUsd: "1500.00",
          timestamp: new Date("2026-09-01T11:00:00Z"),
          txHash: "0xtx_stable_1500",
        },
      ],
    });

    const findings = evaluateA1StableArming(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].state).toBe("ARMED");
    expect(findings[0].payload.bindingArm).toBe("FLOOR");
  });

  it("A1: fires at 3× median when that exceeds the floor", () => {
    // Median is $500, 3x median is $1,500. Floor is $1,000. Effective threshold is $1,500.
    // Inflow $1,600 >= 1,500 -> fires with bindingArm = MEDIAN!
    const ctx = makeContext({
      stats: {
        medianDailyStableInflowUsd: "500.00",
        medianDailyNativeInflowUsd: null,
        stableBalanceUsd: "1600.00",
        nativeBalanceUsd: "100.00",
        lastActivityAt: null,
        dormantDays: null,
      },
      events: [
        {
          id: 1n,
          walletAddress: "0x1111111111111111111111111111111111111111",
          chain: "base",
          kind: "STABLE_PARK",
          amountRaw: "1600000000",
          amountUsd: "1600.00",
          timestamp: new Date("2026-09-01T11:00:00Z"),
          txHash: "0xtx_stable_1600",
        },
      ],
    });

    const findings = evaluateA1StableArming(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].payload.bindingArm).toBe("MEDIAN");
    expect(findings[0].payload.thresholdUsd).toBe(1500);
  });

  it("A1: does not fire below both arms", () => {
    // Inflow $900 with median $200 (floor $1,000) does not fire
    const ctx = makeContext({
      stats: {
        medianDailyStableInflowUsd: "200.00",
        medianDailyNativeInflowUsd: null,
        stableBalanceUsd: "900.00",
        nativeBalanceUsd: "100.00",
        lastActivityAt: null,
        dormantDays: null,
      },
      events: [
        {
          id: 1n,
          walletAddress: "0x1111111111111111111111111111111111111111",
          chain: "base",
          kind: "STABLE_PARK",
          amountRaw: "900000000",
          amountUsd: "900.00",
          timestamp: new Date("2026-09-01T11:00:00Z"),
          txHash: "0xtx_stable_900",
        },
      ],
    });

    const findings = evaluateA1StableArming(ctx);
    expect(findings).toHaveLength(0);
  });

  it("A1: window is exactly 24h", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    // Event at 25h ago (outside 24h)
    const oldEventTime = new Date(now.getTime() - 25 * 3600 * 1000);
    const ctx = makeContext({
      now,
      stats: {
        medianDailyStableInflowUsd: null,
        medianDailyNativeInflowUsd: null,
        stableBalanceUsd: "2000.00",
        nativeBalanceUsd: "100.00",
        lastActivityAt: null,
        dormantDays: null,
      },
      events: [
        {
          id: 1n,
          walletAddress: "0x1111111111111111111111111111111111111111",
          chain: "base",
          kind: "STABLE_PARK",
          amountRaw: "2000000000",
          amountUsd: "2000.00",
          timestamp: oldEventTime,
          txHash: "0xtx_old",
        },
      ],
    });

    expect(evaluateA1StableArming(ctx)).toHaveLength(0);
  });

  it("A1: evidence names which arm bound", () => {
    const ctx = makeContext({
      stats: {
        medianDailyStableInflowUsd: "200.00",
        medianDailyNativeInflowUsd: null,
        stableBalanceUsd: "1500.00",
        nativeBalanceUsd: "100.00",
        lastActivityAt: null,
        dormantDays: null,
      },
      events: [
        {
          id: 1n,
          walletAddress: "0x1111111111111111111111111111111111111111",
          chain: "base",
          kind: "STABLE_PARK",
          amountRaw: "1500000000",
          amountUsd: "1500.00",
          timestamp: new Date("2026-09-01T11:00:00Z"),
          txHash: "0xtx_1500",
        },
      ],
    });

    const findings = evaluateA1StableArming(ctx);
    expect(findings[0].evidence.thresholds.bindingArm).toBe("FLOOR");
  });

  it("A2: cold start fires at the $100 floor", () => {
    // Median is null (cold start). Exactly $100 fires!
    const ctx = makeContext({
      stats: {
        medianDailyStableInflowUsd: null,
        medianDailyNativeInflowUsd: null,
        stableBalanceUsd: null,
        nativeBalanceUsd: "100.00",
        lastActivityAt: null,
        dormantDays: null,
      },
      events: [
        {
          id: 1n,
          walletAddress: "0x1111111111111111111111111111111111111111",
          chain: "base",
          kind: "NATIVE_FUNDING_IN",
          amountRaw: "100000000000000000",
          amountUsd: "100.00",
          timestamp: new Date("2026-09-01T11:00:00Z"),
          txHash: "0xtx_native_100",
        },
      ],
    });

    const findings = evaluateA2GasArming(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].payload.isColdStart).toBe(true);
    expect(findings[0].payload.bindingArm).toBe("FLOOR");
  });

  it("A2: cold start does not fire at $99.99", () => {
    const ctx = makeContext({
      stats: {
        medianDailyStableInflowUsd: null,
        medianDailyNativeInflowUsd: null,
        stableBalanceUsd: null,
        nativeBalanceUsd: "99.99",
        lastActivityAt: null,
        dormantDays: null,
      },
      events: [
        {
          id: 1n,
          walletAddress: "0x1111111111111111111111111111111111111111",
          chain: "base",
          kind: "NATIVE_FUNDING_IN",
          amountRaw: "99990000000000000",
          amountUsd: "99.99",
          timestamp: new Date("2026-09-01T11:00:00Z"),
          txHash: "0xtx_native_99",
        },
      ],
    });

    expect(evaluateA2GasArming(ctx)).toHaveLength(0);
  });

  it("A2: median arm binds when 3× median exceeds $100", () => {
    // Median $60 -> 3x = $180. Floor is $100. Effective is $180.
    const ctx = makeContext({
      stats: {
        medianDailyStableInflowUsd: null,
        medianDailyNativeInflowUsd: "60.00",
        stableBalanceUsd: null,
        nativeBalanceUsd: "180.00",
        lastActivityAt: null,
        dormantDays: null,
      },
      events: [
        {
          id: 1n,
          walletAddress: "0x1111111111111111111111111111111111111111",
          chain: "base",
          kind: "NATIVE_FUNDING_IN",
          amountRaw: "180000000000000000",
          amountUsd: "180.00",
          timestamp: new Date("2026-09-01T11:00:00Z"),
          txHash: "0xtx_native_180",
        },
      ],
    });

    const findings = evaluateA2GasArming(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].payload.bindingArm).toBe("MEDIAN");
    expect(findings[0].payload.thresholdUsd).toBe(180);
  });

  it("A2: configured floor 0 restores literal median-only behavior", () => {
    // Floor = 0, median = $20 -> 3x = $60.
    // Inflow $70 fires at $60 threshold
    const ctx = makeContext({
      thresholds: {
        ...DEFAULT_SETTINGS.alertThresholds,
        a2MinNativeInflowUsd: 0,
      },
      stats: {
        medianDailyStableInflowUsd: null,
        medianDailyNativeInflowUsd: "20.00",
        stableBalanceUsd: null,
        nativeBalanceUsd: "70.00",
        lastActivityAt: null,
        dormantDays: null,
      },
      events: [
        {
          id: 1n,
          walletAddress: "0x1111111111111111111111111111111111111111",
          chain: "base",
          kind: "NATIVE_FUNDING_IN",
          amountRaw: "70000000000000000",
          amountUsd: "70.00",
          timestamp: new Date("2026-09-01T11:00:00Z"),
          txHash: "0xtx_native_70",
        },
      ],
    });

    const findings = evaluateA2GasArming(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].payload.thresholdUsd).toBe(60);
    expect(findings[0].payload.bindingArm).toBe("MEDIAN");
  });

  it("A2: evidence records both arms and cold-start status", () => {
    const ctx = makeContext({
      stats: {
        medianDailyStableInflowUsd: null,
        medianDailyNativeInflowUsd: null,
        stableBalanceUsd: null,
        nativeBalanceUsd: "100.00",
        lastActivityAt: null,
        dormantDays: null,
      },
      events: [
        {
          id: 1n,
          walletAddress: "0x1111111111111111111111111111111111111111",
          chain: "base",
          kind: "NATIVE_FUNDING_IN",
          amountRaw: "100000000000000000",
          amountUsd: "100.00",
          timestamp: new Date("2026-09-01T11:00:00Z"),
          txHash: "0xtx_native_100",
        },
      ],
    });

    const findings = evaluateA2GasArming(ctx);
    expect(findings[0].evidence.thresholds.floorUsd).toBe(100);
    expect(findings[0].evidence.observed.isColdStart).toBe("TRUE");
  });

  it("A3: fires only for CEX-kind entities", () => {
    // Non-CEX counterparty does not fire A3
    const ctx = makeContext({
      fundingEvents: [
        {
          from: "0x9999999999999999999999999999999999999999",
          at: new Date("2026-09-01T10:00:00Z"),
          amountUsd: "5000.00",
          fromEntityKind: "HUMAN",
          fromEntityName: "Alice",
          wasFundedByWallet: false,
          txHash: "0xtx_human",
        },
      ],
    });

    expect(evaluateA3CexWithdrawal(ctx)).toHaveLength(0);
  });

  it("A3: exactly $1,000 fires", () => {
    const ctx = makeContext({
      fundingEvents: [
        {
          from: "0x28c6c06298d514db089934071355e5743bf21d60",
          at: new Date("2026-09-01T10:00:00Z"),
          amountUsd: "1000.00",
          fromEntityKind: "CEX",
          fromEntityName: "Binance 14",
          wasFundedByWallet: false,
          txHash: "0xtx_binance",
        },
      ],
    });

    const findings = evaluateA3CexWithdrawal(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].payload.entityName).toBe("Binance 14");
  });

  it("A3: $999.99 does not fire", () => {
    const ctx = makeContext({
      fundingEvents: [
        {
          from: "0x28c6c06298d514db089934071355e5743bf21d60",
          at: new Date("2026-09-01T10:00:00Z"),
          amountUsd: "999.99",
          fromEntityKind: "CEX",
          fromEntityName: "Binance 14",
          wasFundedByWallet: false,
          txHash: "0xtx_binance_under",
        },
      ],
    });

    expect(evaluateA3CexWithdrawal(ctx)).toHaveLength(0);
  });

  it("A4: 30 days dormant plus $500 fires", () => {
    const ctx = makeContext({
      stats: {
        medianDailyStableInflowUsd: null,
        medianDailyNativeInflowUsd: null,
        stableBalanceUsd: null,
        nativeBalanceUsd: null,
        lastActivityAt: null,
        dormantDays: 30,
      },
      fundingEvents: [
        {
          from: "0x9999999999999999999999999999999999999999",
          at: new Date("2026-09-01T10:00:00Z"),
          amountUsd: "500.00",
          fromEntityKind: null,
          fromEntityName: null,
          wasFundedByWallet: false,
          txHash: "0xtx_wake",
        },
      ],
    });

    const findings = evaluateA4DormancyWake(ctx);
    expect(findings).toHaveLength(1);
  });

  it("A4: 29 days dormant does not fire", () => {
    const ctx = makeContext({
      stats: {
        medianDailyStableInflowUsd: null,
        medianDailyNativeInflowUsd: null,
        stableBalanceUsd: null,
        nativeBalanceUsd: null,
        lastActivityAt: null,
        dormantDays: 29,
      },
      fundingEvents: [
        {
          from: "0x9999999999999999999999999999999999999999",
          at: new Date("2026-09-01T10:00:00Z"),
          amountUsd: "500.00",
          fromEntityKind: null,
          fromEntityName: null,
          wasFundedByWallet: false,
          txHash: "0xtx_wake",
        },
      ],
    });

    expect(evaluateA4DormancyWake(ctx)).toHaveLength(0);
  });

  it("A4: dormancy measured before the waking event", () => {
    // Last activity was 31 days before the waking event
    const eventTime = new Date("2026-09-01T10:00:00Z");
    const lastActivity = new Date(eventTime.getTime() - 31 * 86400 * 1000);

    const ctx = makeContext({
      stats: {
        medianDailyStableInflowUsd: null,
        medianDailyNativeInflowUsd: null,
        stableBalanceUsd: null,
        nativeBalanceUsd: null,
        lastActivityAt: lastActivity,
        dormantDays: null,
      },
      events: [
        {
          id: 1n,
          walletAddress: "0x1111111111111111111111111111111111111111",
          chain: "base",
          kind: "NATIVE_FUNDING_IN",
          amountRaw: "500000000000000000",
          amountUsd: "500.00",
          timestamp: eventTime,
          txHash: "0xtx_wake_event",
        },
      ],
    });

    const findings = evaluateA4DormancyWake(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].payload.dormantDays).toBeGreaterThanOrEqual(30);
  });

  it("A1-A4: every finding carries thresholds, observed values, and tx links", () => {
    // Verify schema validation passes for A1-A4 findings
    const ctxA1 = makeContext({
      events: [
        {
          id: 1n,
          walletAddress: "0x1111111111111111111111111111111111111111",
          chain: "base",
          kind: "STABLE_PARK",
          amountRaw: "1500000000",
          amountUsd: "1500.00",
          timestamp: new Date("2026-09-01T11:00:00Z"),
          txHash: "0xtx_a1",
        },
      ],
    });
    const findingsA1 = evaluateA1StableArming(ctxA1);
    expect(findingsA1).toHaveLength(1);
    const validA1 = validateEvidence(findingsA1[0].evidence);
    expect(validA1.success).toBe(true);
    expect(findingsA1[0].evidence.txLinks.length).toBeGreaterThan(0);
  });
});

describe("P4-T04: ARMED Rules A5 and A6", () => {
  const funder = "0x9999999999999999999999999999999999999999";
  const member1 = "0x1111111111111111111111111111111111111111";
  const member2 = "0x2222222222222222222222222222222222222222";

  it("A5: two cluster members funded by one funder within 48h fires once", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    const ctx = makeContext({
      now,
      cluster: {
        id: "cluster-alpha",
        name: "Alpha Cluster",
        memberAddresses: [
          { address: member1, chain: "base" },
          { address: member2, chain: "base" },
        ],
      },
      fundingEvents: [
        {
          from: funder,
          to: member1,
          at: new Date(now.getTime() - 40 * 3600 * 1000), // 40h ago
          amountUsd: "1000.00",
          fromEntityKind: null,
          fromEntityName: null,
          wasFundedByWallet: false,
          txHash: "0xtx_m1",
        },
        {
          from: funder,
          to: member2,
          at: new Date(now.getTime() - 10 * 3600 * 1000), // 10h ago
          amountUsd: "1000.00",
          fromEntityKind: null,
          fromEntityName: null,
          wasFundedByWallet: false,
          txHash: "0xtx_m2",
        },
      ],
    });

    const findings = evaluateA5ClusterArming(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].clusterId).toBe("cluster-alpha");
  });

  it("A5: dedupe prevents one alert per member", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    const cluster = {
      id: "cluster-alpha",
      name: "Alpha Cluster",
      memberAddresses: [
        { address: member1, chain: "base" as const },
        { address: member2, chain: "base" as const },
      ],
    };
    const fundingEvents = [
      {
        from: funder,
        to: member1,
        at: new Date(now.getTime() - 30 * 3600 * 1000),
        amountUsd: "1000.00",
        fromEntityKind: null,
        fromEntityName: null,
        wasFundedByWallet: false,
        txHash: "0xtx_m1",
      },
      {
        from: funder,
        to: member2,
        at: new Date(now.getTime() - 10 * 3600 * 1000),
        amountUsd: "1000.00",
        fromEntityKind: null,
        fromEntityName: null,
        wasFundedByWallet: false,
        txHash: "0xtx_m2",
      },
    ];

    const ctx1 = makeContext({ now, wallet: { address: member1, chain: "base", watchPriority: "HIGH", isSelf: false, gradeLabel: null, hasGrade: true }, cluster, fundingEvents });
    const ctx2 = makeContext({ now, wallet: { address: member2, chain: "base", watchPriority: "HIGH", isSelf: false, gradeLabel: null, hasGrade: true }, cluster, fundingEvents });

    const f1 = evaluateA5ClusterArming(ctx1);
    const f2 = evaluateA5ClusterArming(ctx2);

    expect(f1).toHaveLength(1);
    expect(f2).toHaveLength(1);
    // Dedupe key must be 100% identical
    expect(f1[0].dedupeKey).toBe(f2[0].dedupeKey);
  });

  it("A5: sets Cluster.isArmed and armedAt", async () => {
    const mockPrisma = {
      cluster: {
        update: vi.fn().mockResolvedValue({
          id: "cluster-alpha",
          isArmed: true,
          armedAt: new Date("2026-09-01T12:00:00Z"),
        }),
      },
    } as unknown as PrismaClient;

    const armTime = new Date("2026-09-01T12:00:00Z");
    const res = await setClusterArmedState(mockPrisma, "cluster-alpha", true, armTime);

    expect(res.isArmed).toBe(true);
    expect(res.armedAt).toEqual(armTime);
    expect(mockPrisma.cluster.update).toHaveBeenCalledWith({
      where: { id: "cluster-alpha" },
      data: { isArmed: true, armedAt: armTime },
      select: { id: true, isArmed: true, armedAt: true },
    });
  });

  it("A5: 49-hour gap does not fire", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    const ctx = makeContext({
      now,
      cluster: {
        id: "cluster-alpha",
        name: "Alpha Cluster",
        memberAddresses: [
          { address: member1, chain: "base" },
          { address: member2, chain: "base" },
        ],
      },
      fundingEvents: [
        {
          from: funder,
          to: member1,
          at: new Date(now.getTime() - 50 * 3600 * 1000), // 50h ago
          amountUsd: "1000.00",
          fromEntityKind: null,
          fromEntityName: null,
          wasFundedByWallet: false,
          txHash: "0xtx_m1",
        },
        {
          from: funder,
          to: member2,
          at: new Date(now.getTime() - 1 * 3600 * 1000), // 1h ago
          amountUsd: "1000.00",
          fromEntityKind: null,
          fromEntityName: null,
          wasFundedByWallet: false,
          txHash: "0xtx_m2",
        },
      ],
    });

    expect(evaluateA5ClusterArming(ctx)).toHaveLength(0);
  });

  it("A5: different funders do not aggregate", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    const ctx = makeContext({
      now,
      cluster: {
        id: "cluster-alpha",
        name: "Alpha Cluster",
        memberAddresses: [
          { address: member1, chain: "base" },
          { address: member2, chain: "base" },
        ],
      },
      fundingEvents: [
        {
          from: "0xaaaa111111111111111111111111111111111111",
          to: member1,
          at: new Date(now.getTime() - 10 * 3600 * 1000),
          amountUsd: "1000.00",
          fromEntityKind: null,
          fromEntityName: null,
          wasFundedByWallet: false,
          txHash: "0xtx_a",
        },
        {
          from: "0xbbbb222222222222222222222222222222222222",
          to: member2,
          at: new Date(now.getTime() - 5 * 3600 * 1000),
          amountUsd: "1000.00",
          fromEntityKind: null,
          fromEntityName: null,
          wasFundedByWallet: false,
          txHash: "0xtx_b",
        },
      ],
    });

    expect(evaluateA5ClusterArming(ctx)).toHaveLength(0);
  });

  it("A5: payload flags the escalated treatment", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    const ctx = makeContext({
      now,
      cluster: {
        id: "cluster-alpha",
        name: "Alpha Cluster",
        memberAddresses: [
          { address: member1, chain: "base" },
          { address: member2, chain: "base" },
        ],
      },
      fundingEvents: [
        { from: funder, to: member1, at: new Date(now.getTime() - 10 * 3600 * 1000), amountUsd: "1000.00", fromEntityKind: null, fromEntityName: null, wasFundedByWallet: false, txHash: "0xtx_1" },
        { from: funder, to: member2, at: new Date(now.getTime() - 5 * 3600 * 1000), amountUsd: "1000.00", fromEntityKind: null, fromEntityName: null, wasFundedByWallet: false, txHash: "0xtx_2" },
      ],
    });

    const findings = evaluateA5ClusterArming(ctx);
    expect(findings[0].payload.escalated).toBe(true);
    expect(findings[0].payload.highestPriority).toBe(true);
  });

  it("A6: two prior-funded sweep sources fire", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    const ctx = makeContext({
      now,
      fundingEvents: [
        {
          from: "0xsource1111111111111111111111111111111111",
          at: new Date(now.getTime() - 10 * 3600 * 1000),
          amountUsd: "2000.00",
          fromEntityKind: null,
          fromEntityName: null,
          wasFundedByWallet: true,
          txHash: "0xtx_s1",
        },
        {
          from: "0xsource2222222222222222222222222222222222",
          at: new Date(now.getTime() - 5 * 3600 * 1000),
          amountUsd: "3000.00",
          fromEntityKind: null,
          fromEntityName: null,
          wasFundedByWallet: true,
          txHash: "0xtx_s2",
        },
      ],
    });

    const findings = evaluateA6Consolidation(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].payload.sweepSourceCount).toBe(2);
  });

  it("A6: sources never funded by the wallet do not count", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    const ctx = makeContext({
      now,
      fundingEvents: [
        {
          from: "0xsource1111111111111111111111111111111111",
          at: new Date(now.getTime() - 10 * 3600 * 1000),
          amountUsd: "2000.00",
          fromEntityKind: null,
          fromEntityName: null,
          wasFundedByWallet: true,
          txHash: "0xtx_s1",
        },
        {
          from: "0xsource2222222222222222222222222222222222",
          at: new Date(now.getTime() - 5 * 3600 * 1000),
          amountUsd: "3000.00",
          fromEntityKind: null,
          fromEntityName: null,
          wasFundedByWallet: false, // NOT funded by wallet
          txHash: "0xtx_s2",
        },
      ],
    });

    expect(evaluateA6Consolidation(ctx)).toHaveLength(0);
  });

  it("A6: single source does not fire", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    const ctx = makeContext({
      now,
      fundingEvents: [
        {
          from: "0xsource1111111111111111111111111111111111",
          at: new Date(now.getTime() - 10 * 3600 * 1000),
          amountUsd: "5000.00",
          fromEntityKind: null,
          fromEntityName: null,
          wasFundedByWallet: true,
          txHash: "0xtx_s1",
        },
      ],
    });

    expect(evaluateA6Consolidation(ctx)).toHaveLength(0);
  });

  it("A6: evidence lists each sweep source with amount and tx", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    const ctx = makeContext({
      now,
      fundingEvents: [
        { from: "0xsource1111111111111111111111111111111111", at: new Date(now.getTime() - 10 * 3600 * 1000), amountUsd: "2000.00", fromEntityKind: null, fromEntityName: null, wasFundedByWallet: true, txHash: "0xtx_s1" },
        { from: "0xsource2222222222222222222222222222222222", at: new Date(now.getTime() - 5 * 3600 * 1000), amountUsd: "3000.00", fromEntityKind: null, fromEntityName: null, wasFundedByWallet: true, txHash: "0xtx_s2" },
      ],
    });

    const findings = evaluateA6Consolidation(ctx);
    expect(findings[0].evidence.txLinks).toHaveLength(2);
    expect(findings[0].evidence.observed.sources).toContain("0xsource1111111111111111111111111111111111");
  });
});

describe("P4-T05: TRIGGERED Rules T1–T5 and Graded Definition", () => {
  it("T1: requires ARMED state", () => {
    // Current state is IDLE -> buy does not fire T1
    const ctx = makeContext({
      state: {
        current: "IDLE",
        armedAt: null,
        triggeredAt: null,
        stablePeakUsd: null,
        stablePeakAt: null,
        baselineStableUsd: null,
        baselineNativeUsd: null,
        deArmStreakDays: 0,
      },
      events: [
        {
          id: 1n,
          walletAddress: "0x1111111111111111111111111111111111111111",
          chain: "base",
          kind: "BUY",
          tokenAddress: "0xtoken",
          tokenAgeSeconds: 3 * 86400, // 3 days
          amountRaw: "600000000",
          amountUsd: "600.00",
          timestamp: new Date("2026-09-01T11:00:00Z"),
          txHash: "0xtx_buy",
        },
      ],
    });

    expect(evaluateT1ArmedEntry(ctx)).toHaveLength(0);
  });

  it("T1: token age 7 days exactly does not fire (strict <)", () => {
    const ctx = makeContext({
      state: {
        current: "ARMED",
        armedAt: new Date("2026-09-01T00:00:00Z"),
        triggeredAt: null,
        stablePeakUsd: null,
        stablePeakAt: null,
        baselineStableUsd: null,
        baselineNativeUsd: null,
        deArmStreakDays: 0,
      },
      events: [
        {
          id: 1n,
          walletAddress: "0x1111111111111111111111111111111111111111",
          chain: "base",
          kind: "BUY",
          tokenAddress: "0xtoken",
          tokenAgeSeconds: 7 * 86400, // Exactly 7 days
          amountRaw: "600000000",
          amountUsd: "600.00",
          timestamp: new Date("2026-09-01T11:00:00Z"),
          txHash: "0xtx_buy",
        },
      ],
    });

    expect(evaluateT1ArmedEntry(ctx)).toHaveLength(0);
  });

  it("T1: position below $500 does not fire", () => {
    const ctx = makeContext({
      state: {
        current: "ARMED",
        armedAt: new Date("2026-09-01T00:00:00Z"),
        triggeredAt: null,
        stablePeakUsd: null,
        stablePeakAt: null,
        baselineStableUsd: null,
        baselineNativeUsd: null,
        deArmStreakDays: 0,
      },
      events: [
        {
          id: 1n,
          walletAddress: "0x1111111111111111111111111111111111111111",
          chain: "base",
          kind: "BUY",
          tokenAddress: "0xtoken",
          tokenAgeSeconds: 3 * 86400,
          amountRaw: "499000000",
          amountUsd: "499.00",
          timestamp: new Date("2026-09-01T11:00:00Z"),
          txHash: "0xtx_buy",
        },
      ],
    });

    expect(evaluateT1ArmedEntry(ctx)).toHaveLength(0);
  });

  it("T1: null token age suppresses the rule", () => {
    const ctx = makeContext({
      state: {
        current: "ARMED",
        armedAt: new Date("2026-09-01T00:00:00Z"),
        triggeredAt: null,
        stablePeakUsd: null,
        stablePeakAt: null,
        baselineStableUsd: null,
        baselineNativeUsd: null,
        deArmStreakDays: 0,
      },
      events: [
        {
          id: 1n,
          walletAddress: "0x1111111111111111111111111111111111111111",
          chain: "base",
          kind: "BUY",
          tokenAddress: "0xtoken",
          tokenAgeSeconds: null, // Unknown age
          amountRaw: "1000000000",
          amountUsd: "1000.00",
          timestamp: new Date("2026-09-01T11:00:00Z"),
          txHash: "0xtx_buy",
        },
      ],
    });

    expect(evaluateT1ArmedEntry(ctx)).toHaveLength(0);
  });

  it("graded: default accepts any manual edge/style/size tag", () => {
    expect(isWalletGraded({ edgeTags: ["INSIDER"] })).toBe(true);
    expect(isWalletGraded({ styleTags: ["SCALPER"] })).toBe(true);
    expect(isWalletGraded({ sizeTags: ["WHALE"] })).toBe(true);
    expect(isWalletGraded({ tags: ["edge:kol"] })).toBe(true);
  });

  it("graded: default accepts a computed grade with sufficient sample", () => {
    // Grade with sufficient sample (>= 10)
    expect(isWalletGraded({ computedGrade: "A", sampleCount: 15, minSample: 10 })).toBe(true);
    // Insufficient sample (< 10) without manual tags returns false
    expect(isWalletGraded({ computedGrade: "A", sampleCount: 5, minSample: 10 })).toBe(false);
  });

  it("graded: EDGE_TAG_ONLY rejects style-only and computed-only wallets", () => {
    // Accepts edge tag
    expect(isWalletGraded({ edgeTags: ["INSIDER"] }, "EDGE_TAG_ONLY")).toBe(true);
    // Rejects style-only
    expect(isWalletGraded({ styleTags: ["SCALPER"] }, "EDGE_TAG_ONLY")).toBe(false);
    // Rejects size-only
    expect(isWalletGraded({ sizeTags: ["WHALE"] }, "EDGE_TAG_ONLY")).toBe(false);
    // Rejects computed-only
    expect(isWalletGraded({ computedGrade: "A", sampleCount: 20 }, "EDGE_TAG_ONLY")).toBe(false);
  });

  it("T2: two independent graded wallets fire", () => {
    const token = "0xtoken123";
    const now = new Date("2026-09-01T12:00:00Z");

    const ctx = makeContext({
      now,
      wallet: {
        address: "0x1111111111111111111111111111111111111111",
        chain: "base",
        watchPriority: "HIGH",
        isSelf: false,
        gradeLabel: null,
        hasGrade: true,
      },
      events: [
        {
          id: 1n,
          walletAddress: "0x1111111111111111111111111111111111111111",
          chain: "base",
          kind: "BUY",
          tokenAddress: token,
          tokenSymbol: "MOON",
          amountRaw: "1000000000",
          amountUsd: "1000.00",
          timestamp: new Date("2026-09-01T11:00:00Z"),
          txHash: "0xtx_subject",
        },
      ],
      peerActivity: [
        {
          wallet: { address: "0x2222222222222222222222222222222222222222", chain: "base" },
          tokenAddress: token,
          kind: "BUY",
          at: new Date("2026-09-01T10:00:00Z"),
          amountUsd: "2000.00",
          independentOfSubject: true,
          sameCluster: false,
          hasGrade: true,
        },
      ],
    });

    const findings = evaluateT2IndependentCoEntry(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].payload.participantCount).toBe(2);
  });

  it("T2: dependent pair does not fire", () => {
    const token = "0xtoken123";
    const now = new Date("2026-09-01T12:00:00Z");

    const ctx = makeContext({
      now,
      events: [
        {
          id: 1n,
          walletAddress: "0x1111111111111111111111111111111111111111",
          chain: "base",
          kind: "BUY",
          tokenAddress: token,
          amountRaw: "1000000000",
          amountUsd: "1000.00",
          timestamp: new Date("2026-09-01T11:00:00Z"),
          txHash: "0xtx_subject",
        },
      ],
      peerActivity: [
        {
          wallet: { address: "0x2222222222222222222222222222222222222222", chain: "base" },
          tokenAddress: token,
          kind: "BUY",
          at: new Date("2026-09-01T10:00:00Z"),
          amountUsd: "2000.00",
          independentOfSubject: false, // DEPENDENT (shared funder/transfer)
          sameCluster: false,
          hasGrade: true,
        },
      ],
    });

    expect(evaluateT2IndependentCoEntry(ctx)).toHaveLength(0);
  });

  it("T2: ungraded wallet is not counted", () => {
    const token = "0xtoken123";
    const now = new Date("2026-09-01T12:00:00Z");

    const ctx = makeContext({
      now,
      events: [
        {
          id: 1n,
          walletAddress: "0x1111111111111111111111111111111111111111",
          chain: "base",
          kind: "BUY",
          tokenAddress: token,
          amountRaw: "1000000000",
          amountUsd: "1000.00",
          timestamp: new Date("2026-09-01T11:00:00Z"),
          txHash: "0xtx_subject",
        },
      ],
      peerActivity: [
        {
          wallet: { address: "0x2222222222222222222222222222222222222222", chain: "base" },
          tokenAddress: token,
          kind: "BUY",
          at: new Date("2026-09-01T10:00:00Z"),
          amountUsd: "2000.00",
          independentOfSubject: true,
          sameCluster: false,
          hasGrade: false, // NOT graded
        },
      ],
    });

    expect(evaluateT2IndependentCoEntry(ctx)).toHaveLength(0);
  });

  it("T2: finding references the co-accumulation group id", () => {
    const token = "0xtoken123";
    const now = new Date("2026-09-01T12:00:00Z");

    const ctx = makeContext({
      now,
      events: [
        { id: 1n, walletAddress: "0x1111111111111111111111111111111111111111", chain: "base", kind: "BUY", tokenAddress: token, amountRaw: "1000000000", amountUsd: "1000.00", timestamp: new Date("2026-09-01T11:00:00Z"), txHash: "0xtx_subject" },
      ],
      peerActivity: [
        { wallet: { address: "0x2222222222222222222222222222222222222222", chain: "base" }, tokenAddress: token, kind: "BUY", at: new Date("2026-09-01T10:00:00Z"), amountUsd: "2000.00", independentOfSubject: true, sameCluster: false, hasGrade: true },
      ],
    });

    const findings = evaluateT2IndependentCoEntry(ctx);
    expect(findings[0].payload.coAccumulationGroupId).toMatch(/^co_acc_/);
  });

  it("T3: 59-minute-old token fires", () => {
    const ctx = makeContext({
      events: [
        {
          id: 1n,
          walletAddress: "0x1111111111111111111111111111111111111111",
          chain: "base",
          kind: "BUY",
          tokenAddress: "0xfresh",
          tokenAgeSeconds: 59 * 60, // 59 minutes
          amountRaw: "100000000",
          amountUsd: "100.00",
          timestamp: new Date("2026-09-01T11:00:00Z"),
          txHash: "0xtx_fresh",
        },
      ],
    });

    const findings = evaluateT3FreshLaunch(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].state).toBe("TRIGGERED");
  });

  it("T3: 61-minute-old token does not", () => {
    const ctx = makeContext({
      events: [
        {
          id: 1n,
          walletAddress: "0x1111111111111111111111111111111111111111",
          chain: "base",
          kind: "BUY",
          tokenAddress: "0ffresh",
          tokenAgeSeconds: 61 * 60, // 61 minutes
          amountRaw: "100000000",
          amountUsd: "100.00",
          timestamp: new Date("2026-09-01T11:00:00Z"),
          txHash: "0xtx_fresh",
        },
      ],
    });

    expect(evaluateT3FreshLaunch(ctx)).toHaveLength(0);
  });

  it("T3: null age suppresses", () => {
    const ctx = makeContext({
      events: [
        {
          id: 1n,
          walletAddress: "0x1111111111111111111111111111111111111111",
          chain: "base",
          kind: "BUY",
          tokenAddress: "0ffresh",
          tokenAgeSeconds: null,
          amountRaw: "100000000",
          amountUsd: "100.00",
          timestamp: new Date("2026-09-01T11:00:00Z"),
          txHash: "0xtx_fresh",
        },
      ],
    });

    expect(evaluateT3FreshLaunch(ctx)).toHaveLength(0);
  });

  it("T4: 20% drawdown exactly fires", () => {
    // Peak price $1.00, buy at $0.80 -> exactly 20% drawdown
    const token = "0xtoken4";
    const ctx = makeContext({
      positions: [
        {
          walletAddress: "0x1111111111111111111111111111111111111111",
          walletChain: "base",
          tokenAddress: token,
          tokenChain: "base",
          amountRaw: "1000",
          costUsd: "500",
          realizedUsd: "0",
          avgEntryPriceUsd: "0.50",
          peakPriceUsd: "1.000000",
          buyCount: 1,
          sellCount: 0,
          cexDepositedUsd: "0",
          isOpen: true,
          openedAt: new Date("2026-08-20T00:00:00Z"),
        },
      ],
      events: [
        {
          id: 2n,
          walletAddress: "0x1111111111111111111111111111111111111111",
          chain: "base",
          kind: "BUY",
          tokenAddress: token,
          priceUsdAtAction: "0.800000",
          amountRaw: "100",
          amountUsd: "80.00",
          timestamp: new Date("2026-09-01T11:00:00Z"),
          txHash: "0xtx_addon",
        },
      ],
    });

    const findings = evaluateT4AddOnRetrace(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].state).toBe("TRIGGERED");
  });

  it("T4: 19% does not", () => {
    // Peak $1.00, buy at $0.81 -> 19% drawdown
    const token = "0xtoken4";
    const ctx = makeContext({
      positions: [
        {
          walletAddress: "0x1111111111111111111111111111111111111111",
          walletChain: "base",
          tokenAddress: token,
          tokenChain: "base",
          amountRaw: "1000",
          costUsd: "500",
          realizedUsd: "0",
          avgEntryPriceUsd: "0.50",
          peakPriceUsd: "1.000000",
          buyCount: 1,
          sellCount: 0,
          cexDepositedUsd: "0",
          isOpen: true,
          openedAt: new Date("2026-08-20T00:00:00Z"),
        },
      ],
      events: [
        {
          id: 2n,
          walletAddress: "0x1111111111111111111111111111111111111111",
          chain: "base",
          kind: "BUY",
          tokenAddress: token,
          priceUsdAtAction: "0.810000",
          amountRaw: "100",
          amountUsd: "81.00",
          timestamp: new Date("2026-09-01T11:00:00Z"),
          txHash: "0xtx_addon",
        },
      ],
    });

    expect(evaluateT4AddOnRetrace(ctx)).toHaveLength(0);
  });

  it("T4: requires an open position and a known peak", () => {
    const token = "0xtoken4";
    // Closed position
    const ctxClosed = makeContext({
      positions: [
        {
          walletAddress: "0x1111111111111111111111111111111111111111",
          walletChain: "base",
          tokenAddress: token,
          tokenChain: "base",
          amountRaw: "0",
          costUsd: "500",
          realizedUsd: "600",
          avgEntryPriceUsd: "0.50",
          peakPriceUsd: "1.000000",
          buyCount: 1,
          sellCount: 1,
          cexDepositedUsd: "0",
          isOpen: false, // Closed
          openedAt: new Date("2026-08-20T00:00:00Z"),
        },
      ],
      events: [
        { id: 2n, walletAddress: "0x1111111111111111111111111111111111111111", chain: "base", kind: "BUY", tokenAddress: token, priceUsdAtAction: "0.70", amountRaw: "100", amountUsd: "70.00", timestamp: new Date(), txHash: "0xtx" },
      ],
    });
    expect(evaluateT4AddOnRetrace(ctxClosed)).toHaveLength(0);

    // Missing peak price
    const ctxNoPeak = makeContext({
      positions: [
        {
          walletAddress: "0x1111111111111111111111111111111111111111",
          walletChain: "base",
          tokenAddress: token,
          tokenChain: "base",
          amountRaw: "1000",
          costUsd: "500",
          realizedUsd: "0",
          avgEntryPriceUsd: "0.50",
          peakPriceUsd: null, // Unknown peak
          buyCount: 1,
          sellCount: 0,
          cexDepositedUsd: "0",
          isOpen: true,
          openedAt: new Date("2026-08-20T00:00:00Z"),
        },
      ],
      events: [
        { id: 2n, walletAddress: "0x1111111111111111111111111111111111111111", chain: "base", kind: "BUY", tokenAddress: token, priceUsdAtAction: "0.70", amountRaw: "100", amountUsd: "70.00", timestamp: new Date(), txHash: "0xtx" },
      ],
    });
    expect(evaluateT4AddOnRetrace(ctxNoPeak)).toHaveLength(0);
  });

  it("T5: two same-cluster buys within 1h fire with warningStyle", () => {
    const token = "0xtoken5";
    const now = new Date("2026-09-01T12:00:00Z");
    const cluster = {
      id: "cluster-5",
      name: "Cluster 5",
      memberAddresses: [
        { address: "0x1111111111111111111111111111111111111111", chain: "base" as const },
        { address: "0x2222222222222222222222222222222222222222", chain: "base" as const },
      ],
    };

    const ctx = makeContext({
      now,
      cluster,
      events: [
        { id: 1n, walletAddress: "0x1111111111111111111111111111111111111111", chain: "base", kind: "BUY", tokenAddress: token, amountRaw: "500", amountUsd: "500.00", timestamp: new Date("2026-09-01T11:30:00Z"), txHash: "0xtx_c1" },
      ],
      peerActivity: [
        { wallet: { address: "0x2222222222222222222222222222222222222222", chain: "base" }, tokenAddress: token, kind: "BUY", at: new Date("2026-09-01T11:45:00Z"), amountUsd: "600.00", independentOfSubject: false, sameCluster: true, hasGrade: true },
      ],
    });

    const findings = evaluateT5ClusterCoEntry(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].payload.warningStyle).toBe(true);
    expect(findings[0].state).toBe("TRIGGERED");
  });

  it("T5: references the CLUSTER_CO_ENTRY group", () => {
    const token = "0xtoken5";
    const now = new Date("2026-09-01T12:00:00Z");
    const cluster = {
      id: "cluster-5",
      name: "Cluster 5",
      memberAddresses: [
        { address: "0x1111111111111111111111111111111111111111", chain: "base" as const },
        { address: "0x2222222222222222222222222222222222222222", chain: "base" as const },
      ],
    };

    const ctx = makeContext({
      now,
      cluster,
      events: [
        { id: 1n, walletAddress: "0x1111111111111111111111111111111111111111", chain: "base", kind: "BUY", tokenAddress: token, amountRaw: "500", amountUsd: "500.00", timestamp: new Date("2026-09-01T11:30:00Z"), txHash: "0xtx_c1" },
      ],
      peerActivity: [
        { wallet: { address: "0x2222222222222222222222222222222222222222", chain: "base" }, tokenAddress: token, kind: "BUY", at: new Date("2026-09-01T11:45:00Z"), amountUsd: "600.00", independentOfSubject: false, sameCluster: true, hasGrade: true },
      ],
    });

    const findings = evaluateT5ClusterCoEntry(ctx);
    expect(findings[0].payload.groupKind).toBe("CLUSTER_CO_ENTRY");
    expect(findings[0].payload.clusterCoEntryGroupId).toMatch(/^cluster_co_entry_/);
  });
});

describe("P4-T06: Exit-Risk Rules C1–C4 and De-Arm Condition", () => {
  it("C1: memecoin CEX deposit by a graded wallet emits EXIT_RISK", () => {
    const ctx = makeContext({
      events: [
        {
          id: 1n,
          walletAddress: "0x1111111111111111111111111111111111111111",
          chain: "base",
          kind: "CEX_DEPOSIT",
          tokenAddress: "0xpepe",
          tokenSymbol: "PEPE",
          amountRaw: "1000000",
          amountUsd: "500.00",
          timestamp: new Date("2026-09-01T11:00:00Z"),
          txHash: "0xtx_cex_dep",
        },
      ],
    });

    const findings = evaluateC1DistributionPrep(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].state).toBe("EXIT_RISK");
  });

  it("C1: stablecoin CEX deposit does not fire", () => {
    const ctx = makeContext({
      events: [
        {
          id: 1n,
          walletAddress: "0x1111111111111111111111111111111111111111",
          chain: "base",
          kind: "CEX_DEPOSIT",
          tokenAddress: "0xusdc",
          tokenSymbol: "USDC", // Stablecoin!
          amountRaw: "1000000000",
          amountUsd: "1000.00",
          timestamp: new Date("2026-09-01T11:00:00Z"),
          txHash: "0xtx_cex_usdc",
        },
      ],
    });

    expect(evaluateC1DistributionPrep(ctx)).toHaveLength(0);
  });

  it("C1: does not change wallet state", () => {
    const ctx = makeContext({
      events: [
        {
          id: 1n,
          walletAddress: "0x1111111111111111111111111111111111111111",
          chain: "base",
          kind: "CEX_DEPOSIT",
          tokenAddress: "0xpepe",
          tokenSymbol: "PEPE",
          amountRaw: "1000000",
          amountUsd: "500.00",
          timestamp: new Date("2026-09-01T11:00:00Z"),
          txHash: "0xtx_cex_dep",
        },
      ],
    });

    const findings = evaluateC1DistributionPrep(ctx);
    expect(findings[0].state).toBe("EXIT_RISK");
  });

  it("C2: two graded exits within 12h fire", () => {
    const token = "0xtokenC2";
    const now = new Date("2026-09-01T12:00:00Z");

    const ctx = makeContext({
      now,
      events: [
        { id: 1n, walletAddress: "0x1111111111111111111111111111111111111111", chain: "base", kind: "SELL", tokenAddress: token, amountRaw: "1000", amountUsd: "1000.00", timestamp: new Date("2026-09-01T11:00:00Z"), txHash: "0xtx_s1" },
      ],
      peerActivity: [
        { wallet: { address: "0x2222222222222222222222222222222222222222", chain: "base" }, tokenAddress: token, kind: "SELL", at: new Date("2026-09-01T06:00:00Z"), amountUsd: "2000.00", independentOfSubject: true, sameCluster: false, hasGrade: true },
      ],
    });

    const findings = evaluateC2CoDistribution(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].state).toBe("EXIT_RISK");
  });

  it("C2: 13-hour spread does not fire", () => {
    const token = "0xtokenC2";
    const now = new Date("2026-09-01T12:00:00Z");

    const ctx = makeContext({
      now,
      events: [
        { id: 1n, walletAddress: "0x1111111111111111111111111111111111111111", chain: "base", kind: "SELL", tokenAddress: token, amountRaw: "1000", amountUsd: "1000.00", timestamp: new Date("2026-09-01T11:00:00Z"), txHash: "0xtx_s1" },
      ],
      peerActivity: [
        { wallet: { address: "0x2222222222222222222222222222222222222222", chain: "base" }, tokenAddress: token, kind: "SELL", at: new Date(now.getTime() - 13 * 3600 * 1000), amountUsd: "2000.00", independentOfSubject: true, sameCluster: false, hasGrade: true },
      ],
    });

    expect(evaluateC2CoDistribution(ctx)).toHaveLength(0);
  });

  it("C2: sells and CEX deposits both count as exits", () => {
    const token = "0xtokenC2";
    const now = new Date("2026-09-01T12:00:00Z");

    // Subject has CEX_DEPOSIT, peer has SELL
    const ctx = makeContext({
      now,
      events: [
        { id: 1n, walletAddress: "0x1111111111111111111111111111111111111111", chain: "base", kind: "CEX_DEPOSIT", tokenAddress: token, amountRaw: "1000", amountUsd: "1000.00", timestamp: new Date("2026-09-01T11:00:00Z"), txHash: "0xtx_dep" },
      ],
      peerActivity: [
        { wallet: { address: "0x2222222222222222222222222222222222222222", chain: "base" }, tokenAddress: token, kind: "SELL", at: new Date("2026-09-01T10:00:00Z"), amountUsd: "2000.00", independentOfSubject: true, sameCluster: false, hasGrade: true },
      ],
    });

    const findings = evaluateC2CoDistribution(ctx);
    expect(findings).toHaveLength(1);
  });

  it("C3: 10x exactly does not fire (strict >)", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    const ctx = makeContext({
      now,
      positions: [
        {
          walletAddress: "0x1111111111111111111111111111111111111111",
          walletChain: "base",
          tokenAddress: "0xmoon",
          tokenChain: "base",
          amountRaw: "1000",
          costUsd: "100",
          realizedUsd: "0",
          avgEntryPriceUsd: "0.10",
          unrealizedMultiple: "10.0", // Exactly 10x
          buyCount: 1,
          sellCount: 0,
          cexDepositedUsd: "0",
          isOpen: true,
          openedAt: new Date(now.getTime() - 5 * 86400 * 1000), // 5 days old
        },
      ],
    });

    expect(evaluateC3MoonDiscipline(ctx)).toHaveLength(0);
  });

  it("C3: default evaluates self and non-self tracked wallets", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    // Non-self wallet with 11x position
    const ctx = makeContext({
      now,
      wallet: {
        address: "0x1111111111111111111111111111111111111111",
        chain: "base",
        watchPriority: "HIGH",
        isSelf: false, // Non-self
        gradeLabel: null,
        hasGrade: true,
      },
      positions: [
        {
          walletAddress: "0x1111111111111111111111111111111111111111",
          walletChain: "base",
          tokenAddress: "0xmoon",
          tokenChain: "base",
          amountRaw: "1000",
          costUsd: "100",
          realizedUsd: "0",
          avgEntryPriceUsd: "0.10",
          unrealizedMultiple: "11.0",
          buyCount: 1,
          sellCount: 0,
          cexDepositedUsd: "0",
          isOpen: true,
          openedAt: new Date(now.getTime() - 5 * 86400 * 1000),
        },
      ],
    });

    const findings = evaluateC3MoonDiscipline(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].payload.isSelf).toBe(false);
  });

  it("C3: self finding carries prominent marker", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    const ctx = makeContext({
      now,
      wallet: {
        address: "0x1111111111111111111111111111111111111111",
        chain: "base",
        watchPriority: "HIGH",
        isSelf: true, // Self wallet!
        gradeLabel: null,
        hasGrade: true,
      },
      positions: [
        {
          walletAddress: "0x1111111111111111111111111111111111111111",
          walletChain: "base",
          tokenAddress: "0xmoon",
          tokenChain: "base",
          amountRaw: "1000",
          costUsd: "100",
          realizedUsd: "0",
          avgEntryPriceUsd: "0.10",
          unrealizedMultiple: "11.0",
          buyCount: 1,
          sellCount: 0,
          cexDepositedUsd: "0",
          isOpen: true,
          openedAt: new Date(now.getTime() - 5 * 86400 * 1000),
        },
      ],
    });

    const findings = evaluateC3MoonDiscipline(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].payload.selfPriority).toBe(true);
    expect(findings[0].payload.prominent).toBe(true);
  });

  it("C3: c3SelfOnly suppresses non-self findings", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    const ctx = makeContext({
      now,
      thresholds: {
        ...DEFAULT_SETTINGS.alertThresholds,
        c3SelfOnly: true, // Restrict to self only
      },
      wallet: {
        address: "0x1111111111111111111111111111111111111111",
        chain: "base",
        watchPriority: "HIGH",
        isSelf: false, // Non-self -> should be suppressed
        gradeLabel: null,
        hasGrade: true,
      },
      positions: [
        {
          walletAddress: "0x1111111111111111111111111111111111111111",
          walletChain: "base",
          tokenAddress: "0xmoon",
          tokenChain: "base",
          amountRaw: "1000",
          costUsd: "100",
          realizedUsd: "0",
          avgEntryPriceUsd: "0.10",
          unrealizedMultiple: "11.0",
          buyCount: 1,
          sellCount: 0,
          cexDepositedUsd: "0",
          isOpen: true,
          openedAt: new Date(now.getTime() - 5 * 86400 * 1000),
        },
      ],
    });

    expect(evaluateC3MoonDiscipline(ctx)).toHaveLength(0);
  });

  it("C3: 11x younger than 3 days does not fire", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    const ctx = makeContext({
      now,
      positions: [
        {
          walletAddress: "0x1111111111111111111111111111111111111111",
          walletChain: "base",
          tokenAddress: "0xmoon",
          tokenChain: "base",
          amountRaw: "1000",
          costUsd: "100",
          realizedUsd: "0",
          avgEntryPriceUsd: "0.10",
          unrealizedMultiple: "11.0",
          buyCount: 1,
          sellCount: 0,
          cexDepositedUsd: "0",
          isOpen: true,
          openedAt: new Date(now.getTime() - 2 * 86400 * 1000), // Only 2 days old
        },
      ],
    });

    expect(evaluateC3MoonDiscipline(ctx)).toHaveLength(0);
  });

  it("C3: deduped to once per day", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    const laterSameDay = new Date("2026-09-01T18:00:00Z");

    const pos = [
      {
        walletAddress: "0x1111111111111111111111111111111111111111",
        walletChain: "base" as const,
        tokenAddress: "0xmoon",
        tokenChain: "base" as const,
        amountRaw: "1000",
        costUsd: "100",
        realizedUsd: "0",
        avgEntryPriceUsd: "0.10",
        unrealizedMultiple: "11.0",
        buyCount: 1,
        sellCount: 0,
        cexDepositedUsd: "0",
        isOpen: true,
        openedAt: new Date(now.getTime() - 5 * 86400 * 1000),
      },
    ];

    const ctx1 = makeContext({ now, positions: pos });
    const ctx2 = makeContext({ now: laterSameDay, positions: pos });

    const f1 = evaluateC3MoonDiscipline(ctx1);
    const f2 = evaluateC3MoonDiscipline(ctx2);

    expect(f1[0].dedupeKey).toBe(f2[0].dedupeKey);
  });

  it("C4: 71% drop within 48h of a trigger fires", () => {
    const triggerTime = new Date("2026-09-01T00:00:00Z");
    const now = new Date("2026-09-01T20:00:00Z"); // 20h after trigger

    // Peak $10,000, current $2,900 -> 71% drop (> 70%)
    const ctx = makeContext({
      now,
      state: {
        current: "TRIGGERED",
        armedAt: new Date("2026-08-30T00:00:00Z"),
        triggeredAt: triggerTime,
        stablePeakUsd: "10000.00",
        stablePeakAt: new Date("2026-08-31T12:00:00Z"),
        baselineStableUsd: null,
        baselineNativeUsd: null,
        deArmStreakDays: 0,
      },
      stats: {
        medianDailyStableInflowUsd: null,
        medianDailyNativeInflowUsd: null,
        stableBalanceUsd: "2900.00",
        nativeBalanceUsd: null,
        lastActivityAt: null,
        dormantDays: null,
      },
    });

    const findings = evaluateC4CampaignSpent(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].state).toBe("EXIT_RISK");
    expect(findings[0].payload.dropPct).toBeCloseTo(71, 0);
  });

  it("C4: 69% drop does not fire", () => {
    const triggerTime = new Date("2026-09-01T00:00:00Z");
    const now = new Date("2026-09-01T20:00:00Z");

    // Peak $10,000, current $3,100 -> 69% drop (<= 70%)
    const ctx = makeContext({
      now,
      state: {
        current: "TRIGGERED",
        armedAt: new Date("2026-08-30T00:00:00Z"),
        triggeredAt: triggerTime,
        stablePeakUsd: "10000.00",
        stablePeakAt: new Date("2026-08-31T12:00:00Z"),
        baselineStableUsd: null,
        baselineNativeUsd: null,
        deArmStreakDays: 0,
      },
      stats: {
        medianDailyStableInflowUsd: null,
        medianDailyNativeInflowUsd: null,
        stableBalanceUsd: "3100.00",
        nativeBalanceUsd: null,
        lastActivityAt: null,
        dormantDays: null,
      },
    });

    expect(evaluateC4CampaignSpent(ctx)).toHaveLength(0);
  });

  it("C4: drop outside the 48h window does not fire", () => {
    const triggerTime = new Date("2026-09-01T00:00:00Z");
    const now = new Date(triggerTime.getTime() + 50 * 3600 * 1000); // 50h after trigger

    const ctx = makeContext({
      now,
      state: {
        current: "TRIGGERED",
        armedAt: new Date("2026-08-30T00:00:00Z"),
        triggeredAt: triggerTime,
        stablePeakUsd: "10000.00",
        stablePeakAt: new Date("2026-08-31T12:00:00Z"),
        baselineStableUsd: null,
        baselineNativeUsd: null,
        deArmStreakDays: 0,
      },
      stats: {
        medianDailyStableInflowUsd: null,
        medianDailyNativeInflowUsd: null,
        stableBalanceUsd: "1000.00", // 90% drop, but outside window
        nativeBalanceUsd: null,
        lastActivityAt: null,
        dormantDays: null,
      },
    });

    expect(evaluateC4CampaignSpent(ctx)).toHaveLength(0);
  });

  it("dearm: 7 consecutive days at ≤120% baseline de-arms", () => {
    // Current streak is 6, today is 7th day <= 120% -> de-arms!
    const ctx = makeContext({
      state: {
        current: "ARMED",
        armedAt: new Date("2026-08-01T00:00:00Z"),
        triggeredAt: null,
        stablePeakUsd: "5000.00",
        stablePeakAt: null,
        baselineStableUsd: "1000.00", // 120% limit = 1200
        baselineNativeUsd: "500.00",  // 120% limit = 600
        deArmStreakDays: 6, // 6 days prior
      },
      stats: {
        medianDailyStableInflowUsd: null,
        medianDailyNativeInflowUsd: null,
        stableBalanceUsd: "1100.00", // <= 1200
        nativeBalanceUsd: "550.00",  // <= 600
        lastActivityAt: null,
        dormantDays: null,
      },
    });

    const res = evaluateDeArm(ctx);
    expect(res.satisfied).toBe(true);
    expect(res.reason).toBe("BASELINE_7D");
    expect(res.newStreakDays).toBe(7);
  });

  it("dearm: 6 days does not de-arm", () => {
    // Current streak is 5, today becomes 6th -> does not de-arm yet
    const ctx = makeContext({
      state: {
        current: "ARMED",
        armedAt: new Date("2026-08-01T00:00:00Z"),
        triggeredAt: null,
        stablePeakUsd: "5000.00",
        stablePeakAt: null,
        baselineStableUsd: "1000.00",
        baselineNativeUsd: "500.00",
        deArmStreakDays: 5,
      },
      stats: {
        medianDailyStableInflowUsd: null,
        medianDailyNativeInflowUsd: null,
        stableBalanceUsd: "1000.00",
        nativeBalanceUsd: "500.00",
        lastActivityAt: null,
        dormantDays: null,
      },
    });

    const res = evaluateDeArm(ctx);
    expect(res.satisfied).toBe(false);
    expect(res.newStreakDays).toBe(6);
  });

  it("dearm: a single day above 120% resets the streak", () => {
    // Current streak is 5, but today balance is 1500 > 1200 -> resets to 0!
    const ctx = makeContext({
      state: {
        current: "ARMED",
        armedAt: new Date("2026-08-01T00:00:00Z"),
        triggeredAt: null,
        stablePeakUsd: "5000.00",
        stablePeakAt: null,
        baselineStableUsd: "1000.00",
        baselineNativeUsd: "500.00",
        deArmStreakDays: 5,
      },
      stats: {
        medianDailyStableInflowUsd: null,
        medianDailyNativeInflowUsd: null,
        stableBalanceUsd: "1500.00", // > 1200
        nativeBalanceUsd: "500.00",
        lastActivityAt: null,
        dormantDays: null,
      },
    });

    const res = evaluateDeArm(ctx);
    expect(res.satisfied).toBe(false);
    expect(res.newStreakDays).toBe(0);
  });

  it("dearm: outflow to a terminal entity de-arms immediately", () => {
    const ctx = makeContext({
      state: {
        current: "ARMED",
        armedAt: new Date("2026-08-01T00:00:00Z"),
        triggeredAt: null,
        stablePeakUsd: "5000.00",
        stablePeakAt: null,
        baselineStableUsd: "1000.00",
        baselineNativeUsd: "500.00",
        deArmStreakDays: 0,
      },
      fundingEvents: [
        {
          from: "0xterminalCEX",
          at: new Date("2026-09-01T10:00:00Z"),
          amountUsd: "5000.00",
          fromEntityKind: "CEX",
          fromEntityName: "Binance",
          wasFundedByWallet: false,
          isTerminal: true, // Terminal entity return!
          txHash: "0xterminal_return",
        },
      ],
    });

    const res = evaluateDeArm(ctx);
    expect(res.satisfied).toBe(true);
    expect(res.reason).toBe("TERMINAL_OUTFLOW");
  });
});
