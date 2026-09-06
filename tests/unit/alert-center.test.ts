import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getAlertList,
  acknowledgeAlert,
  markAllAlertsRead,
  getUnreadAlertCount,
  getAlertKpis,
} from "@/server/services/alert/list";
import { alertRouter } from "@/server/trpc/routers/alert";
import { createContext } from "@/server/trpc/context";
import {
  validateEvidence,
  getTxExplorerUrl,
  ALERT_RULES_METADATA,
} from "@/lib/rules/evidence";
import { DEFAULT_SETTINGS } from "@/lib/settings-schema";

// In-memory mock alert database
interface MockAlertRecord {
  id: string;
  walletAddress: string;
  walletChain: "BASE" | "BSC" | "ROBINHOOD";
  type: string;
  state: "ARMED" | "TRIGGERED" | "EXIT_RISK";
  tokenAddress: string | null;
  tokenChain: "BASE" | "BSC" | "ROBINHOOD" | null;
  tokenSymbol: string | null;
  amountUsd: any | null;
  clusterId: string | null;
  payloadJson: any;
  evidenceJson: any;
  dedupeKey: string;
  occurredAt: Date;
  createdAt: Date;
  readAt: Date | null;
  deliveredAt: Date | null;
  deliveryError: string | null;
  wallet?: any;
}

let mockAlertDb: MockAlertRecord[] = [];

vi.mock("@/server/db/client", () => {
  return {
    prisma: {
      alertEvent: {
        findMany: vi.fn().mockImplementation((args: any = {}) => {
          let list = [...mockAlertDb];
          const where = args.where || {};

          if (where.state) {
            list = list.filter((a) => a.state === where.state);
          }
          if (where.type?.in) {
            list = list.filter((a) => where.type.in.includes(a.type));
          } else if (where.type) {
            list = list.filter((a) => a.type === where.type);
          }
          if (where.walletAddress) {
            list = list.filter((a) => a.walletAddress.toLowerCase() === where.walletAddress.toLowerCase());
          }
          if (where.walletChain) {
            list = list.filter((a) => a.walletChain === where.walletChain);
          }
          if (where.tokenAddress) {
            list = list.filter((a) => a.tokenAddress?.toLowerCase() === where.tokenAddress.toLowerCase());
          }
          if (where.readAt === null) {
            list = list.filter((a) => a.readAt === null);
          }
          if (where.OR && Array.isArray(where.OR)) {
            list = list.filter((a) => {
              return where.OR.some((cond: any) => {
                if (cond.walletAddress?.contains) {
                  return a.walletAddress.toLowerCase().includes(cond.walletAddress.contains.toLowerCase());
                }
                if (cond.tokenSymbol?.contains) {
                  return a.tokenSymbol?.toLowerCase().includes(cond.tokenSymbol.contains.toLowerCase());
                }
                if (cond.tokenAddress?.contains) {
                  return a.tokenAddress?.toLowerCase().includes(cond.tokenAddress.contains.toLowerCase());
                }
                return false;
              });
            });
          }

          // Sort createdAt desc
          list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

          // Cursor pagination
          if (args.cursor?.id) {
            const idx = list.findIndex((a) => a.id === args.cursor.id);
            if (idx !== -1) {
              list = list.slice(idx + (args.skip ? 1 : 0));
            }
          }

          const limit = args.take ?? 50;
          return Promise.resolve(list.slice(0, limit));
        }),

        count: vi.fn().mockImplementation((args: any = {}) => {
          let list = [...mockAlertDb];
          const where = args.where || {};

          if (where.state) {
            list = list.filter((a) => a.state === where.state);
          }
          if (where.type?.in) {
            list = list.filter((a) => where.type.in.includes(a.type));
          } else if (where.type) {
            list = list.filter((a) => a.type === where.type);
          }
          if (where.walletAddress) {
            list = list.filter((a) => a.walletAddress.toLowerCase() === where.walletAddress.toLowerCase());
          }
          if (where.readAt === null) {
            list = list.filter((a) => a.readAt === null);
          }
          return Promise.resolve(list.length);
        }),

        update: vi.fn().mockImplementation(({ where, data }: any) => {
          const item = mockAlertDb.find((a) => a.id === where.id);
          if (item) {
            Object.assign(item, data);
            return Promise.resolve(item);
          }
          throw new Error("Alert not found");
        }),

        updateMany: vi.fn().mockImplementation(({ where, data }: any) => {
          let count = 0;
          for (const item of mockAlertDb) {
            if (where.readAt === null && item.readAt !== null) continue;
            Object.assign(item, data);
            count++;
          }
          return Promise.resolve({ count });
        }),
      },

      $transaction: vi.fn().mockImplementation((promises: Promise<any>[]) => {
        return Promise.all(promises);
      }),
    },
  };
});

