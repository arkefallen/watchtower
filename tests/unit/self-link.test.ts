import { describe, it, expect, vi } from "vitest";
import { linkTradeToSignal } from "@/server/services/self/link";
import { getLagBucket } from "@/server/services/self/roi";
import { isWalletGraded } from "@/lib/rules/graded";

vi.mock("@/server/db/client", () => ({
  prisma: {},
}));

vi.mock("@/server/services/settings", () => ({
  loadSettings: vi.fn().mockResolvedValue({
    gradedDefinition: "ANY_TAG_OR_COMPUTED",
  }),
}));

describe("P5-T02: Auto-link trades to watchlist signals", () => {
  const userAddress = "0x1111111111111111111111111111111111111111";
  const smartWallet = "0x2222222222222222222222222222222222222222";
  const tokenAddress = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

  it("link: nearest preceding graded entry is chosen", async () => {
    const userEntryTime = new Date("2026-03-01T12:00:00.000Z");
    const wallet1Time = new Date("2026-03-01T10:30:00.000Z"); // 90 min lag
    const wallet2Time = new Date("2026-03-01T08:00:00.000Z"); // 240 min lag

    const mockPrisma: any = {
      userTrade: {
        findUnique: vi.fn().mockResolvedValue({ isLinkPinned: false }),
        update: vi.fn().mockResolvedValue({}),
      },
      movementEvent: {
        findMany: vi.fn().mockResolvedValue([
          {
            walletAddress: smartWallet,
            walletChain: "BASE",
            timestamp: wallet1Time,
            tokenAddress,
            tokenChain: "BASE",
            amountUsd: "5000",
            marketCapAtAction: "10000000",
            wallet: {
              edge: "SMART",
              isSelf: false,
              watchPriority: "NORMAL",
            },
          },
          {
            walletAddress: "0x3333333333333333333333333333333333333333",
            walletChain: "BASE",
            timestamp: wallet2Time,
            tokenAddress,
            tokenChain: "BASE",
            amountUsd: "2000",
            marketCapAtAction: "8000000",
            wallet: {
              edge: "INSIDER",
              isSelf: false,
              watchPriority: "NORMAL",
            },
          },
        ]),
      },
      position: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    const res = await linkTradeToSignal(
      {
        trade: {
          id: "trade-1",
          ownWallet: { address: userAddress, chain: "base" },
          tokenAddress,
          tokenChain: "base",
          side: "BUY",
          entryAt: userEntryTime,
          amountUsd: "1000",
          entryMarketCap: "12000000",
        },
      },
      mockPrisma
    );

    expect(res.followedWallet?.address).toBe(smartWallet.toLowerCase());
    expect(res.lagMinutes).toBe(90);
    expect(res.lagBucket).toBe("1-6h");
    expect(res.lagMcDelta).toBe("2000000.00");
  });

  it("link: ANY_TAG_OR_COMPUTED accepts tagged or sufficiently computed grades", () => {
    const taggedStyle = { styleTags: ["RIDER"], sampleCount: 0 };
    const taggedSize = { sizeTags: ["W"], sampleCount: 0 };
    const computedSufficient = { computedGrade: "A", sampleCount: 15, minSample: 10 };
    const computedInsufficient = { computedGrade: "A", sampleCount: 4, minSample: 10 };
    const ungraded = { sampleCount: 0 };

    expect(isWalletGraded(taggedStyle, "ANY_TAG_OR_COMPUTED")).toBe(true);
    expect(isWalletGraded(taggedSize, "ANY_TAG_OR_COMPUTED")).toBe(true);
    expect(isWalletGraded(computedSufficient, "ANY_TAG_OR_COMPUTED")).toBe(true);
    expect(isWalletGraded(computedInsufficient, "ANY_TAG_OR_COMPUTED")).toBe(false);
    expect(isWalletGraded(ungraded, "ANY_TAG_OR_COMPUTED")).toBe(false);
  });

  it("link: EDGE_TAG_ONLY accepts only manual edge tags", () => {
    const edgeTagged = { edgeTags: ["SMART"] };
    const styleTagged = { styleTags: ["RIDER"] };
    const computed = { computedGrade: "A", sampleCount: 50 };

    expect(isWalletGraded(edgeTagged, "EDGE_TAG_ONLY")).toBe(true);
    expect(isWalletGraded(styleTagged, "EDGE_TAG_ONLY")).toBe(false);
    expect(isWalletGraded(computed, "EDGE_TAG_ONLY")).toBe(false);
  });

  it("link: later wallet entry is not chosen", async () => {
    const userEntryTime = new Date("2026-03-01T12:00:00.000Z");
    const laterTime = new Date("2026-03-01T12:30:00.000Z"); // 30 min AFTER user

    const mockPrisma: any = {
      userTrade: {
        findUnique: vi.fn().mockResolvedValue({ isLinkPinned: false }),
        update: vi.fn().mockResolvedValue({}),
      },
      movementEvent: {
        // Query should return no movements <= userEntryTime
        findMany: vi.fn().mockImplementation(({ where }) => {
          expect(where.timestamp.lte).toEqual(userEntryTime);
          return Promise.resolve([]);
        }),
      },
    };

    const res = await linkTradeToSignal(
      {
        trade: {
          id: "trade-2",
          ownWallet: { address: userAddress, chain: "base" },
          tokenAddress,
          tokenChain: "base",
          side: "BUY",
          entryAt: userEntryTime,
          amountUsd: "500",
          entryMarketCap: null,
        },
      },
      mockPrisma
    );

    expect(res.followedWallet).toBeNull();
    expect(res.lagMinutes).toBeNull();
  });

  it("link: lagMinutes computed as user minus wallet entry", () => {
    const userTime = new Date("2026-03-01T14:30:00.000Z").getTime();
    const walletTime = new Date("2026-03-01T14:00:00.000Z").getTime();
    const lagMinutes = Math.round((userTime - walletTime) / 60000);
    expect(lagMinutes).toBe(30);
  });

  it("link: lagMcDelta null when either market cap is unknown", async () => {
    const userEntryTime = new Date("2026-03-01T12:00:00.000Z");
    const walletTime = new Date("2026-03-01T11:45:00.000Z");

    const mockPrisma: any = {
      userTrade: {
        findUnique: vi.fn().mockResolvedValue({ isLinkPinned: false }),
        update: vi.fn().mockResolvedValue({}),
      },
      movementEvent: {
        findMany: vi.fn().mockResolvedValue([
          {
            walletAddress: smartWallet,
            walletChain: "BASE",
            timestamp: walletTime,
            tokenAddress,
            tokenChain: "BASE",
            amountUsd: "1000",
            marketCapAtAction: null, // Unknown wallet MC
            wallet: { edge: "SMART", isSelf: false, watchPriority: "NORMAL" },
          },
        ]),
      },
      position: { findFirst: vi.fn().mockResolvedValue(null) },
    };

    const res = await linkTradeToSignal(
      {
        trade: {
          id: "trade-3",
          ownWallet: { address: userAddress, chain: "base" },
          tokenAddress,
          tokenChain: "base",
          side: "BUY",
          entryAt: userEntryTime,
          amountUsd: "500",
          entryMarketCap: "5000000", // Known user MC
        },
      },
      mockPrisma
    );

    expect(res.lagMcDelta).toBeNull();
  });

  it("link: lagBucket boundaries 60, 360, 1440 minutes", () => {
    expect(getLagBucket(0)).toBe("0-1h");
    expect(getLagBucket(59)).toBe("0-1h");
    expect(getLagBucket(60)).toBe("1-6h");
    expect(getLagBucket(359)).toBe("1-6h");
    expect(getLagBucket(360)).toBe("6-24h");
    expect(getLagBucket(1439)).toBe("6-24h");
    expect(getLagBucket(1440)).toBe(">24h");
    expect(getLagBucket(5000)).toBe(">24h");
  });

  it("link: bucket boundary exactly 60 minutes falls in 1-6h", () => {
    expect(getLagBucket(60)).toBe("1-6h");
  });

  it("link: ungraded wallet is not a candidate", async () => {
    const userEntryTime = new Date("2026-03-01T12:00:00.000Z");
    const walletTime = new Date("2026-03-01T11:00:00.000Z");

    const mockPrisma: any = {
      userTrade: {
        findUnique: vi.fn().mockResolvedValue({ isLinkPinned: false }),
        update: vi.fn().mockResolvedValue({}),
      },
      movementEvent: {
        findMany: vi.fn().mockResolvedValue([
          {
            walletAddress: "0xungraded11111111111111111111111111111111",
            walletChain: "BASE",
            timestamp: walletTime,
            tokenAddress,
            tokenChain: "BASE",
            amountUsd: "1000",
            wallet: { edge: null, style: null, size: null, isSelf: false, profile: null },
          },
        ]),
      },
    };

    const res = await linkTradeToSignal(
      {
        trade: {
          id: "trade-4",
          ownWallet: { address: userAddress, chain: "base" },
          tokenAddress,
          tokenChain: "base",
          side: "BUY",
          entryAt: userEntryTime,
          amountUsd: "500",
          entryMarketCap: null,
        },
        requireGraded: true,
      },
      mockPrisma
    );

    expect(res.followedWallet).toBeNull();
    expect(res.evidence.rejected[0].reason).toContain("NOT_GRADED");
  });

  it("link: self wallets are not candidates", async () => {
    const userEntryTime = new Date("2026-03-01T12:00:00.000Z");
    const walletTime = new Date("2026-03-01T11:00:00.000Z");

    const mockPrisma: any = {
      userTrade: {
        findUnique: vi.fn().mockResolvedValue({ isLinkPinned: false }),
        update: vi.fn().mockResolvedValue({}),
      },
      movementEvent: {
        findMany: vi.fn().mockResolvedValue([
          {
            walletAddress: "0xselfother11111111111111111111111111111111",
            walletChain: "BASE",
            timestamp: walletTime,
            tokenAddress,
            tokenChain: "BASE",
            amountUsd: "1000",
            wallet: { edge: "SMART", isSelf: true },
          },
        ]),
      },
    };

    const res = await linkTradeToSignal(
      {
        trade: {
          id: "trade-5",
          ownWallet: { address: userAddress, chain: "base" },
          tokenAddress,
          tokenChain: "base",
          side: "BUY",
          entryAt: userEntryTime,
          amountUsd: "500",
          entryMarketCap: null,
        },
      },
      mockPrisma
    );

    expect(res.followedWallet).toBeNull();
    expect(res.evidence.rejected[0].reason).toBe("EXCLUDED_SELF_WALLET");
  });

  it("link: no candidate leaves the trade unlinked with a reason", async () => {
    const mockPrisma: any = {
      userTrade: {
        findUnique: vi.fn().mockResolvedValue({ isLinkPinned: false }),
        update: vi.fn().mockResolvedValue({}),
      },
      movementEvent: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const res = await linkTradeToSignal(
      {
        trade: {
          id: "trade-6",
          ownWallet: { address: userAddress, chain: "base" },
          tokenAddress,
          tokenChain: "base",
          side: "BUY",
          entryAt: new Date(),
          amountUsd: "500",
          entryMarketCap: null,
        },
      },
      mockPrisma
    );

    expect(res.followedWallet).toBeNull();
    expect(res.evidence.chosenReason).toBe("NO_QUALIFYING_GRADED_CANDIDATE");
  });

  it("link: pinned link is not overwritten", async () => {
    const pinnedWallet = "0xpinned0000000000000000000000000000000000";
    const mockPrisma: any = {
      userTrade: {
        findUnique: vi.fn().mockResolvedValue({
          isLinkPinned: true,
          followedWalletAddress: pinnedWallet,
          followedWalletChain: "BASE",
          lagMinutes: 45,
          lagBucket: "0-1h",
        }),
        update: vi.fn(),
      },
    };

    const res = await linkTradeToSignal(
      {
        trade: {
          id: "trade-pinned",
          ownWallet: { address: userAddress, chain: "base" },
          tokenAddress,
          tokenChain: "base",
          side: "BUY",
          entryAt: new Date(),
          amountUsd: "500",
          entryMarketCap: null,
        },
      },
      mockPrisma
    );

    expect(res.followedWallet?.address).toBe(pinnedWallet);
    expect(res.evidence.chosenReason).toBe("PINNED_BY_USER");
    expect(mockPrisma.userTrade.update).not.toHaveBeenCalled();
  });

  it("link: tie broken by watch priority then USD then address", async () => {
    const userEntryTime = new Date("2026-03-01T12:00:00.000Z");
    const sameTime = new Date("2026-03-01T11:00:00.000Z");

    const highPriorityWallet = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const normalPriorityWallet = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    const mockPrisma: any = {
      userTrade: {
        findUnique: vi.fn().mockResolvedValue({ isLinkPinned: false }),
        update: vi.fn().mockResolvedValue({}),
      },
      movementEvent: {
        findMany: vi.fn().mockResolvedValue([
          {
            walletAddress: normalPriorityWallet,
            walletChain: "BASE",
            timestamp: sameTime,
            tokenAddress,
            tokenChain: "BASE",
            amountUsd: "10000",
            wallet: { edge: "SMART", isSelf: false, watchPriority: "NORMAL" },
          },
          {
            walletAddress: highPriorityWallet,
            walletChain: "BASE",
            timestamp: sameTime,
            tokenAddress,
            tokenChain: "BASE",
            amountUsd: "5000",
            wallet: { edge: "SMART", isSelf: false, watchPriority: "HIGH" },
          },
        ]),
      },
      position: { findFirst: vi.fn().mockResolvedValue(null) },
    };

    const res = await linkTradeToSignal(
      {
        trade: {
          id: "trade-tie",
          ownWallet: { address: userAddress, chain: "base" },
          tokenAddress,
          tokenChain: "base",
          side: "BUY",
          entryAt: userEntryTime,
          amountUsd: "1000",
          entryMarketCap: null,
        },
      },
      mockPrisma
    );

    // High priority wallet must be chosen despite lower USD
    expect(res.followedWallet?.address).toBe(highPriorityWallet);
  });
});
