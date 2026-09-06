import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma, type PrismaClient, type AlertEvent, type MovementEvent, type WalletState, type WalletAlertState, type AlertType } from "@/generated/prisma/client";
import type { RuleFinding, MovementEventRow } from "@/lib/rules/types";
import { applyStateTransition, evaluateDeArm } from "@/server/services/alert/state-machine";
import { persistAlerts } from "@/server/services/alert/persist";
import { evaluateAlerts } from "@/server/services/alert/evaluate";
import { DEFAULT_SETTINGS } from "@/lib/settings-schema";
import { ALERT_RULES } from "@/lib/rules/registry";

vi.mock("@/server/db/client", () => ({
  prisma: {},
}));

vi.mock("@/server/services/settings", async () => {
  const { DEFAULT_SETTINGS } = await import("@/lib/settings-schema");
  return {
    loadSettings: vi.fn().mockResolvedValue(DEFAULT_SETTINGS),
  };
});

function createMockFinding(overrides: Partial<RuleFinding> = {}): RuleFinding {
  const type = overrides.type ?? "A1";
  const state = overrides.state ?? "ARMED";
  const dedupeKey = overrides.dedupeKey ?? `${type}:0x1111111111111111111111111111111111111111:base:-:100`;

  return {
    type,
    state,
    occurredAt: overrides.occurredAt ?? new Date("2026-09-06T00:00:00Z"),
    token: overrides.token ?? null,
    amountUsd: overrides.amountUsd ?? "1500.00",
    clusterId: overrides.clusterId ?? null,
    payload: overrides.payload ?? {
      walletAddress: "0x1111111111111111111111111111111111111111",
      chain: "base",
    },
    evidence: overrides.evidence ?? {
      ruleId: type,
      ruleText: `Test rule ${type}`,
      thresholds: { min: 1000 },
      observed: { value: 1500 },
      txLinks: [
        {
          hash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
          url: "https://basescan.org/tx/0xabcdef",
          label: "Tx 0xabcdef",
        },
      ],
    },
    dedupeKey,
  };
}

describe("Alert State Machine (applyStateTransition)", () => {
  it("evaluator: de-arm takes precedence over ARMED in the same batch", () => {
    const armedFinding = createMockFinding({ type: "A1", state: "ARMED" });
    const result = applyStateTransition("ARMED", [armedFinding], { satisfied: true });

    expect(result.nextState).toBe("IDLE");
    expect(result.next).toBe("IDLE");
    expect(result.reason).toBe("DEARM");
    expect(result.transitionOccurred).toBe(true);
  });

  it("evaluator: de-arm takes precedence over TRIGGERED in the same batch", () => {
    const triggeredFinding = createMockFinding({ type: "T1", state: "TRIGGERED" });
    const armedFinding = createMockFinding({ type: "A1", state: "ARMED" });
    const result = applyStateTransition("TRIGGERED", [armedFinding, triggeredFinding], {
      satisfied: true,
    });

    expect(result.nextState).toBe("IDLE");
    expect(result.transitionOccurred).toBe(true);
  });

  it("evaluator: TRIGGERED takes precedence over ARMED", () => {
    const armedFinding = createMockFinding({ type: "A1", state: "ARMED" });
    const triggeredFinding = createMockFinding({ type: "T1", state: "TRIGGERED" });
    const result = applyStateTransition("IDLE", [armedFinding, triggeredFinding], {
      satisfied: false,
    });

    expect(result.nextState).toBe("TRIGGERED");
    expect(result.stateReason).toBe("T1");
    expect(result.transitionOccurred).toBe(true);
  });

  it("evaluator: ARMED transitions wallet from IDLE", () => {
    const armedFinding = createMockFinding({ type: "A1", state: "ARMED" });
    const result = applyStateTransition("IDLE", [armedFinding], { satisfied: false });

    expect(result.nextState).toBe("ARMED");
    expect(result.stateReason).toBe("A1");
    expect(result.transitionOccurred).toBe(true);
  });

  it("evaluator: exit-risk findings never change state", () => {
    const exitRiskFinding = createMockFinding({ type: "C1", state: "EXIT_RISK" });

    // IDLE stays IDLE
    const idleResult = applyStateTransition("IDLE", [exitRiskFinding], { satisfied: false });
    expect(idleResult.nextState).toBe("IDLE");
    expect(idleResult.transitionOccurred).toBe(false);

    // ARMED stays ARMED
    const armedResult = applyStateTransition("ARMED", [exitRiskFinding], { satisfied: false });
    expect(armedResult.nextState).toBe("ARMED");
    expect(armedResult.transitionOccurred).toBe(false);

    // TRIGGERED stays TRIGGERED
    const trigResult = applyStateTransition("TRIGGERED", [exitRiskFinding], { satisfied: false });
    expect(trigResult.nextState).toBe("TRIGGERED");
    expect(trigResult.transitionOccurred).toBe(false);
  });

  it("evaluator: unchanged state reports transitionOccurred = false", () => {
    const armedFinding = createMockFinding({ type: "A1", state: "ARMED" });
    const result = applyStateTransition("ARMED", [armedFinding], { satisfied: false });

    expect(result.nextState).toBe("ARMED");
    expect(result.transitionOccurred).toBe(false);
  });
});

