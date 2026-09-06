import { describe, expect, it, vi, beforeEach } from "vitest";
import { settingsRouter } from "@/server/trpc/routers/settings";
import { createContext } from "@/server/trpc/context";
import { DEFAULT_SETTINGS } from "@/lib/settings-schema";

let mockCurrentSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

vi.mock("@/server/services/settings", () => ({
  loadSettings: vi.fn().mockImplementation(async () => mockCurrentSettings),
  updateSettings: vi.fn().mockImplementation(async (patch: any) => {
    mockCurrentSettings = {
      ...mockCurrentSettings,
      ...patch,
      alertThresholds: {
        ...mockCurrentSettings.alertThresholds,
        ...(patch.alertThresholds ?? {}),
      },
    };
    return mockCurrentSettings;
  }),
}));

function mockContext(overrides: { queues?: any; prisma?: any } = {}) {
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
    queues: overrides.queues,
    prisma: overrides.prisma,
  });
}

describe("settings tRPC router", () => {
  beforeEach(() => {
    mockCurrentSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  });

  it("get: returns current settings snapshot with documented defaults", async () => {
    const caller = settingsRouter.createCaller(mockContext());
    const snapshot = await caller.get();

    expect(snapshot.alertThresholds.a1MinStableInflowUsd).toBe(1000);
    expect(snapshot.alertThresholds.a2MinNativeInflowUsd).toBe(100);
    expect(snapshot.alertThresholds.a2MedianMultiple).toBe(3);
    expect(snapshot.alertThresholds.c3SelfOnly).toBe(false);
    expect(snapshot.gradedDefinition).toBe("ANY_TAG_OR_COMPUTED");
    expect(snapshot.radarCadenceMinutes).toBe(5);
    expect(snapshot.quota.reservedForInteractivePct).toBe(10);
    expect(snapshot.stableTokens.base).toHaveLength(1);
    expect(snapshot.stableTokens.base[0]?.symbol).toBe("USDC");
  });

  it("update: accepts partial threshold changes", async () => {
    const caller = settingsRouter.createCaller(mockContext());
    const updated = await caller.update({
      alertThresholds: {
        a1MinStableInflowUsd: 2000,
        c3SelfOnly: true,
      },
    });

    expect(updated.alertThresholds.a1MinStableInflowUsd).toBe(2000);
    expect(updated.alertThresholds.c3SelfOnly).toBe(true);

    // Restore to default
    await caller.update({
      alertThresholds: {
        a1MinStableInflowUsd: 1000,
        c3SelfOnly: false,
      },
    });
  });

  it("update: re-registers radar repeatable job when radarCadenceMinutes changes", async () => {
    const removedJobs: string[] = [];
    const addedJobs: Array<{ name: string; options: any }> = [];

    const mockRadarQueue = {
      getRepeatableJobs: vi.fn().mockResolvedValue([
        { key: "radar.evaluate.oldKey", name: "radar.evaluate" },
      ]),
      removeRepeatableByKey: vi.fn().mockImplementation(async (key: string) => {
        removedJobs.push(key);
      }),
      add: vi.fn().mockImplementation(async (name: string, data: any, options: any) => {
        addedJobs.push({ name, options });
        return { id: "job-123" };
      }),
    };

    const ctx = mockContext({ queues: { radar: mockRadarQueue } });
    const caller = settingsRouter.createCaller(ctx);

    await caller.update({ radarCadenceMinutes: 10 });

    expect(mockRadarQueue.getRepeatableJobs).toHaveBeenCalled();
    expect(removedJobs).toContain("radar.evaluate.oldKey");
    expect(addedJobs).toHaveLength(1);
    expect(addedJobs[0]?.name).toBe("radar.evaluate");
    expect(addedJobs[0]?.options.repeat.every).toBe(10 * 60 * 1000);

    // Reset back
    await caller.update({ radarCadenceMinutes: 5 });
  });

  it("testTelegram: delivers message successfully when Telegram API returns ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 42 } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const caller = settingsRouter.createCaller(mockContext());
    const result = await caller.testTelegram({
      botToken: "123456:TEST_TOKEN",
      chatId: "-100987654321",
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain("delivered successfully");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/bot123456%3ATEST_TOKEN/sendMessage",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          chat_id: "-100987654321",
          text: "Watchtower Alert Test",
        }),
      })
    );
  });

  it("testTelegram: captures and reports Telegram API errors cleanly", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ ok: false, description: "chat not found" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const caller = settingsRouter.createCaller(mockContext());
    const result = await caller.testTelegram({
      botToken: "INVALID_TOKEN",
      chatId: "999999999",
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe("chat not found");
  });

  it("backupStatus: reads metadata from backups directory and checks staleness", async () => {
    const caller = settingsRouter.createCaller(mockContext());
    const status = await caller.backupStatus();

    expect(status.totalBackups).toBeGreaterThan(0);
    expect(status.lastBackupAt).toBeTruthy();
    expect(typeof status.daysAgo).toBe("number");
    expect(typeof status.isHealthy).toBe("boolean");
  });

  it("pruneTokenHistory: requires explicit PRUNE confirmation", async () => {
    const caller = settingsRouter.createCaller(mockContext());

    await expect(caller.pruneTokenHistory({
      chain: "base",
      tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      confirmation: "NOPE" as any,
    })).rejects.toThrow();
  });

  it("pruneTokenHistory: executes prune and returns deleted record counts", async () => {
    const mockPrisma = {
      transaction: {
        deleteMany: vi.fn().mockResolvedValue({ count: 5 }),
      },
      position: {
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    };

    const ctx = mockContext({ prisma: mockPrisma as any });
    const caller = settingsRouter.createCaller(ctx);

    const result = await caller.pruneTokenHistory({
      chain: "base",
      tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      confirmation: "PRUNE",
    });

    expect(result.success).toBe(true);
    expect(result.rowsDeleted.transactions).toBe(5);
    expect(result.rowsDeleted.positions).toBe(2);
    expect(result.message).toContain("Pruned 7 record(s)");
  });
});
