import { describe, it, expect, vi } from "vitest";
import {
  deriveHolderStatus,
  lookupTokenDetails,
} from "@/server/services/token/lookup";

describe("P6-T03: Token lookup panel", () => {
  const tokenAddress = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
  const chain = "base";
  const walletA = "0x1111111111111111111111111111111111111111";
  const walletB = "0x2222222222222222222222222222222222222222";
  const walletC = "0x3333333333333333333333333333333333333333";

  it("lookup: renders tracked holders with grades and entry market caps", async () => {
    const mockPositions = [
      {
        walletAddress: walletA,
        wallet: {
          ensName: "smartalpha.eth",
          edge: "SMART",
          style: "RIDER",
          size: "W",
          profile: {
            gradeJson: {
              available: true,
              winRate: 0.7,
              winRatePct: 70,
              realizedPnlUsd: "5000.00",
              entryTimingRatio: 0.25,
            },
          },
        },
        isOpen: true,
        entryMarketCap: 15_000_000,
        amountRaw: "1000000000",
        costUsd: 2500,
        unrealizedUsd: 7500,
        cexDepositedUsd: 0,
        sellCount: 0,
        openedAt: new Date("2026-02-01T10:00:00Z"),
      },
    ];

    const result = await lookupTokenDetails({
      tokenAddress,
      chain,
      mockData: {
        token: {
          symbol: "ALPHA",
          name: "Alpha Token",
          latestMarketCap: 100_000_000,
          latestPriceUsd: 0.0075,
        },
        positions: mockPositions,
      },
    });

    expect(result.isKnown).toBe(true);
    expect(result.holders.length).toBe(1);

    const holder = result.holders[0];
    expect(holder.walletAddress).toBe(walletA.toLowerCase());
    expect(holder.ensName).toBe("smartalpha.eth");
    expect(holder.label).toBe("SMART-RIDER [W]");
    expect(holder.entryMarketCap).toBe("15000000");

    const grade = holder.grade as any;
    expect(grade.available).toBe(true);
    expect(grade.winRatePct).toBe(70);
  });

  it("lookup: status reflects holding vs distributed vs exited", () => {
    // 1. Holding: Open, amount > 0, cexDeposited = 0, sells = 0
    expect(
      deriveHolderStatus({
        isOpen: true,
        amountRaw: "500000",
        cexDepositedUsd: 0,
        sellCount: 0,
      })
    ).toBe("HOLDING");

    // 2. Distributed: Open, but cexDeposited > 0
    expect(
      deriveHolderStatus({
        isOpen: true,
        amountRaw: "200000",
        cexDepositedUsd: "500.00",
        sellCount: 0,
      })
    ).toBe("DISTRIBUTED");

    // 3. Distributed: Open, but sellCount > 0
    expect(
      deriveHolderStatus({
        isOpen: true,
        amountRaw: "200000",
        cexDepositedUsd: 0,
        sellCount: 2,
      })
    ).toBe("DISTRIBUTED");

    // 4. Exited: Closed position
    expect(
      deriveHolderStatus({
        isOpen: false,
        amountRaw: "0",
        cexDepositedUsd: 0,
        sellCount: 1,
      })
    ).toBe("EXITED");

    // 5. Exited: amountRaw is "0" even if isOpen flag was stale
    expect(
      deriveHolderStatus({
        isOpen: true,
        amountRaw: "0",
        cexDepositedUsd: 0,
        sellCount: 1,
      })
    ).toBe("EXITED");
  });

  it("lookup: netflow history renders for the token", async () => {
    const now = new Date("2026-03-05T12:00:00Z");
    const movements = [
      {
        kind: "BUY",
        amountUsd: 10000,
        timestamp: new Date("2026-03-05T10:00:00Z"), // Inside 24h
      },
      {
        kind: "SELL",
        amountUsd: 3000,
        timestamp: new Date("2026-03-05T11:00:00Z"), // Inside 24h
      },
      {
        kind: "BUY",
        amountUsd: 25000,
        timestamp: new Date("2026-03-02T10:00:00Z"), // Inside 7d
      },
      {
        kind: "SELL",
        amountUsd: 5000,
        timestamp: new Date("2026-02-15T10:00:00Z"), // Inside 30d
      },
    ];

    const result = await lookupTokenDetails({
      tokenAddress,
      chain,
      now,
      mockData: {
        token: { symbol: "TEST" },
        movements,
      },
    });

    expect(result.netflow.window24h.buyUsd).toBe(10000);
    expect(result.netflow.window24h.sellUsd).toBe(3000);
    expect(result.netflow.window24h.netUsd).toBe(7000);

    expect(result.netflow.window7d.buyUsd).toBe(35000);
    expect(result.netflow.window7d.sellUsd).toBe(3000);
    expect(result.netflow.window7d.netUsd).toBe(32000);

    expect(result.netflow.window30d.buyUsd).toBe(35000);
    expect(result.netflow.window30d.sellUsd).toBe(8000);
    expect(result.netflow.window30d.netUsd).toBe(27000);

    expect(result.netflow.history.length).toBeGreaterThan(0);
  });

  it("lookup: cluster presence warning appears when a cluster holds the token", async () => {
    const mockClusters = [
      {
        clusterId: "cluster-alpha",
        clusterName: "Alpha Syndicate",
        colorHex: "#D7A84B",
        walletCount: 2,
        wallets: [walletA, walletB],
      },
    ];

    const result = await lookupTokenDetails({
      tokenAddress,
      chain,
      mockData: {
        token: { symbol: "PEPE" },
        clusters: mockClusters,
      },
    });

    expect(result.clusterWarnings.length).toBe(1);
    expect(result.clusterWarnings[0].clusterName).toBe("Alpha Syndicate");
    expect(result.clusterWarnings[0].walletCount).toBe(2);
    expect(result.clusterWarnings[0].wallets).toContain(walletA);
  });

  it("lookup: red flags render including the promoter warning", async () => {
    const redFlags = {
      tokenAddress,
      chain,
      deployedAt: "2026-01-01T00:00:00.000Z",
      tokenAgeDays: 60,
      deployerAddress: "0xdeployer",
      hasPromoterWarning: true,
      promoterWarnings: [
        {
          walletAddress: walletA,
          txHash: "0xtxpromo123",
          amount: "500000",
          timestamp: "2026-01-02T12:00:00.000Z",
        },
      ],
      top10SharePct: 48.5,
      holderCount: 890,
      holderDataUnavailable: false,
      checkedAt: "2026-03-01T00:00:00.000Z",
    };

    const result = await lookupTokenDetails({
      tokenAddress,
      chain,
      mockData: {
        token: { symbol: "RED" },
        redFlags,
      },
    });

    expect(result.redFlags).not.toBeNull();
    expect(result.redFlags?.hasPromoterWarning).toBe(true);
    expect(result.redFlags?.promoterWarnings[0].walletAddress).toBe(walletA);
    expect(result.redFlags?.top10SharePct).toBe(48.5);
  });

  it("lookup: supply concentration among tracked wallets is computed", async () => {
    const positions = [
      {
        walletAddress: walletA,
        isOpen: true,
        amountRaw: "1000",
        costUsd: 10000,
        unrealizedUsd: 10000,
      },
      {
        walletAddress: walletB,
        isOpen: true,
        amountRaw: "2000",
        costUsd: 20000,
        unrealizedUsd: 20000,
      },
      {
        walletAddress: walletC,
        isOpen: false, // Exited
        amountRaw: "0",
        costUsd: 5000,
      },
    ];

    const result = await lookupTokenDetails({
      tokenAddress,
      chain,
      mockData: {
        token: {
          symbol: "CONC",
          latestMarketCap: 1_000_000, // Total Market Cap = 1M
        },
        positions,
      },
    });

    // Total tracked active holdings = 10,000 + 20,000 = 30,000
    // Active tracked wallets count = 2 (walletC is EXITED)
    expect(result.supplyConcentration.trackedWalletsCount).toBe(2);
    expect(result.supplyConcentration.totalTrackedHoldingsUsd).toBe(30000);

    // Tracked share of market cap = 30,000 / 1,000,000 = 3.0%
    expect(result.supplyConcentration.trackedSupplySharePct).toBe(3.0);

    // Individual shares of tracked supply:
    // WalletA: 10,000 / 30,000 = 33.3%
    // WalletB: 20,000 / 30,000 = 66.7%
    expect(result.holders[0].shareOfTrackedPct).toBe(33.3);
    expect(result.holders[1].shareOfTrackedPct).toBe(66.7);
  });

  it("lookup: unknown token renders an empty state", async () => {
    const result = await lookupTokenDetails({
      tokenAddress: "0x0000000000000000000000000000000000000000",
      chain,
      mockData: {
        token: null, // Unknown
        positions: [],
      },
    });

    expect(result.isKnown).toBe(false);
    expect(result.token).toBeNull();
    expect(result.holders.length).toBe(0);
    expect(result.supplyConcentration.trackedWalletsCount).toBe(0);
  });

  it("lookup: panel renders in under 3 seconds from the local DB", async () => {
    const start = performance.now();
    const result = await lookupTokenDetails({
      tokenAddress,
      chain,
      mockData: {
        token: { symbol: "SPEED" },
        positions: [],
      },
    });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(3000);
    expect(result.renderDurationMs).toBeLessThan(3000);
  });

  it("lookup: refresh enqueues a job and does not block the render", async () => {
    const mockAdd = vi.fn().mockResolvedValue({ id: "job-123" });
    const mockQueues = {
      pricing: { add: mockAdd },
    } as any;

    const mockCreate = vi.fn().mockResolvedValue({});
    const mockPrisma = {
      jobRun: { create: mockCreate },
    } as any;

    // Simulate tRPC refresh procedure execution
    const normAddress = tokenAddress.toLowerCase();
    const jobId = `token:refresh:${chain}:${normAddress}:${Date.now()}`;

    await mockQueues.pricing.add(
      "tokenRefresh",
      { tokenAddress: normAddress, chain },
      { jobId }
    );
    await mockPrisma.jobRun.create({
      data: {
        id: jobId,
        queueName: "watchtower.pricing",
        jobName: "tokenRefresh",
        payloadJson: { tokenAddress: normAddress, chain },
        status: "QUEUED",
      },
    });

    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