function mockContext() {
  return createContext({
    health: {
      db: { query: async () => undefined },
      redis: { ping: async () => "PONG" },
      queues: {},
      settings: { loadSettings: async () => DEFAULT_SETTINGS },
      quotas: async () => [],
      migration: "0001_phase0_initial",
    },
    clock: { now: () => new Date("2026-09-06T00:00:00Z") },
  });
}

function createSampleAlert(overrides: Partial<MockAlertRecord> = {}): MockAlertRecord {
  const id = overrides.id || `alert-${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    walletAddress: "0x1111111111111111111111111111111111111111",
    walletChain: "BASE",
    type: "A1",
    state: "ARMED",
    tokenAddress: null,
    tokenChain: null,
    tokenSymbol: null,
    amountUsd: 1500,
    clusterId: null,
    payloadJson: {},
    evidenceJson: {
      ruleId: "A1",
      ruleText: "Wallet receives stablecoin inflow >= max($1,000 floor, 3.0x median)",
      thresholds: { floorUsd: 1000, medianMultiple: 3 },
      bindingArm: "Floor $1,000",
      observed: { inflowUsd: 1500 },
      txLinks: [
        {
          hash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
          chain: "base",
        },
      ],
    },
    dedupeKey: `A1:0x1111:base:2026-09-06`,
    occurredAt: new Date("2026-09-06T00:00:00Z"),
    createdAt: new Date("2026-09-06T00:00:00Z"),
    readAt: null,
    deliveredAt: null,
    deliveryError: null,
    wallet: {
      address: "0x1111111111111111111111111111111111111111",
      chain: "BASE",
      ensName: "whale.eth",
      label: "Alpha Fund",
      edge: "SMART",
      style: "SWING",
      size: "W",
      isSelf: false,
    },
    ...overrides,
  };
}

describe("Alert Center Service & Router (Phase 4 Tasks P4-T08 & P4-T09)", () => {
  beforeEach(() => {
    mockAlertDb = [
      createSampleAlert({
        id: "alert-1",
        type: "A1",
        state: "ARMED",
        readAt: null,
        createdAt: new Date("2026-09-06T01:00:00Z"),
      }),
      createSampleAlert({
        id: "alert-2",
        type: "T1",
        state: "TRIGGERED",
        tokenSymbol: "PEPE",
        tokenAddress: "0x2222222222222222222222222222222222222222",
        readAt: null,
        createdAt: new Date("2026-09-06T02:00:00Z"),
      }),
      createSampleAlert({
        id: "alert-3",
        type: "C1",
        state: "EXIT_RISK",
        readAt: new Date("2026-09-06T02:30:00Z"),
        createdAt: new Date("2026-09-06T03:00:00Z"),
      }),
      createSampleAlert({
        id: "alert-4",
        type: "A5",
        state: "ARMED",
        clusterId: "cluster-alpha",
        readAt: null,
        createdAt: new Date("2026-09-06T04:00:00Z"),
        evidenceJson: {
          ruleId: "A5",
          ruleText: ">= 2 cluster members armed within 48 hours",
          clusterContext: {
            clusterId: "cluster-alpha",
            clusterName: "Alpha Group",
            memberCount: 3,
            sharedFunder: "0x9999999999999999999999999999999999999999",
          },
          txLinks: ["0xaaaabbbbccccddddeeeeffff0000111122223333444455556666777788889999"],
        },
      }),
    ];
  });

  // ─── P4-T08: Alert List, Filters & Pagination ──────────────────────────────

  it("alert-center: filters by type, state, token, wallet", async () => {
    // Filter by state
    const armedResult = await getAlertList({ state: "ARMED" });
    expect(armedResult.items.every((a) => a.state === "ARMED")).toBe(true);
    expect(armedResult.items.length).toBe(2);

    // Filter by type
    const t1Result = await getAlertList({ type: "T1" as any });
    expect(t1Result.items).toHaveLength(1);
    expect(t1Result.items[0]?.type).toBe("T1");

    // Filter by category types array
    const triggerResult = await getAlertList({ types: ["T1", "T2", "T3", "T4", "T5"] as any });
    expect(triggerResult.items).toHaveLength(1);
    expect(triggerResult.items[0]?.id).toBe("alert-2");

    // Filter by wallet address
    const walletResult = await getAlertList({
      walletAddress: "0x1111111111111111111111111111111111111111",
    });
    expect(walletResult.items.length).toBe(4);

    // Filter by token address
    const tokenResult = await getAlertList({
      tokenAddress: "0x2222222222222222222222222222222222222222",
    });
    expect(tokenResult.items).toHaveLength(1);
    expect(tokenResult.items[0]?.tokenSymbol).toBe("PEPE");

    // Filter by search string
    const searchResult = await getAlertList({ search: "PEPE" });
    expect(searchResult.items).toHaveLength(1);
    expect(searchResult.items[0]?.id).toBe("alert-2");

    // Filter by unreadOnly
    const unreadResult = await getAlertList({ unreadOnly: true });
    expect(unreadResult.items.every((a) => a.readAt === null)).toBe(true);
    expect(unreadResult.items.length).toBe(3);
  });

  it("alert-center: unread badge counts unread alerts", async () => {
    const unreadCount = await getUnreadAlertCount();
    expect(unreadCount).toBe(3); // alert-1, alert-2, alert-4
  });

  it("alert-center: marking one read decrements the badge", async () => {
    const initialCount = await getUnreadAlertCount();
    expect(initialCount).toBe(3);

    await acknowledgeAlert("alert-1");

    const updatedCount = await getUnreadAlertCount();
    expect(updatedCount).toBe(2);

    const alert = mockAlertDb.find((a) => a.id === "alert-1");
    expect(alert?.readAt).toBeInstanceOf(Date);
  });

  it("alert-center: mark all read zeroes the badge", async () => {
    const initialCount = await getUnreadAlertCount();
    expect(initialCount).toBe(3);

    await markAllAlertsRead();

    const afterCount = await getUnreadAlertCount();
    expect(afterCount).toBe(0);
    expect(mockAlertDb.every((a) => a.readAt !== null)).toBe(true);
  });

  it("alert-center: pagination is stable and non-overlapping", async () => {
    const page1 = await getAlertList({ limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).toBe(page1.items[1]?.id);

    const page2 = await getAlertList({ limit: 2, cursor: page1.nextCursor });
    expect(page2.items).toHaveLength(2);

    // Assert disjoint sets
    const page1Ids = new Set(page1.items.map((i) => i.id));
    const page2Ids = new Set(page2.items.map((i) => i.id));
    for (const id of page2Ids) {
      expect(page1Ids.has(id)).toBe(false);
    }
  });

  it("alert-center: getAlertKpis computes all 5 KPI metrics accurately", async () => {
    const kpis = await getAlertKpis();

    expect(kpis.totalActive).toBe(4);
    expect(kpis.armedCount).toBe(2); // alert-1, alert-4
    expect(kpis.triggeredCount).toBe(1); // alert-2
    expect(kpis.exitRiskCount).toBe(1); // alert-3
    expect(kpis.unreadCount).toBe(3);
  });

  // ─── tRPC Router Procedures ────────────────────────────────────────────────

  it("alert-router: exposes list, kpis, acknowledge, markAllRead, unreadCount", async () => {
    const caller = alertRouter.createCaller(mockContext());

    const listRes = await caller.list({ limit: 10 });
    expect(listRes.items.length).toBeGreaterThan(0);
    expect(listRes.totalCount).toBe(4);

    const kpisRes = await caller.kpis();
    expect(kpisRes.totalActive).toBe(4);

    const countRes = await caller.unreadCount();
    expect(countRes.count).toBe(3);

    const ackRes = await caller.acknowledge({ id: "alert-2" });
    expect(ackRes.readAt).toBeInstanceOf(Date);

    const afterAckCount = await caller.unreadCount();
    expect(afterAckCount.count).toBe(2);

    await caller.markAllRead();
    const finalCount = await caller.unreadCount();
    expect(finalCount.count).toBe(0);
  });

  // ─── P4-T09: Evidence Validation & Tooltip ──────────────────────────────────

  it("evidence-tooltip: renders rule id and text", () => {
    const validEvidence = {
      ruleId: "A1",
      ruleText: "Wallet receives single-day stablecoin inflow >= max($1,000 floor, 3.0x median)",
      thresholds: { floor: 1000, medianMultiple: 3 },
      txLinks: ["0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"],
    };

    const res = validateEvidence(validEvidence);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.ruleId).toBe("A1");
      expect(res.data.ruleText).toContain("stablecoin inflow");
    }
  });

  it("evidence-tooltip: lists thresholds with configured values", () => {
    const validEvidence = {
      ruleId: "A2",
      ruleText: "Native token gas arming",
      thresholds: { floorUsd: 100, medianMultiple: 3.0 },
      bindingArm: "Floor $100",
      txLinks: ["0xaaaabbbbccccddddeeeeffff0000111122223333444455556666777788889999"],
    };

    const res = validateEvidence(validEvidence);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.thresholds).toEqual({ floorUsd: 100, medianMultiple: 3.0 });
      expect(res.data.bindingArm).toBe("Floor $100");
    }
  });

  it("evidence-tooltip: lists observed numbers", () => {
    const validEvidence = {
      ruleId: "T1",
      ruleText: "Armed wallet enters a memecoin position",
      observed: { positionUsd: 1250, tokenAgeDays: 2.5 },
      txLinks: ["0x1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff"],
    };

    const res = validateEvidence(validEvidence);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.observed?.positionUsd).toBe(1250);
      expect(res.data.observed?.tokenAgeDays).toBe(2.5);
    }
  });

  it("evidence-tooltip: renders tx links that open the explorer", () => {
    const hash = "0x9876543210abcdef9876543210abcdef9876543210abcdef9876543210abcdef";
    const baseExplorer = getTxExplorerUrl(hash, "base");
    expect(baseExplorer).toBe(`https://basescan.org/tx/${hash}`);

    const bscExplorer = getTxExplorerUrl(hash, "bsc");
    expect(bscExplorer).toBe(`https://bscscan.com/tx/${hash}`);

    const robinhoodExplorer = getTxExplorerUrl(hash, "robinhood");
    expect(robinhoodExplorer).toBe(`https://robinscan.io/tx/${hash}`);

    // If url is already full, preserves it
    const fullUrl = "https://custom-explorer.com/tx/0x123";
    expect(getTxExplorerUrl(fullUrl)).toBe(fullUrl);
  });

  it("evidence-tooltip: renders cluster context for A5 and T5", () => {
    const clusterEvidence = {
      ruleId: "A5",
      ruleText: ">= 2 cluster members armed within 48 hours",
      clusterContext: {
        clusterId: "cluster-99",
        clusterName: "Beta Syndicate",
        memberCount: 4,
        sharedFunder: "0x1234000000000000000000000000000000005678",
      },
      txLinks: ["0x1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff"],
    };

    const res = validateEvidence(clusterEvidence);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.clusterContext?.clusterName).toBe("Beta Syndicate");
      expect(res.data.clusterContext?.memberCount).toBe(4);
      expect(res.data.clusterContext?.sharedFunder).toContain("0x1234");
    }
  });

  it("evidence-tooltip: malformed evidence renders an explicit error state", () => {
    // Missing ruleText
    const noRuleText = {
      ruleId: "A1",
      txLinks: ["0x123"],
    };
    const res1 = validateEvidence(noRuleText);
    expect(res1.success).toBe(false);
    if (!res1.success) {
      expect(res1.error).toBe("missing ruleText / txLinks");
    }

    // Missing txLinks
    const noTxLinks = {
      ruleId: "A1",
      ruleText: "Rule text present",
    };
    const res2 = validateEvidence(noTxLinks);
    expect(res2.success).toBe(false);
    if (!res2.success) {
      expect(res2.error).toBe("missing ruleText / txLinks");
    }

    // Non-object or null
    expect(validateEvidence(null).success).toBe(false);
    expect(validateEvidence("string").success).toBe(false);
    expect(validateEvidence([]).success).toBe(false);
  });

  it("evidence-tooltip: all 15 rule types render non-empty content", () => {
    const ruleIds = [
      "A1", "A2", "A3", "A4", "A5", "A6",
      "T1", "T2", "T3", "T4", "T5",
      "C1", "C2", "C3", "C4",
    ];

    for (const id of ruleIds) {
      const meta = ALERT_RULES_METADATA[id];
      expect(meta).toBeDefined();
      expect(meta.id).toBe(id);
      expect(meta.name.length).toBeGreaterThan(0);
      expect(meta.shortDescription.length).toBeGreaterThan(0);
      expect(meta.fullRuleText.length).toBeGreaterThan(0);

      // Verify validation passes for standard synthetic evidence per rule
      const testEvidence = {
        ruleId: id,
        ruleText: meta.fullRuleText,
        txLinks: ["0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"],
      };

      const result = validateEvidence(testEvidence);
      expect(result.success).toBe(true);
    }
  });
});