describe("Alert Persistence and Deduplication (persistAlerts)", () => {
  let mockAlertsDb: AlertEvent[];
  let mockPrisma: PrismaClient;

  beforeEach(() => {
    mockAlertsDb = [];
    mockPrisma = {
      alertEvent: {
        findMany: vi.fn().mockImplementation((args: { where?: { dedupeKey?: { in?: string[] } } }) => {
          let rows = [...mockAlertsDb];
          if (args?.where?.dedupeKey?.in) {
            const inKeys = new Set(args.where.dedupeKey.in);
            rows = rows.filter((r) => inKeys.has(r.dedupeKey));
          }
          return Promise.resolve(rows);
        }),
        createMany: vi.fn().mockImplementation((args: { data: Array<Partial<AlertEvent>> }) => {
          for (const item of args.data) {
            mockAlertsDb.push({
              id: `alert-${Math.random().toString(36).slice(2, 9)}`,
              walletAddress: item.walletAddress ?? "",
              walletChain: item.walletChain ?? "BASE",
              type: item.type ?? "A1",
              state: item.state ?? "ARMED",
              tokenAddress: item.tokenAddress ?? null,
              tokenChain: item.tokenChain ?? null,
              tokenSymbol: item.tokenSymbol ?? null,
              amountUsd: item.amountUsd ?? null,
              clusterId: item.clusterId ?? null,
              payloadJson: item.payloadJson ?? {},
              evidenceJson: item.evidenceJson ?? {},
              dedupeKey: item.dedupeKey ?? "",
              occurredAt: item.occurredAt ?? new Date(),
              createdAt: new Date(),
              readAt: null,
              deliveredAt: null,
              deliveryError: null,
            } as unknown as AlertEvent);
          }
          return Promise.resolve({ count: args.data.length });
        }),
        create: vi.fn().mockImplementation((args: { data: Partial<AlertEvent> }) => {
          const alert = {
            id: `alert-${Math.random().toString(36).slice(2, 9)}`,
            ...args.data,
            createdAt: new Date(),
            readAt: null,
            deliveredAt: null,
            deliveryError: null,
          } as unknown as AlertEvent;
          mockAlertsDb.push(alert);
          return Promise.resolve(alert);
        }),
      },
    } as unknown as PrismaClient;
  });

  it("evaluator: duplicate findings are suppressed by dedupeKey", async () => {
    const finding1 = createMockFinding({
      dedupeKey: "A1:0x1111111111111111111111111111111111111111:base:-:100",
    });
    const finding2 = createMockFinding({
      dedupeKey: "A1:0x1111111111111111111111111111111111111111:base:-:100", // Same key
    });
    const finding3 = createMockFinding({
      dedupeKey: "A2:0x1111111111111111111111111111111111111111:base:-:100", // Different key
    });

    // In-batch duplicate: 3 findings, 2 distinct keys
    const result1 = await persistAlerts([finding1, finding2, finding3], mockPrisma);
    expect(result1.alertsCreated).toBe(2);
    expect(result1.alertsSuppressed).toBe(1);

    // Second run with same findings: all suppressed by database dedupeKey
    const result2 = await persistAlerts([finding1, finding3], mockPrisma);
    expect(result2.alertsCreated).toBe(0);
    expect(result2.alertsSuppressed).toBe(2);
  });

  it("evaluator: rejects invalid evidence lacking ruleText or txLinks", async () => {
    const invalidFinding = createMockFinding({
      evidence: {
        ruleId: "A1",
        ruleText: "", // Empty ruleText
        thresholds: {},
        observed: {},
        txLinks: [],
      },
    });

    await expect(persistAlerts([invalidFinding], mockPrisma)).rejects.toThrow(
      /Invalid evidence/
    );
  });
});

