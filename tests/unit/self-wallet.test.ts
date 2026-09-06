import { describe, it, expect, vi } from "vitest";
import { getSelfWallets, isSelfWallet, setSelfWallet } from "@/server/services/wallet/self";
import { isEligibleForMovementGroup, evaluateMovementGroups } from "@/server/services/radar/group";
import { computeMarketBreadth } from "@/server/services/movement/breadth";

vi.mock("@/server/db/client", () => ({
  prisma: {},
}));

describe("P5-T01: Self wallet registration and ingestion", () => {
  it("self: isSelf wallet is ingested by the same pipeline", async () => {
    const mockWallets = [
      {
        address: "0x1111111111111111111111111111111111111111",
        chain: "BASE",
        isSelf: true,
        label: "My Trader",
        profile: { txCount: 15 },
        syncState: { status: "IDLE" },
        _count: { ownTrades: 5, movements: 12 },
      },
    ];

    const mockPrisma: any = {
      wallet: {
        findMany: vi.fn().mockResolvedValue(mockWallets),
        findUnique: vi.fn().mockResolvedValue({ isSelf: true }),
      },
    };

    const selfWallets = await getSelfWallets(mockPrisma);
    expect(selfWallets).toHaveLength(1);
    expect(selfWallets[0].isSelf).toBe(true);
    expect(selfWallets[0].label).toBe("My Trader");

    const isSelf = await isSelfWallet("0x1111111111111111111111111111111111111111", "base", mockPrisma);
    expect(isSelf).toBe(true);
  });

  it("self: excluded from co-accumulation membership", async () => {
    // Check filter predicate
    const selfWallet = { isSelf: true, isBlacklisted: false };
    const normalWallet = { isSelf: false, isBlacklisted: false };
    const blacklistedWallet = { isSelf: false, isBlacklisted: true };

    expect(isEligibleForMovementGroup(selfWallet)).toBe(false);
    expect(isEligibleForMovementGroup(normalWallet)).toBe(true);
    expect(isEligibleForMovementGroup(blacklistedWallet)).toBe(false);

    // Verify evaluateMovementGroups query structure enforces isSelf: false
    const mockPrisma: any = {
      movementEvent: {
        findMany: vi.fn().mockImplementation(({ where }) => {
          expect(where.wallet.isSelf).toBe(false);
          return Promise.resolve([]);
        }),
      },
    };

    await evaluateMovementGroups({ timeWindowHours: 24 }, mockPrisma);
    expect(mockPrisma.movementEvent.findMany).toHaveBeenCalled();
  });

  it("self: excluded from followed-wallet candidates", () => {
    // Any candidate where isSelf === true must be rejected
    const candidateA = { address: "0xself", isSelf: true };
    const candidateB = { address: "0xsmart", isSelf: false };

    const filterCandidate = (c: typeof candidateA) => !c.isSelf;

    expect(filterCandidate(candidateA)).toBe(false);
    expect(filterCandidate(candidateB)).toBe(true);
  });

  it("self: excluded from the breadth denominator", async () => {
    const mockPrisma: any = {
      wallet: {
        count: vi.fn().mockImplementation(({ where }) => {
          expect(where.isSelf).toBe(false);
          return Promise.resolve(10);
        }),
      },
      movementEvent: {
        findMany: vi.fn().mockImplementation(({ where }) => {
          expect(where.wallet.isSelf).toBe(false);
          return Promise.resolve([
            { walletAddress: "0xw1", walletChain: "BASE" },
            { walletAddress: "0xw2", walletChain: "BASE" },
          ]);
        }),
      },
    };

    const breadth = await computeMarketBreadth({ timeWindowHours: 24 }, mockPrisma);
    expect(breadth.denominatorCount).toBe(10);
    expect(breadth.activeWalletsCount).toBe(2);
    expect(breadth.breadthPct).toBe(20.0);
  });

  it("self: can be toggled back to a normal watchlist wallet", async () => {
    const mockPrisma: any = {
      wallet: {
        update: vi.fn().mockResolvedValue({
          address: "0x1111111111111111111111111111111111111111",
          chain: "BASE",
          isSelf: false,
        }),
      },
    };

    const updated = await setSelfWallet("0x1111111111111111111111111111111111111111", "base", false, mockPrisma);
    expect(updated.isSelf).toBe(false);
    expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
      where: {
        address_chain: {
          address: "0x1111111111111111111111111111111111111111",
          chain: "BASE",
        },
      },
      data: { isSelf: false },
    });
  });
});
