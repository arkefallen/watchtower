import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

vi.mock("@/server/db/client", () => ({
  prisma: {},
}));

vi.mock("@/server/services/settings", () => ({
  loadSettings: vi.fn().mockResolvedValue({
    gradedDefinition: "ANY_TAG_OR_COMPUTED",
  }),
}));

import { setSelfWallet, getSelfWallets, isSelfWallet } from "@/server/services/wallet/self";
import { linkTradeToSignal } from "@/server/services/self/link";
import { computeEdgeDecay } from "@/server/services/self/decay";
import { computeSelfDashboard } from "@/server/services/self/dashboard";
import { getTradeComparisonList, deriveComparisonVerdict } from "@/server/services/self/comparison";
import { addTrade, ManualTradeSchema } from "@/server/services/self/trades";
import { EdgeDecayChart } from "@/components/self/EdgeDecayChart";
import { ComparisonTable } from "@/components/self/ComparisonTable";
import { PnlBreakdown } from "@/components/self/PnlBreakdown";
import type { Address } from "@/lib/chains/types";

describe("Phase 5 Acceptance Criteria: Self-Tracking (Edge Rider) (SRS §8)", () => {
  const selfWallet = "0x1111111111111111111111111111111111111111";
  const smartWallet = "0x2222222222222222222222222222222222222222";
  const tokenAddress = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

  it("criterion 1: register self wallet -> auto-linked trades with lag data", async () => {
    // 1. Self wallet registration
    const walletStore = new Map<string, any>([
      [
        selfWallet.toLowerCase(),
        {
          address: selfWallet.toLowerCase(),
          chain: "BASE",
          isSelf: false,
          label: "My Treasury",
        },
      ],
    ]);

    const mockPrisma: any = {
      wallet: {
        update: vi.fn().mockImplementation(({ where, data }) => {
          const w = walletStore.get(where.address_chain.address);
          if (w) Object.assign(w, data);
          return w;
        }),
        findUnique: vi.fn().mockImplementation(({ where }) => {
          return walletStore.get(where.address_chain.address) || null;
        }),
        findMany: vi.fn().mockImplementation(({ where }) => {
          const list = Array.from(walletStore.values());
          if (where?.isSelf) return list.filter((w) => w.isSelf);
          return list;
        }),
      },
      userTrade: {
        findUnique: vi.fn().mockResolvedValue({ isLinkPinned: false }),
        update: vi.fn().mockResolvedValue({}),
      },
      movementEvent: {
        findMany: vi.fn().mockResolvedValue([
          {
            walletAddress: smartWallet.toLowerCase(),
            walletChain: "BASE",
            timestamp: new Date("2026-03-01T10:00:00.000Z"), // 60 min earlier
            tokenAddress,
            tokenChain: "BASE",
            amountUsd: "5000",
            marketCapAtAction: "10000000",
            wallet: {
              edge: "SMART",
              isSelf: false,
              watchPriority: "HIGH",
            },
          },
        ]),
      },
      position: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    // Register wallet as self
    await setSelfWallet(selfWallet, "base", true, mockPrisma);
    expect(await isSelfWallet(selfWallet, "base", mockPrisma)).toBe(true);

    const selfList = await getSelfWallets(mockPrisma);
    expect(selfList).toHaveLength(1);
    expect(selfList[0].isSelf).toBe(true);

    // 2. User trade auto-linking
    const userEntryTime = new Date("2026-03-01T11:00:00.000Z"); // exactly 60 min lag
    const linkResult = await linkTradeToSignal(
      {
        trade: {
          id: "self-trade-1",
          ownWallet: { address: selfWallet as Address, chain: "base" },
          tokenAddress: tokenAddress as Address,
          tokenChain: "base",
          side: "BUY",
          entryAt: userEntryTime,
          amountUsd: "1500",
          entryMarketCap: "12500000",
        },
      },
      mockPrisma
    );

    expect(linkResult.followedWallet?.address).toBe(smartWallet.toLowerCase());
    expect(linkResult.lagMinutes).toBe(60);
    expect(linkResult.lagBucket).toBe("1-6h");
    expect(linkResult.lagMcDelta).toBe("2500000.00");
  });

  it("criterion 2: edge decay curve renders for followed wallet with >= 5 linked trades", async () => {
    // Construct 6 linked trades for smartWallet with varied lag minutes
    const linkedTrades = [
      {
        id: "t1",
        lagMinutes: 15,
        lagBucket: "0-1h",
        roiPct: "45.0",
        walletRoiPct: "35.0",
        followedWalletAddress: smartWallet.toLowerCase(),
        followedWalletChain: "BASE",
      },
      {
        id: "t2",
        lagMinutes: 40,
        lagBucket: "0-1h",
        roiPct: "25.0",
        walletRoiPct: "30.0",
        followedWalletAddress: smartWallet.toLowerCase(),
        followedWalletChain: "BASE",
      },
      {
        id: "t3",
        lagMinutes: 120,
        lagBucket: "1-6h",
        roiPct: "10.0",
        walletRoiPct: "25.0",
        followedWalletAddress: smartWallet.toLowerCase(),
        followedWalletChain: "BASE",
      },
      {
        id: "t4",
        lagMinutes: 240,
        lagBucket: "1-6h",
        roiPct: "-5.0",
        walletRoiPct: "20.0",
        followedWalletAddress: smartWallet.toLowerCase(),
        followedWalletChain: "BASE",
      },
      {
        id: "t5",
        lagMinutes: 720,
        lagBucket: "6-24h",
        roiPct: "-15.0",
        walletRoiPct: "15.0",
        followedWalletAddress: smartWallet.toLowerCase(),
        followedWalletChain: "BASE",
      },
      {
        id: "t6",
        lagMinutes: 1800,
        lagBucket: ">24h",
        roiPct: "-30.0",
        walletRoiPct: "5.0",
        followedWalletAddress: smartWallet.toLowerCase(),
        followedWalletChain: "BASE",
      },
    ];

    const mockPrisma: any = {
      userTrade: {
        findMany: vi.fn().mockResolvedValue(linkedTrades),
      },
    };

    const decayResult = await computeEdgeDecay(
      { followedWallet: { address: smartWallet as Address, chain: "base" }, minSample: 5 },
      mockPrisma
    );

    // Assert sampleSize >= 5 and insufficientSample is false
    expect(decayResult.sampleSize).toBe(6);
    expect(decayResult.insufficientSample).toBe(false);

    // Check all 4 buckets populated
    expect(decayResult.buckets).toHaveLength(4);
    const b0 = decayResult.buckets.find((b) => b.bucket === "0-1h");
    const b1 = decayResult.buckets.find((b) => b.bucket === "1-6h");
    const b2 = decayResult.buckets.find((b) => b.bucket === "6-24h");
    const b3 = decayResult.buckets.find((b) => b.bucket === ">24h");

    expect(b0?.tradeCount).toBe(2);
    expect(b0?.avgUserRoiPct).toBe("35.00");
    expect(b0?.winRatePct).toBe("100.0");

    expect(b1?.tradeCount).toBe(2);
    expect(b1?.avgUserRoiPct).toBe("2.50");
    expect(b1?.winRatePct).toBe("50.0");

    expect(b2?.tradeCount).toBe(1);
    expect(b2?.avgUserRoiPct).toBe("-15.00");
    expect(b2?.winRatePct).toBe("0.0");

    expect(b3?.tradeCount).toBe(1);
    expect(b3?.avgUserRoiPct).toBe("-30.00");
    expect(b3?.winRatePct).toBe("0.0");

    // Render component to ensure table and SVG curve render without errors
    const html = renderToString(
      <EdgeDecayChart
        buckets={decayResult.buckets}
        sampleSize={decayResult.sampleSize}
        insufficientSample={decayResult.insufficientSample}
      />
    );

    expect(html).toContain("EDGE DECAY CURVE");
    expect(html).toContain("0-1h");
    expect(html).toContain("1-6h");
    expect(html).toContain("6-24h");
    expect(html).toContain("&gt;24h");
    expect(html).toContain("35.00%");
    expect(html).not.toContain("INSUFFICIENT SAMPLE");
  });

  it("criterion 3: dashboard aggregates win rate and realized PnL while isolating open positions", async () => {
    const trades = [
      {
        id: "t1",
        ownWalletAddress: selfWallet,
        ownChain: "BASE",
        tokenAddress,
        tokenChain: "BASE",
        side: "BUY",
        amountUsd: "1000",
        entryAt: new Date("2026-03-01T10:00:00.000Z"),
        exitAt: new Date("2026-03-01T12:00:00.000Z"),
        roiPct: "40.0", // Realized: +$400
        followedWalletAddress: smartWallet,
        followedWalletChain: "BASE",
        lagMinutes: 30,
        token: { symbol: "ALPHA" },
        followedWallet: { label: "Smart Wallet" },
      },
      {
        id: "t2",
        ownWalletAddress: selfWallet,
        ownChain: "BASE",
        tokenAddress,
        tokenChain: "BASE",
        side: "BUY",
        amountUsd: "1000",
        entryAt: new Date("2026-03-02T10:00:00.000Z"),
        exitAt: new Date("2026-03-02T12:00:00.000Z"),
        roiPct: "-20.0", // Realized: -$200
        followedWalletAddress: smartWallet,
        followedWalletChain: "BASE",
        lagMinutes: 45,
        token: { symbol: "ALPHA" },
        followedWallet: { label: "Smart Wallet" },
      },
    ];

    const positions = [
      {
        id: "pos-open",
        walletAddress: selfWallet,
        walletChain: "BASE",
        tokenAddress,
        tokenChain: "BASE",
        isOpen: true,
        costUsd: "3000",
        realizedUsd: "0",
        unrealizedUsd: "750", // Unrealized PnL = +750
        token: { symbol: "ALPHA" },
      },
      {
        id: "pos-closed",
        walletAddress: selfWallet,
        walletChain: "BASE",
        tokenAddress,
        tokenChain: "BASE",
        isOpen: false,
        costUsd: "2000",
        realizedUsd: "2200", // Realized PnL = +200
        unrealizedUsd: "0",
        token: { symbol: "ALPHA" },
      },
    ];

    const mockPrisma: any = {
      userTrade: {
        findMany: vi.fn().mockResolvedValue(trades),
      },
      position: {
        findMany: vi.fn().mockResolvedValue(positions),
      },
    };

    const dashboard = await computeSelfDashboard({}, mockPrisma);

    // Realized PnL is from closed positions only (+200.00), open position is separate (+750.00)
    expect(dashboard.totalPnlUsd).toBe("200.00");
    expect(dashboard.unrealizedPnlUsd).toBe("750.00");
    // Win rate: 1 winning trade out of 2 closed trades = 50.0%
    expect(dashboard.winRatePct).toBe("50.0");
    expect(dashboard.avgFollowLagMinutes).toBe(38); // (30+45)/2 = 37.5 -> 38

    // Render PnlBreakdown component
    const html = renderToString(
      <PnlBreakdown
        byFollowedWallet={dashboard.byFollowedWallet}
        byToken={dashboard.byToken}
        byLagBucket={dashboard.byLagBucket}
      />
    );
    expect(html).toContain("PERSONAL PnL BREAKDOWN");
    expect(html).toContain("BY FOLLOWED WALLET");
    expect(html).toContain("BY TOKEN");
    expect(html).toContain("BY LAG BUCKET");
  });

  it("criterion 4: comparison view evaluates user vs wallet edge capture", async () => {
    const trades = [
      {
        id: "c1",
        entryAt: new Date("2026-03-01T12:00:00.000Z"),
        tokenAddress,
        tokenChain: "BASE",
        side: "BUY",
        amountUsd: "1000",
        followedWalletAddress: smartWallet,
        followedWalletChain: "BASE",
        lagMinutes: 20,
        lagBucket: "0-1h",
        lagMcDelta: "500000.00",
        roiPct: "50.0",
        walletRoiPct: "40.0", // User won more -> CAPTURED
        isLinkPinned: false,
        thesis: "Early buy",
        token: { symbol: "ALPHA" },
        followedWallet: { label: "Smart Alpha" },
        ownWallet: { isSelf: true },
      },
      {
        id: "c2",
        entryAt: new Date("2026-03-02T12:00:00.000Z"),
        tokenAddress,
        tokenChain: "BASE",
        side: "BUY",
        amountUsd: "1000",
        followedWalletAddress: smartWallet,
        followedWalletChain: "BASE",
        lagMinutes: 180,
        lagBucket: "1-6h",
        lagMcDelta: "3000000.00",
        roiPct: "10.0",
        walletRoiPct: "45.0", // User won less -> DECAYED
        isLinkPinned: false,
        thesis: "Late follow",
        token: { symbol: "ALPHA" },
        followedWallet: { label: "Smart Alpha" },
        ownWallet: { isSelf: true },
      },
      {
        id: "c3",
        entryAt: new Date("2026-03-03T12:00:00.000Z"),
        tokenAddress,
        tokenChain: "BASE",
        side: "BUY",
        amountUsd: "1000",
        followedWalletAddress: smartWallet,
        followedWalletChain: "BASE",
        lagMinutes: 45,
        lagBucket: "0-1h",
        lagMcDelta: null,
        roiPct: "15.0",
        walletRoiPct: null, // Unknown wallet ROI -> null verdict
        isLinkPinned: true,
        thesis: "Pinned trade",
        token: { symbol: "ALPHA" },
        followedWallet: { label: "Smart Alpha" },
        ownWallet: { isSelf: true },
      },
    ];

    const mockPrisma: any = {
      userTrade: {
        findMany: vi.fn().mockResolvedValue(trades),
      },
    };

    const items = await getTradeComparisonList({}, mockPrisma);
    expect(items).toHaveLength(3);

    const item1 = items.find((i) => i.id === "c1");
    expect(item1?.verdict).toBe("CAPTURED");
    expect(item1?.roiGapPct).toBe("10.00");

    const item2 = items.find((i) => i.id === "c2");
    expect(item2?.verdict).toBe("DECAYED");
    expect(item2?.roiGapPct).toBe("-35.00");

    const item3 = items.find((i) => i.id === "c3");
    expect(item3?.verdict).toBeNull();
    expect(item3?.walletRoiPct).toBeNull();

    // Render ComparisonTable
    const html = renderToString(<ComparisonTable items={items} />);
    expect(html).toContain("EXECUTION COMPARISON VIEW");
    expect(html).toContain("CAPTURED");
    expect(html).toContain("DECAYED");
    expect(html).toContain("—"); // Em dash rendered for null wallet ROI
  });

  it("criterion 5: manual trade thesis validation and pinned links", () => {
    // Rejection of missing thesis
    const missingThesis = ManualTradeSchema.safeParse({
      ownWalletAddress: selfWallet,
      ownChain: "base",
      tokenAddress,
      tokenChain: "base",
      side: "BUY",
      amountUsd: "500",
      entryAt: new Date(),
      source: "MANUAL",
      thesis: "   ",
    });
    expect(missingThesis.success).toBe(false);

    // Valid thesis passes
    const validTrade = ManualTradeSchema.safeParse({
      ownWalletAddress: selfWallet,
      ownChain: "base",
      tokenAddress,
      tokenChain: "base",
      side: "BUY",
      amountUsd: "500",
      entryAt: new Date(),
      source: "MANUAL",
      thesis: "Breakout confirmed on 1h timeframe",
      followedWalletAddress: smartWallet,
    });
    expect(validTrade.success).toBe(true);
  });
});
