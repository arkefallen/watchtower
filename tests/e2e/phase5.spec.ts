import { expect, test, type Page } from "@playwright/test";
import superjson from "superjson";

test.use({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000" });

const selfWalletAddress = "0x1111111111111111111111111111111111111111";
const followedWalletAddress = "0x2222222222222222222222222222222222222222";
const tokenAddress = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

const mockSelfWallet = {
  address: selfWalletAddress,
  chain: "base",
  label: "Primary Trading Desk",
  ensName: "self-trader.eth",
  isSelf: true,
  syncState: {
    status: "SYNCED",
    lastSyncedAt: new Date("2026-03-01T12:00:00.000Z"),
  },
  _count: {
    ownTrades: 6,
    movements: 12,
  },
};

const mockDecayBuckets = [
  {
    bucket: "0-1h",
    tradeCount: 2,
    avgUserRoiPct: "35.00",
    avgWalletRoiPct: "30.00",
    winRatePct: "100.0",
  },
  {
    bucket: "1-6h",
    tradeCount: 2,
    avgUserRoiPct: "5.00",
    avgWalletRoiPct: "25.00",
    winRatePct: "50.0",
  },
  {
    bucket: "6-24h",
    tradeCount: 1,
    avgUserRoiPct: "-12.50",
    avgWalletRoiPct: "20.00",
    winRatePct: "0.0",
  },
  {
    bucket: ">24h",
    tradeCount: 1,
    avgUserRoiPct: "-28.00",
    avgWalletRoiPct: "10.00",
    winRatePct: "0.0",
  },
];

const mockDashboard = {
  winRatePct: "66.7",
  totalPnlUsd: "200.00",
  unrealizedPnlUsd: "750.00",
  avgFollowLagMinutes: 38,
  totalTradesCount: 6,
  linkedTradesCount: 6,
  byFollowedWallet: [
    {
      address: followedWalletAddress,
      chain: "base",
      label: "Alpha Whale",
      tradeCount: 6,
      pnlUsd: "200.00",
      avgLagMinutes: 38,
    },
  ],
  byToken: [
    {
      tokenAddress,
      chain: "base",
      symbol: "ALPHA",
      tradeCount: 6,
      pnlUsd: "200.00",
    },
  ],
  byLagBucket: mockDecayBuckets,
};

const mockComparisonItems = [
  {
    id: "trade-c1",
    timestamp: new Date("2026-03-01T12:00:00.000Z"),
    tokenAddress,
    tokenChain: "base",
    tokenSymbol: "ALPHA",
    side: "BUY",
    amountUsd: "1000.00",
    followedWalletAddress,
    followedWalletChain: "base",
    followedWalletLabel: "Alpha Whale",
    lagMinutes: 20,
    lagBucket: "0-1h",
    lagMcDelta: "500000.00",
    userRoiPct: "50.0",
    walletRoiPct: "40.0",
    roiGapPct: "10.00",
    verdict: "CAPTURED",
    isLinkPinned: false,
    thesis: "Early breakout signal",
  },
  {
    id: "trade-c2",
    timestamp: new Date("2026-03-02T12:00:00.000Z"),
    tokenAddress,
    tokenChain: "base",
    tokenSymbol: "ALPHA",
    side: "BUY",
    amountUsd: "1000.00",
    followedWalletAddress,
    followedWalletChain: "base",
    followedWalletLabel: "Alpha Whale",
    lagMinutes: 180,
    lagBucket: "1-6h",
    lagMcDelta: "3000000.00",
    userRoiPct: "10.0",
    walletRoiPct: "45.0",
    roiGapPct: "-35.00",
    verdict: "DECAYED",
    isLinkPinned: false,
    thesis: "Chased 3 hours late",
  },
  {
    id: "trade-c3",
    timestamp: new Date("2026-03-03T12:00:00.000Z"),
    tokenAddress,
    tokenChain: "base",
    tokenSymbol: "ALPHA",
    side: "BUY",
    amountUsd: "1000.00",
    followedWalletAddress,
    followedWalletChain: "base",
    followedWalletLabel: "Alpha Whale",
    lagMinutes: 45,
    lagBucket: "0-1h",
    lagMcDelta: null,
    userRoiPct: "15.0",
    walletRoiPct: null,
    roiGapPct: null,
    verdict: null,
    isLinkPinned: true,
    thesis: "Manual pinned thesis",
  },
];

const mockTradesList = {
  rows: mockComparisonItems.map((c) => ({
    id: c.id,
    ownWalletAddress: selfWalletAddress,
    ownChain: "base",
    tokenAddress: c.tokenAddress,
    tokenChain: c.tokenChain,
    tokenSymbol: c.tokenSymbol,
    side: c.side,
    amountUsd: c.amountUsd,
    entryAt: c.timestamp,
    exitAt: new Date(c.timestamp.getTime() + 7200000),
    roiPct: c.userRoiPct,
    followedWalletAddress: c.followedWalletAddress,
    followedWalletChain: c.followedWalletChain,
    followedWalletLabel: c.followedWalletLabel,
    lagMinutes: c.lagMinutes,
    lagMcDelta: c.lagMcDelta,
    walletRoiPct: c.walletRoiPct,
    lagBucket: c.lagBucket,
    thesis: c.thesis,
    source: c.isLinkPinned ? "MANUAL" : "AUTO",
    isLinkPinned: c.isLinkPinned,
    entryMarketCap: "10000000",
    createdAt: c.timestamp,
  })),
  nextCursor: null,
};

async function setupPhase5Mocks(page: Page) {
  await page.route("**/api/trpc/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const procedures = path.split("/").at(-1)!.split(",");

    const responses = procedures.map((proc) => {
      if (proc === "self.wallets") {
        return {
          result: {
            data: superjson.serialize([mockSelfWallet]),
          },
        };
      }

      if (proc === "self.dashboard") {
        return {
          result: {
            data: superjson.serialize(mockDashboard),
          },
        };
      }

      if (proc === "self.decay") {
        return {
          result: {
            data: superjson.serialize({
              followedWallet: { address: followedWalletAddress, chain: "base" },
              buckets: mockDecayBuckets,
              sampleSize: 6,
              insufficientSample: false,
            }),
          },
        };
      }

      if (proc === "self.comparison") {
        return {
          result: {
            data: superjson.serialize(mockComparisonItems),
          },
        };
      }

      if (proc === "self.trades") {
        return {
          result: {
            data: superjson.serialize(mockTradesList),
          },
        };
      }

      if (proc === "self.toggleSelf") {
        return {
          result: {
            data: superjson.serialize({
              address: selfWalletAddress,
              chain: "base",
              isSelf: true,
            }),
          },
        };
      }

      if (proc === "self.addTrade") {
        return {
          result: {
            data: superjson.serialize({
              id: "trade-new-1",
              ownWalletAddress: selfWalletAddress,
              ownChain: "BASE",
              tokenAddress,
              tokenChain: "BASE",
              side: "BUY",
              amountUsd: "500.00",
              source: "MANUAL",
              thesis: "Valid thesis",
              isLinkPinned: true,
            }),
          },
        };
      }

      if (proc === "wallet.list") {
        return {
          result: {
            data: superjson.serialize({
              items: [],
              total: 0,
            }),
          },
        };
      }

      return {
        result: {
          data: superjson.serialize(null),
        },
      };
    });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(responses),
    });
  });
}