describe("Alert Evaluator (evaluateAlerts)", () => {
  let mockMovementDb: MovementEvent[];
  let mockStateDb: Map<string, WalletState>;
  let mockAlertsDb: AlertEvent[];
  let mockPrisma: PrismaClient;

  const testAddress = "0x1111111111111111111111111111111111111111";

  beforeEach(() => {
    mockMovementDb = [];
    mockStateDb = new Map();
    mockAlertsDb = [];

    mockPrisma = {
      movementEvent: {
        findMany: vi.fn().mockImplementation((args: { where?: { alertEvaluatedAt?: null | object; timestamp?: { gte?: Date; lte?: Date } } }) => {
          let rows = [...mockMovementDb];
          if (args?.where?.alertEvaluatedAt === null) {
            rows = rows.filter((r) => r.alertEvaluatedAt === null);
          }
          if (args?.where?.timestamp?.gte) {
            rows = rows.filter((r) => r.timestamp >= args.where!.timestamp!.gte!);
          }
          if (args?.where?.timestamp?.lte) {
            rows = rows.filter((r) => r.timestamp <= args.where!.timestamp!.lte!);
          }
          return Promise.resolve(rows);
        }),
        findFirst: vi.fn().mockImplementation(() => {
          const sorted = [...mockMovementDb].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
          return Promise.resolve(sorted[0] ?? null);
        }),
        updateMany: vi.fn().mockImplementation((args: { where?: { id?: { in?: bigint[] } }; data: { alertEvaluatedAt: Date } }) => {
          let count = 0;
          const inIds = args.where?.id?.in ? new Set(args.where.id.in) : null;
          for (const m of mockMovementDb) {
            if (!inIds || inIds.has(m.id)) {
              m.alertEvaluatedAt = args.data.alertEvaluatedAt;
              count++;
            }
          }
          return Promise.resolve({ count });
        }),
      },
      wallet: {
        findUnique: vi.fn().mockResolvedValue({
          address: testAddress,
          chain: "BASE",
          watchPriority: "NORMAL",
          isSelf: false,
          edge: null,
          style: null,
          size: null,
          profile: null,
        }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      walletState: {
        findUnique: vi.fn().mockImplementation((args: { where: { walletAddress_walletChain: { walletAddress: string } } }) => {
          const state = mockStateDb.get(args.where.walletAddress_walletChain.walletAddress.toLowerCase()) ?? null;
          return Promise.resolve(state);
        }),
        upsert: vi.fn().mockImplementation((args: { where: { walletAddress_walletChain: { walletAddress: string } }; create: Partial<WalletState>; update: Partial<WalletState> }) => {
          const key = args.where.walletAddress_walletChain.walletAddress.toLowerCase();
          const existing = mockStateDb.get(key);
          const nextState: WalletState = {
            walletAddress: key,
            walletChain: "BASE",
            state: (args.update.state ?? args.create.state ?? "IDLE") as WalletAlertState,
            stateReason: (args.update.stateReason ?? args.create.stateReason ?? null) as AlertType | null,
            armedAt: args.update.armedAt !== undefined ? args.update.armedAt : (existing?.armedAt ?? null),
            triggeredAt: args.update.triggeredAt !== undefined ? args.update.triggeredAt : (existing?.triggeredAt ?? null),
            stablePeakUsd: null,
            stablePeakAt: null,
            baselineStableUsd: null,
            baselineNativeUsd: null,
            deArmStreakDays: 0,
            lastEvaluatedAt: new Date(),
            updatedAt: new Date(),
          };
          mockStateDb.set(key, nextState);
          return Promise.resolve(nextState);
        }),
      },
      dailyFlow: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      position: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      clusterMember: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      walletRelation: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      fundingEdge: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      alertEvent: {
        findMany: vi.fn().mockImplementation((args: { where?: { dedupeKey?: { in?: string[] } } }) => {
          let rows = [...mockAlertsDb];
          if (args?.where?.dedupeKey?.in) {
            const inKeys = new Set(args.where.dedupeKey.in);
            rows = rows.filter((r) => inKeys.has(r.dedupeKey));
          }
          return Promise.resolve(rows);
        }),
        createMany: vi.fn().mockImplementation((args: { data: Array<Partial<AlertEvent>> }) => {
          for (const item of args.data) {
            mockAlertsDb.push({
              id: `alert-${Math.random().toString(36).slice(2, 9)}`,
              walletAddress: item.walletAddress ?? "",
              walletChain: item.walletChain ?? "BASE",
              type: item.type ?? "A1",
              state: item.state ?? "ARMED",
              tokenAddress: item.tokenAddress ?? null,
              tokenChain: item.tokenChain ?? null,
              tokenSymbol: item.tokenSymbol ?? null,
              amountUsd: item.amountUsd ?? null,
              clusterId: item.clusterId ?? null,
              payloadJson: item.payloadJson ?? {},
              evidenceJson: item.evidenceJson ?? {},
              dedupeKey: item.dedupeKey ?? "",
              occurredAt: item.occurredAt ?? new Date(),
              createdAt: new Date(),
              readAt: null,
              deliveredAt: null,
              deliveryError: null,
            } as unknown as AlertEvent);
          }
          return Promise.resolve({ count: args.data.length });
        }),
      },
    } as unknown as PrismaClient;
  });

  it("evaluator: incremental mode processes only unevaluated events", async () => {
    // Add one unevaluated stablecoin inflow event ($1,500)
    mockMovementDb.push({
      id: 1n,
      walletAddress: testAddress,
      walletChain: "BASE",
      kind: "STABLE_PARK",
      timestamp: new Date("2026-09-06T00:00:00Z"),
      tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      tokenChain: "BASE",
      tokenSymbol: "USDC",
      amountRaw: "1500000000",
      amountUsd: new Prisma.Decimal("1500.00"),
      txHash: "0xhash1",
      alertEvaluatedAt: null, // Unevaluated
    } as unknown as MovementEvent);

    const result = await evaluateAlerts({
      mode: "INCREMENTAL",
      prisma: mockPrisma,
      now: new Date("2026-09-06T01:00:00Z"),
    });

    expect(result.mode).toBe("INCREMENTAL");
    expect(result.walletsEvaluated).toBe(1);
    expect(result.alertsCreated).toBe(1);
    expect(mockMovementDb[0].alertEvaluatedAt).not.toBeNull();

    // Verify wallet state transitioned from IDLE to ARMED
    const updatedState = mockStateDb.get(testAddress.toLowerCase());
    expect(updatedState?.state).toBe("ARMED");

    // Second run with no new unevaluated events
    const secondResult = await evaluateAlerts({
      mode: "INCREMENTAL",
      prisma: mockPrisma,
      now: new Date("2026-09-06T02:00:00Z"),
    });

    expect(secondResult.walletsEvaluated).toBe(0);
    expect(secondResult.alertsCreated).toBe(0);
  });

  it("evaluator: backfill replays daily slices in order and is idempotent", async () => {
    // Add historical events across two separate days
    const day1 = new Date("2026-09-01T12:00:00Z");
    const day2 = new Date("2026-09-02T12:00:00Z");

    mockMovementDb.push(
      {
        id: 10n,
        walletAddress: testAddress,
        walletChain: "BASE",
        kind: "STABLE_PARK",
        timestamp: day1,
        tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        tokenChain: "BASE",
        tokenSymbol: "USDC",
        amountRaw: "1500000000",
        amountUsd: new Prisma.Decimal("1500.00"),
        txHash: "0xhashDay1",
        alertEvaluatedAt: null,
      } as unknown as MovementEvent,
      {
        id: 11n,
        walletAddress: testAddress,
        walletChain: "BASE",
        kind: "BUY",
        timestamp: day2,
        tokenAddress: "0x2222222222222222222222222222222222222222",
        tokenChain: "BASE",
        tokenSymbol: "MEME",
        amountRaw: "500000000",
        amountUsd: new Prisma.Decimal("600.00"),
        tokenAgeSeconds: 86400n, // 1 day old (< 7 days)
        txHash: "0xhashDay2",
        alertEvaluatedAt: null,
      } as unknown as MovementEvent
    );

    // Initial backfill run
    const backfill1 = await evaluateAlerts({
      mode: "BACKFILL",
      scope: { address: testAddress, chain: "base" },
      from: new Date("2026-09-01T00:00:00Z"),
      to: new Date("2026-09-03T00:00:00Z"),
      prisma: mockPrisma,
    });

    expect(backfill1.mode).toBe("BACKFILL");
    expect(backfill1.walletsEvaluated).toBe(1);
    expect(backfill1.alertsCreated).toBeGreaterThanOrEqual(1);

    // Verify final state matches replay: Day 1 armed (A1) -> Day 2 triggered (T1)
    const finalState = mockStateDb.get(testAddress.toLowerCase());
    expect(finalState?.state).toBe("TRIGGERED");

    // Idempotent second backfill run: creates zero new alerts and reports all suppressed
    const backfill2 = await evaluateAlerts({
      mode: "BACKFILL",
      scope: { address: testAddress, chain: "base" },
      from: new Date("2026-09-01T00:00:00Z"),
      to: new Date("2026-09-03T00:00:00Z"),
      prisma: mockPrisma,
    });

    expect(backfill2.alertsCreated).toBe(0);
    expect(backfill2.alertsSuppressed).toBeGreaterThanOrEqual(backfill1.alertsCreated);
  });
});
