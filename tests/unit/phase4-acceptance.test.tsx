import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

vi.mock("@/server/db/client", () => ({
  prisma: {},
}));

vi.mock("@/server/services/settings", async () => {
  const { DEFAULT_SETTINGS } = await import("@/lib/settings-schema");
  return {
    loadSettings: vi.fn().mockResolvedValue(DEFAULT_SETTINGS),
  };
});

import { evaluateAlerts } from "@/server/services/alert/evaluate";
import { applyStateTransition } from "@/server/services/alert/state-machine";
import { validateEvidence } from "@/lib/rules/evidence";
import { getAlertStateStyle, StateBadge } from "@/components/shared/StateBadge";
import { EvidenceTooltip } from "@/components/alerts/EvidenceTooltip";
import { ClusterChip } from "@/components/clusters/ClusterChip";
import { DEFAULT_SETTINGS } from "@/lib/settings-schema";
import { buildDedupeKey } from "@/lib/rules/dedupe";
import type { MovementEventRow, RuleContext, RuleFinding } from "@/lib/rules/types";
import { evaluateA1StableArming } from "@/lib/rules/a1-stable-arming";

describe("Phase 4 Acceptance Criteria: Alert Engine & Wallet State Machine (SRS §8)", () => {
  const testWallet = "0x4000000000000000000000000000000000000001";
  const testTxHash = "0x40000000000000000000000000000000000000000000000000000000000000a1";
  const usdcAddress = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

  it("criterion 1: historical backfill of alerts after first sync is ordered and idempotent", async () => {
    // In-memory mock store simulating database state
    const createdAlerts: any[] = [];
    const walletStates = new Map<string, string>([[testWallet, "IDLE"]]);

    const movementEvents: any[] = [
      {
        id: 1n,
        walletAddress: testWallet,
        walletChain: "BASE",
        kind: "STABLE_PARK",
        timestamp: new Date("2026-02-15T12:00:00.000Z"),
        tokenAddress: usdcAddress,
        tokenChain: "BASE",
        tokenSymbol: "USDC",
        amountRaw: "5000000000",
        amountUsd: "5000.00",
        txHash: testTxHash,
        alertEvaluatedAt: null,
      },
      {
        id: 2n,
        walletAddress: testWallet,
        walletChain: "BASE",
        kind: "BUY",
        timestamp: new Date("2026-02-16T14:00:00.000Z"),
        tokenAddress: "0x2222222222222222222222222222222222222222",
        tokenChain: "BASE",
        tokenSymbol: "MEME",
        amountRaw: "1000000000000000000000",
        amountUsd: "1500.00",
        txHash: "0x40000000000000000000000000000000000000000000000000000000000000t1",
        alertEvaluatedAt: null,
      },
    ];

    const mockPrisma: any = {
      movementEvent: {
        findMany: async (args: any) => {
          let list = [...movementEvents];
          if (args.where?.alertEvaluatedAt === null) {
            list = list.filter((m) => m.alertEvaluatedAt === null);
          }
          if (args.where?.timestamp?.gte) {
            list = list.filter((m) => m.timestamp >= args.where.timestamp.gte);
          }
          if (args.where?.timestamp?.lt) {
            list = list.filter((m) => m.timestamp < args.where.timestamp.lt);
          }
          return list;
        },
        updateMany: async ({ where }: any) => {
          let count = 0;
          for (const m of movementEvents) {
            if (where.id?.in) {
              if (where.id.in.includes(m.id)) {
                m.alertEvaluatedAt = new Date();
                count++;
              }
            } else {
              m.alertEvaluatedAt = new Date();
              count++;
            }
          }
          return { count };
        },
      },
      wallet: {
        findUnique: async () => ({
          address: testWallet,
          chain: "BASE",
          watchPriority: "NORMAL",
          isSelf: false,
          edge: "SMART",
          style: "SNIPER",
          size: "W",
        }),
        findMany: async () => [],
      },
      walletState: {
        findUnique: async () => ({
          state: walletStates.get(testWallet) ?? "IDLE",
          walletAddress: testWallet,
          walletChain: "BASE",
          stateReason: null,
          armedAt: null,
          triggeredAt: null,
          stablePeakUsd: null,
          stablePeakAt: null,
          baselineStableUsd: null,
          baselineNativeUsd: null,
          deArmStreakDays: 0,
        }),
        upsert: async ({ create, update }: any) => {
          const next = update.state ?? create.state;
          walletStates.set(testWallet, next);
          return { ...create, ...update, state: next };
        },
      },
      alertEvent: {
        findMany: async (args: any) => {
          if (args?.where?.dedupeKey?.in) {
            const keys = new Set(args.where.dedupeKey.in);
            return createdAlerts.filter((a) => keys.has(a.dedupeKey));
          }
          return createdAlerts;
        },
        createMany: async ({ data }: any) => {
          let added = 0;
          for (const row of data) {
            if (!createdAlerts.some((a) => a.dedupeKey === row.dedupeKey)) {
              createdAlerts.push(row);
              added++;
            }
          }
          return { count: added };
        },
      },
      position: { findMany: async () => [] },
      dailyFlow: { findMany: async () => [] },
      clusterMember: { findFirst: async () => null, findMany: async () => [] },
      cluster: { update: async () => ({}) },
      fundingEvent: { findMany: async () => [] },
      fundingEdge: { findMany: async () => [] },
      walletRelation: { findMany: async () => [] },
      settings: { findUnique: async () => ({ valuesJson: JSON.stringify(DEFAULT_SETTINGS) }) },
    };

    // First backfill run
    const result1 = await evaluateAlerts({
      mode: "BACKFILL",
      from: new Date("2026-02-14T00:00:00.000Z"),
      to: new Date("2026-02-18T00:00:00.000Z"),
      prisma: mockPrisma,
    });

    expect(result1.mode).toBe("BACKFILL");
    expect(result1.alertsCreated).toBeGreaterThanOrEqual(1);
    expect(createdAlerts.length).toBeGreaterThanOrEqual(1);

    // Assert final wallet state evolved to ARMED
    expect(walletStates.get(testWallet)).toBe("ARMED");

    // Second backfill run over identical window -> strictly idempotent (0 new alerts)
    const result2 = await evaluateAlerts({
      mode: "BACKFILL",
      from: new Date("2026-02-14T00:00:00.000Z"),
      to: new Date("2026-02-18T00:00:00.000Z"),
      prisma: mockPrisma,
    });

    expect(result2.alertsCreated).toBe(0);
    expect(result2.alertsSuppressed).toBeGreaterThanOrEqual(1);
  });

  it("criterion 2: stablecoin inflow trips A1 with populated evidence tooltip", () => {
    const occurredAt = new Date("2026-02-15T12:00:00.000Z");

    const stableInflowEvent: MovementEventRow = {
      id: "ev-1",
      walletAddress: testWallet,
      chain: "base",
      kind: "STABLE_PARK",
      tokenAddress: usdcAddress,
      tokenSymbol: "USDC",
      amountRaw: "5000000000",
      amountUsd: "5000.00",
      timestamp: occurredAt,
      txHash: testTxHash,
    };

    const ctx: RuleContext = {
      wallet: {
        address: testWallet,
        chain: "base",
        watchPriority: "NORMAL",
        isSelf: false,
        gradeLabel: "SMART",
        hasGrade: true,
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
      },
      events: [stableInflowEvent],
      stats: {
        medianDailyStableInflowUsd: "500.00",
        medianDailyNativeInflowUsd: "50.00",
        stableBalanceUsd: "5000.00",
        nativeBalanceUsd: "2500.00",
        lastActivityAt: occurredAt,
        dormantDays: 0,
      },
      positions: [],
      cluster: null,
      peerActivity: [],
      fundingEvents: [],
      thresholds: DEFAULT_SETTINGS.alertThresholds,
      now: occurredAt,
    };

    // 1. Evaluate pure rule A1
    const findings = evaluateA1StableArming(ctx);
    expect(findings).toHaveLength(1);

    const a1Finding = findings[0];
    expect(a1Finding.type).toBe("A1");
    expect(a1Finding.state).toBe("ARMED");
    expect(a1Finding.amountUsd).toBe("5000.00");

    // 2. Validate evidence structure
    const validation = validateEvidence(a1Finding.evidence);
    expect(validation.success).toBe(true);
    if (validation.success) {
      expect(validation.data.ruleId).toBe("A1");
      expect(validation.data.ruleText).toContain("stablecoin");
      expect(validation.data.thresholds).toBeDefined();
      expect(validation.data.observed).toBeDefined();
      expect(validation.data.observed?.windowInflowUsd).toBe("5000.00");
      expect(validation.data.txLinks).toHaveLength(1);
      const link = validation.data.txLinks[0];
      const hash = typeof link === "string" ? link : link.hash;
      expect(hash).toBe(testTxHash);
    }

    // 3. State transition from IDLE to ARMED
    const transition = applyStateTransition("IDLE", findings, {
      satisfied: false,
      detail: {},
    });
    expect(transition.nextState).toBe("ARMED");
    expect(transition.stateReason).toBe("A1");
    expect(transition.transitionOccurred).toBe(true);

    // 4. Render EvidenceTooltip component and assert contents
    const tooltipHtml = renderToString(
      <EvidenceTooltip
        evidenceJson={a1Finding.evidence}
        alertType="A1"
      />
    );

    // Verify Rule ID & Description
    expect(tooltipHtml).toContain("A1");
    expect(tooltipHtml).toContain("STABLECOIN ARMING");
    // Verify Thresholds rendered
    expect(tooltipHtml).toContain("Configured Thresholds");
    expect(tooltipHtml).toContain("floorUsd");
    expect(tooltipHtml).toContain("1000");
    // Verify Observed Values rendered
    expect(tooltipHtml).toContain("Observed Metrics");
    expect(tooltipHtml).toContain("5000.00");
    // Verify Explorer Tx Link rendered
    expect(tooltipHtml).toContain("Evidence Transactions");
    expect(tooltipHtml).toContain(testTxHash);
  });

  it("criterion 3: state badges (IDLE / ARMED / TRIGGERED) render across list, graph, and detail", () => {
    // 1. Canonical styling mapping function check
    const idleStyle = getAlertStateStyle("IDLE");
    const armedStyle = getAlertStateStyle("ARMED");
    const triggeredStyle = getAlertStateStyle("TRIGGERED");
    const clusterArmedStyle = getAlertStateStyle(undefined, true);

    expect(idleStyle.borderColor).toBe("#30373D");
    expect(armedStyle.borderColor).toBe("#D7A84B");
    expect(triggeredStyle.borderColor).toBe("#D87870");
    expect(clusterArmedStyle.borderColor).toBe("#D7A84B");
    expect(clusterArmedStyle.borderWidth).toBe(4);

    // 2. StateBadge on wallet list and detail header
    const armedBadgeHtml = renderToString(<StateBadge state="ARMED" subText="A1" />);
    expect(armedBadgeHtml).toContain("badge-armed");
    expect(armedBadgeHtml).toContain("ARMED");
    expect(armedBadgeHtml).toContain("#D7A84B");

    const triggeredBadgeHtml = renderToString(<StateBadge state="TRIGGERED" subText="T1" />);
    expect(triggeredBadgeHtml).toContain("badge-triggered");
    expect(triggeredBadgeHtml).toContain("TRIGGERED");
    expect(triggeredBadgeHtml).toContain("#D87870");

    // 3. Cluster chip escalated treatment
    const clusterArmedHtml = renderToString(
      <ClusterChip
        cluster={{
          id: "cluster-alpha",
          name: "Alpha Cluster",
          colorHex: "#D7A84B",
          isArmed: true,
        }}
        clickable={false}
      />
    );
    expect(clusterArmedHtml).toContain('data-armed="true"');
    expect(clusterArmedHtml).toContain("cluster-armed-escalated");
    expect(clusterArmedHtml).toContain("ARMED");
  });
});