test.describe("Phase 5 Acceptance: Self-Tracking & Edge Rider (SRS §8)", () => {
  test("phase5: self wallet registration ingests trades", async ({ page }) => {
    await setupPhase5Mocks(page);
    await page.goto("/self");

    // Check page title and header
    await expect(page.getByRole("heading", { name: /SELF-TRACKING & EDGE DECAY/i })).toBeVisible();
    await expect(page.getByText("EDGE RIDER", { exact: false })).toBeVisible();

    // Open register self identity modal
    const registerBtn = page.getByRole("button", { name: /REGISTER SELF WALLET/i });
    await expect(registerBtn).toBeVisible();
    await registerBtn.click();

    // Verify modal elements
    await expect(page.getByRole("heading", { name: /REGISTER OWN WALLET/i })).toBeVisible();
    await expect(page.getByPlaceholder("0x...")).toBeVisible();

    // Enter address and select chain
    await page.getByPlaceholder("0x...").fill(selfWalletAddress);
    const modalSubmit = page.getByRole("button", { name: /REGISTER & SYNC/i });
    await expect(modalSubmit).toBeVisible();
    await modalSubmit.click();

    // Modal closes
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("phase5: trades are auto-linked with lag data", async ({ page }) => {
    await setupPhase5Mocks(page);
    await page.goto("/self/trades");

    // Header & manual log section
    await expect(page.getByRole("heading", { name: /TRADE LOG & THESIS FORM/i })).toBeVisible();

    // Assert auto-linked trades rows contain lag data
    const row0 = page.getByRole("row").filter({ hasText: "Alpha Whale" }).first();
    await expect(row0).toBeVisible();
    await expect(row0.getByText("20m")).toBeVisible();
  });

  test("phase5: decay curve renders with ≥5 linked trades", async ({ page }) => {
    await setupPhase5Mocks(page);
    await page.goto("/self");

    // Edge decay curve component
    await expect(page.getByText("EDGE DECAY CURVE (FR-6.4)")).toBeVisible();
    await expect(page.getByText("★ 0-1H CAPTURE ZONE")).toBeVisible();

    // All 4 lag buckets visible
    await expect(page.getByRole("cell", { name: /0-1h/i }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: /1-6h/i }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: /6-24h/i }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: />24h/i }).first()).toBeVisible();

    // User ROI and win rate in Golden Zone (0-1h)
    await expect(page.getByText("35.00%").first()).toBeVisible();
    await expect(page.getByText("100.0%").first()).toBeVisible();
  });

  test("phase5: dashboard shows win rate and PnL", async ({ page }) => {
    await setupPhase5Mocks(page);
    await page.goto("/self");

    // Realized and Unrealized PnL
    await expect(page.getByText("+$200.00").first()).toBeVisible();
    await expect(page.getByText("+$750.00").first()).toBeVisible();

    // Win Rate & Lag
    await expect(page.getByText("66.7%")).toBeVisible();
    await expect(page.getByText("38m").first()).toBeVisible();

    // Segmented breakdown tabs
    const tokenTab = page.getByRole("button", { name: "BY TOKEN" });
    await expect(tokenTab).toBeVisible();
    await tokenTab.click();
    await expect(page.getByRole("cell", { name: "ALPHA", exact: true })).toBeVisible();

    const lagTab = page.getByRole("button", { name: "BY LAG BUCKET" });
    await expect(lagTab).toBeVisible();
    await lagTab.click();
    await expect(page.getByRole("cell", { name: /0-1h/ }).first()).toBeVisible();
  });

  test("phase5: comparison view lists user vs wallet ROI", async ({ page }) => {
    await setupPhase5Mocks(page);
    await page.goto("/self");

    // Comparison view header
    await expect(page.getByText("EXECUTION COMPARISON VIEW (FR-6.6)")).toBeVisible();

    // Verdict badges: CAPTURED and DECAYED
    await expect(page.getByText("● CAPTURED")).toBeVisible();
    await expect(page.getByText("○ DECAYED")).toBeVisible();

    // Pinned trade icon
    await expect(page.getByTitle("Pinned by user")).toBeVisible();
  });
});
