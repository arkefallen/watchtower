import { expect, test, type Page } from "@playwright/test";
import superjson from "superjson";

test.use({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000" });

const pepeAddress = "0x6982508145454ce325ddbe47a25d4ec3d2311933";
const deployerAddress = "0xde91000000000000000000000000000000000001";
const trackedWallet = "0x1111111111111111111111111111111111111111";
const promoterTxHash = "0x6000000000000000000000000000000000000000000000000000000000000010";

const mockLookupResult = {
  isKnown: true,
  tokenAddress: pepeAddress,
  chain: "base",
  token: {
    address: pepeAddress,
    chain: "base",
    symbol: "PEPE",
    name: "Pepe Token",
    decimals: 18,
    deployedAt: "2026-01-01T00:00:00.000Z",
    deployerAddress,
    tokenAgeDays: 59,
    latestPriceUsd: "0.0000084",
    latestMarketCap: "3500000000",
    latestPriceAt: "2026-03-01T00:00:00.000Z",
  },
  holders: [
    {
      walletAddress: trackedWallet,
      ensName: "whale.eth",
      label: "SMART-RIDER [W]",
      grade: {
        available: true,
        winRatePct: 70,
        realizedPnlUsd: "5300.00",
        entryTimingRatio: 0.25,
      },
      entryMarketCap: "1200000",
      status: "HOLDING",
      amountRaw: "5000000000000000000000000",
      holdingsUsd: "42000.00",
      shareOfTrackedPct: 100,
      openedAt: "2026-01-02T10:00:00Z",
      closedAt: null,
    },
  ],
  netflow: {
    window24h: { buyUsd: 1000, sellUsd: 0, netUsd: 1000, buyCount: 1, sellCount: 0 },
    window7d: { buyUsd: 1000, sellUsd: 0, netUsd: 1000, buyCount: 1, sellCount: 0 },
    window30d: { buyUsd: 1000, sellUsd: 0, netUsd: 1000, buyCount: 1, sellCount: 0 },
    history: [
      { date: "2026-01-02", buyUsd: 1000, sellUsd: 0, netUsd: 1000 },
    ],
  },
  clusterWarnings: [
    {
      clusterId: "cluster-alpha",
      clusterName: "Cluster Alpha",
      colorHex: "#D7A84B",
      walletCount: 2,
      wallets: [trackedWallet, "0x2222222222222222222222222222222222222222"],
    },
  ],
  redFlags: {
    tokenAddress: pepeAddress,
    chain: "base",
    deployedAt: "2026-01-01T00:00:00.000Z",
    tokenAgeDays: 59,
    deployerAddress,
    hasPromoterWarning: true,
    promoterWarnings: [
      {
        walletAddress: trackedWallet,
        txHash: promoterTxHash,
        amount: "5000000000000000000000000",
        timestamp: "2026-01-02T10:00:00.000Z",
      },
    ],
    top10SharePct: 42.8,
    holderCount: 12500,
    holderDataUnavailable: false,
    checkedAt: "2026-03-01T00:00:00.000Z",
  },
  supplyConcentration: {
    trackedWalletsCount: 1,
    totalTrackedHoldingsUsd: 42000,
    trackedSupplySharePct: 5.0,
    top10ExplorerSharePct: 42.8,
  },
  renderDurationMs: 24,
};

const mockWalletProfile = {
  address: trackedWallet,
  chain: "BASE",
  ensName: "whale.eth",
  label: "Smart Alpha Whale",
  edge: "SMART",
  style: "RIDER",
  size: "W",
  notes: "Followed smart trader",
  isBlacklisted: false,
  isSelf: false,
  watchPriority: "HIGH",
  firstTxAt: new Date("2026-01-01T00:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-03-01T00:00:00.000Z"),
  profile: {
    firstTxAt: new Date("2026-01-01T00:00:00.000Z"),
    walletAgeAtFirstMemeDays: 14,
    totalTxCount: 250,
    tokenDiversityCount: 18,
    stablecoinBalanceUsd: "15000.00",
    dormantSince: null,
    activityState: "ACTIVE",
    gradeJson: {
      available: true,
      sampleSize: 10,
      closedPositionsCount: 10,
      profitablePositionsCount: 7,
      winRate: 0.7,
      winRatePct: 70,
      realizedPnlUsd: "5300.00",
      entryTimingRatio: 0.399,
      gradeLabel: "SMART-RIDER [W]",
      computedAt: "2026-03-01T00:00:00.000Z",
    },
  },
  syncState: {
    status: "SYNCED",
    lastSyncedAt: new Date("2026-03-01T00:00:00.000Z"),
    lastSyncedBlock: 12000000n,
  },
  _count: {
    ownTrades: 0,
    movements: 25,
  },
};

const mockGradeResult = {
  available: true,
  sampleSize: 10,
  closedPositionsCount: 10,
  profitablePositionsCount: 7,
  winRate: 0.7,
  winRatePct: 70,
  realizedPnlUsd: "5300.00",
  entryTimingRatio: 0.399,
  gradeLabel: "SMART-RIDER [W]",
  computedAt: "2026-03-01T00:00:00.000Z",
};

async function setupPhase6Mocks(page: Page) {
  await page.route("**/api/trpc/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const procedures = path.split("/").at(-1)!.split(",");

    const responses = procedures.map((proc) => {
      if (proc === "token.lookup") {
        return {
          result: {
            data: superjson.serialize(mockLookupResult),
          },
        };
      }

      if (proc === "token.refresh") {
        return {
          result: {
            data: superjson.serialize({
              success: true,
              jobId: "bullmq-job-12345678",
              message: "Token metadata refresh dispatched to background queue",
            }),
          },
        };
      }

      if (proc === "wallet.get") {
        return {
          result: {
            data: superjson.serialize(mockWalletProfile),
          },
        };
      }

      if (proc === "wallet.grade") {
        return {
          result: {
            data: superjson.serialize(mockGradeResult),
          },
        };
      }

      if (proc === "wallet.profile") {
        return {
          result: {
            data: superjson.serialize(mockWalletProfile.profile),
          },
        };
      }

      if (proc === "wallet.parking") {
        return {
          result: {
            data: superjson.serialize({
              currentBalances: [{ token: "USDC", balance: "15000.00" }],
              timeline: [],
            }),
          },
        };
      }

      if (proc === "funding.tree") {
        return {
          result: {
            data: superjson.serialize({
              nodes: [],
              edges: [],
            }),
          },
        };
      }

      if (proc === "graph.independence") {
        return {
          result: {
            data: superjson.serialize({
              isIndependent: true,
              statements: ["INDEPENDENT — no funding or co-entry edge"],
            }),
          },
        };
      }

      if (proc === "alert.list") {
        return {
          result: {
            data: superjson.serialize({
              alerts: [],
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

test.describe("Phase 6 Acceptance: Token Lookup & Grading (SRS §8)", () => {
  test("phase6: token panel renders holders, netflow, and red flags", async ({ page }) => {
    await setupPhase6Mocks(page);
    await page.goto(`/tokens/base/${pepeAddress}`);

    // Verify token header summary
    await expect(page.getByRole("heading", { name: "$PEPE" })).toBeVisible();
    await expect(page.getByText("(Pepe Token)")).toBeVisible();
    await expect(page.getByText("INDEXED IN DB")).toBeVisible();

    // Section 1: Tracked-Wallet Holders
    await expect(page.getByText("Tracked-Wallet Holders")).toBeVisible();
    await expect(page.getByText("whale.eth")).toBeVisible();
    await expect(page.getByText("SMART-RIDER [W]")).toBeVisible();
    await expect(page.getByText("HOLDING", { exact: true })).toBeVisible();
    await expect(page.getByText("$1,200,000")).toBeVisible();

    // Section 2: Netflow Analytics
    await expect(page.getByText("Tracked-Wallet Netflow Analytics")).toBeVisible();
    await expect(page.getByText("24-Hour Netflow")).toBeVisible();
    await expect(page.getByText("7-Day Netflow")).toBeVisible();
    await expect(page.getByText("30-Day Netflow")).toBeVisible();

    // Section 3: Red Flags & Warnings
    await expect(page.getByText("Paid-Promoter Warning")).toBeVisible();
    await expect(page.getByText("Top 10 Supply Concentration")).toBeVisible();
    await expect(page.getByText("42.8%")).toBeVisible();
  });

  test("phase6: panel renders in under 3 seconds", async ({ page }) => {
    await setupPhase6Mocks(page);

    const startTime = Date.now();
    await page.goto(`/tokens/base/${pepeAddress}`);

    // Wait for the panel content to render
    await expect(page.getByRole("heading", { name: "$PEPE" })).toBeVisible();
    const duration = Date.now() - startTime;

    // Must be well under the 3-second SLA threshold
    expect(duration).toBeLessThan(3000);

    // Verify SLA indicator badge in UI
    await expect(page.getByText(/Local DB \(< 3s SLA\)/i)).toBeVisible();
    await expect(page.getByText(/Rendered in \d+ms/i)).toBeVisible();
  });

  test("phase6: promoter red flag is visible for a deployer-funded wallet", async ({ page }) => {
    await setupPhase6Mocks(page);
    await page.goto(`/tokens/base/${pepeAddress}`);

    // Paid-Promoter warning box
    const promoterBanner = page.getByText(/Paid-Promoter Warning/i);
    await expect(promoterBanner).toBeVisible();

    // Identifies the deployer-funded tracked wallet
    await expect(page.getByRole("link", { name: "0x1111...1111" })).toBeVisible();

    // Identifies the transfer transaction hash with explorer link
    await expect(page.getByRole("link", { name: /0x600000\.\.\.000010/i })).toBeVisible();

    // Cluster presence alert
    await expect(page.getByText(/Cluster Presence Alert/i)).toBeVisible();
    await expect(page.getByText("Cluster Alpha")).toBeVisible();
  });

  test("phase6: wallet profile shows the auto-grade block", async ({ page }) => {
    await setupPhase6Mocks(page);
    await page.goto(`/wallets/base/${trackedWallet}`);

    // Auto-grade card header
    await expect(page.getByText("Auto-Grade Assessment")).toBeVisible();
    await expect(page.getByText("GRADE ACTIVE")).toBeVisible();
    await expect(page.getByText("SMART-RIDER [W]").first()).toBeVisible();

    // Key metrics: Win Rate, Realized PnL, Entry-Timing Ratio
    await expect(page.getByText("Win Rate")).toBeVisible();
    await expect(page.getByText("70.0%")).toBeVisible();

    await expect(page.getByText("Realized PnL")).toBeVisible();
    await expect(page.getByText("+$5,300.00")).toBeVisible();

    await expect(page.getByText("Entry-Timing Ratio")).toBeVisible();
    await expect(page.getByText("0.399")).toBeVisible();
  });
});
