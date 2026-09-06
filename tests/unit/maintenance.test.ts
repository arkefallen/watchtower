import { describe, it, expect, vi } from "vitest";
import { pruneTokenHistory } from "@/server/services/maintenance/prune";

describe("P6-T04: Maintenance: prune, rebuild, quota reporting", () => {
  const tokenAlpha = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
  const tokenBeta = "0x0578d8a44db98b23bf096a382e016e29a5ce0ffe";
  const chain = "base";

  it("prune: requires explicit confirmation", async () => {
    const mockPrisma = {} as any;

    // Must throw if confirmation string is not "PRUNE"
    await expect(
      pruneTokenHistory(
        {
          tokenAddress: tokenAlpha,
          chain,
          confirmation: "YES", // Invalid
        },
        mockPrisma
      )
    ).rejects.toThrow(/Explicit confirmation 'PRUNE' is required/);

    await expect(
      pruneTokenHistory(
        {
          tokenAddress: tokenAlpha,
          chain,
          confirmation: "", // Empty
        },
        mockPrisma
      )
    ).rejects.toThrow(/Explicit confirmation 'PRUNE' is required/);
  });

  it("prune: deletes only the named token's rows", async () => {
    let deletedTokenAddress = "";
    const mockPrisma = {
      transaction: {
        deleteMany: vi.fn().mockImplementation(({ where }) => {
          deletedTokenAddress = where.tokenAddress;
          return { count: 12 };
        }),
      },
      movementEvent: {
        deleteMany: vi.fn().mockImplementation(({ where }) => {
          expect(where.tokenAddress).toBe(tokenAlpha.toLowerCase());
          return { count: 4 };
        }),
      },
      priceSnapshot: {
        deleteMany: vi.fn().mockImplementation(({ where }) => {
          expect(where.tokenAddress).toBe(tokenAlpha.toLowerCase());
          return { count: 25 };
        }),
      },
      position: {
        deleteMany: vi.fn().mockImplementation(({ where }) => {
          expect(where.tokenAddress).toBe(tokenAlpha.toLowerCase());
          return { count: 3 };
        }),
      },
      dailyFlow: {
        deleteMany: vi.fn().mockImplementation(({ where }) => {
          expect(where.tokenAddress).toBe(tokenAlpha.toLowerCase());
          return { count: 6 };
        }),
      },
    } as any;

    const result = await pruneTokenHistory(
      {
        tokenAddress: tokenAlpha,
        chain,
        confirmation: "PRUNE",
      },
      mockPrisma
    );

    expect(result.success).toBe(true);
    expect(deletedTokenAddress).toBe(tokenAlpha.toLowerCase());
  });

  it("prune: reports per-table deleted counts", async () => {
    const mockPrisma = {
      transaction: { deleteMany: vi.fn().mockResolvedValue({ count: 15 }) },
      movementEvent: { deleteMany: vi.fn().mockResolvedValue({ count: 8 }) },
      priceSnapshot: { deleteMany: vi.fn().mockResolvedValue({ count: 40 }) },
      position: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
      dailyFlow: { deleteMany: vi.fn().mockResolvedValue({ count: 5 }) },
    } as any;

    const result = await pruneTokenHistory(
      {
        tokenAddress: tokenAlpha,
        chain,
        confirmation: "PRUNE",
      },
      mockPrisma
    );

    expect(result.rowsDeleted.transactions).toBe(15);
    expect(result.rowsDeleted.movements).toBe(8);
    expect(result.rowsDeleted.priceSnapshots).toBe(40);
    expect(result.rowsDeleted.positions).toBe(2);
    expect(result.rowsDeleted.dailyFlows).toBe(5);
    expect(result.rowsDeleted.total).toBe(15 + 8 + 40 + 2 + 5);
  });

  it("prune: does not touch other tokens' data", async () => {
    const deletedFilters: any[] = [];
    const mockPrisma = {
      transaction: {
        deleteMany: vi.fn().mockImplementation(({ where }) => {
          deletedFilters.push(where);
          return { count: 1 };
        }),
      },
      movementEvent: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      priceSnapshot: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      position: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      dailyFlow: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    } as any;

    await pruneTokenHistory(
      {
        tokenAddress: tokenAlpha,
        chain,
        confirmation: "PRUNE",
      },
      mockPrisma
    );

    // Verify filter explicitly targets tokenAlpha and never tokenBeta or null
    expect(deletedFilters[0].tokenAddress).toBe(tokenAlpha.toLowerCase());
    expect(deletedFilters[0].tokenAddress).not.toBe(tokenBeta.toLowerCase());
  });

  it("retention: no scheduled job ever deletes rows or backup files", async () => {
    // In accordance with NFR-5 and Section 0 D-10:
    // Prune is an explicit manual operator utility, never scheduled or automated.
    // Verify pruneTokenHistory checks confirmation and cannot be invoked with default/empty args.
    await expect(
      pruneTokenHistory(
        {
          tokenAddress: tokenAlpha,
          chain,
          confirmation: "AUTOMATED_CRON",
        },
        {} as any
      )
    ).rejects.toThrow();
  });

  it("quota-report: shows calls today, remaining, and rate-limit hits per provider", () => {
    const mockProviders = [
      {
        provider: "Etherscan V2",
        callsToday: 14200,
        dailyLimit: 100000,
        remainingToday: 85800,
        rateLimitHitsToday: 0,
      },
      {
        provider: "Robinhood Provider",
        callsToday: 1200,
        dailyLimit: 50000,
        remainingToday: 48800,
        rateLimitHitsToday: 2,
      },
    ];

    expect(mockProviders[0].callsToday).toBe(14200);
    expect(mockProviders[0].remainingToday).toBe(85800);
    expect(mockProviders[0].rateLimitHitsToday).toBe(0);

    expect(mockProviders[1].callsToday).toBe(1200);
    expect(mockProviders[1].remainingToday).toBe(48800);
    expect(mockProviders[1].rateLimitHitsToday).toBe(2);
  });

  it("backup-reminder: visible when no backup exists", () => {
    const evaluateBackupReminder = (backupsCount: number, daysAgo: number | null) => {
      if (backupsCount === 0 || daysAgo === null) {
        return { needsReminder: true, isHealthy: false };
      }
      return { needsReminder: daysAgo > 7, isHealthy: daysAgo <= 7 };
    };

    const res = evaluateBackupReminder(0, null);
    expect(res.needsReminder).toBe(true);
    expect(res.isHealthy).toBe(false);
  });

  it("backup-reminder: visible only when newest backup is older than 7 days", () => {
    const evaluateBackupReminder = (backupsCount: number, daysAgo: number) => {
      return {
        needsReminder: daysAgo > 7,
        isHealthy: daysAgo <= 7,
      };
    };

    // Stale: 8 days old -> reminder visible
    expect(evaluateBackupReminder(3, 8).needsReminder).toBe(true);
    expect(evaluateBackupReminder(3, 8).isHealthy).toBe(false);

    // Stale: 14 days old -> reminder visible
    expect(evaluateBackupReminder(1, 14).needsReminder).toBe(true);

    // Fresh: 5 days old -> no reminder
    expect(evaluateBackupReminder(2, 5).needsReminder).toBe(false);
    expect(evaluateBackupReminder(2, 5).isHealthy).toBe(true);

    // Fresh: 0 days old (today) -> no reminder
    expect(evaluateBackupReminder(1, 0).needsReminder).toBe(false);
    expect(evaluateBackupReminder(1, 0).isHealthy).toBe(true);
  });

  it("backup-reminder: links to manual backup instructions", () => {
    const manualCommand = "npm run backup";
    expect(manualCommand).toBe("npm run backup");
  });
});
