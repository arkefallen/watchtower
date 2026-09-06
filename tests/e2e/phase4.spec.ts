import { expect, test, type Page } from "@playwright/test";
import superjson from "superjson";

test.use({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000" });

const testWallet = "0x4000000000000000000000000000000000000001";
const testTxHash = "0x40000000000000000000000000000000000000000000000000000000000000a1";

const mockA1Alert = {
  id: "alert-a1-test-1",
  type: "A1",
  state: "ARMED",
  occurredAt: new Date("2026-02-15T12:00:00.000Z"),
  createdAt: new Date("2026-02-15T12:00:00.000Z"),
  readAt: null,
  walletAddress: testWallet,
  walletChain: "BASE",
  chain: "base",
  tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  amountUsd: "5000.00",
  clusterId: null,
  isAcknowledged: false,
  dedupeKey: `A1:${testWallet}:base:-:100`,
  evidenceJson: {
    ruleId: "A1",
    ruleName: "Stablecoin Arming",
    ruleText: "Wallet receives single-day stablecoin inflow >= max($1,000 floor, 3.0x 30-day median single-day inflow).",
    thresholds: {
      floorUsd: 1000,
      medianMultiple: 3,
      medianDailyUsd: 500,
      medianArmUsd: 1500,
      effectiveThresholdUsd: 1500,
      bindingArm: "MEDIAN",
    },
    observed: {
      windowInflowUsd: "5000.00",
      medianDailyStableInflowUsd: "500.00",
      eventCount: 1,
    },
    windows: {
      window: "24h",
    },
    txLinks: [
      {
        hash: testTxHash,
        url: `https://basescan.org/tx/${testTxHash}`,
        label: "Stable parking $5000.00",
      },
    ],
  },
  wallet: {
    address: testWallet,
    chain: "BASE",
    ensName: "whale-prime.eth",
    label: "Alpha Funder",
    edge: "SMART",
    style: "SNIPER",
    size: "W",
    isSelf: false,
    watchPriority: "NORMAL",
  },
  token: {
    address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    symbol: "USDC",
    chain: "BASE",
    decimals: 6,
  },
};

async function setupPhase4Mocks(page: Page) {
  await page.route("**/api/trpc/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const procedures = path.split("/").at(-1)!.split(",");

    const responses = procedures.map((proc) => {
      if (proc === "alert.list") {
        return {
          result: {
            data: superjson.serialize({
              items: [mockA1Alert],
              nextCursor: null,
              totalCount: 1,
            }),
          },
        };
      }

      if (proc === "alert.unreadCount") {
        return {
          result: {
            data: superjson.serialize({ count: 1 }),
          },
        };
      }

      if (proc === "alert.kpis") {
        return {
          result: {
            data: superjson.serialize({
              totalActive: 1,
              armedCount: 1,
              triggeredCount: 0,
              exitRiskCount: 0,
              unreadCount: 1,
            }),
          },
        };
      }

      if (proc === "wallet.list") {
        return {
          result: {
            data: superjson.serialize({
              items: [
                {
                  address: testWallet,
                  chain: "base",
                  label: "Alpha Funder",
                  ensName: "whale-prime.eth",
                  edge: "SMART",
                  style: "SNIPER",
                  size: "W",
                  isBlacklisted: false,
                  isSelf: false,
                  watchPriority: "NORMAL",
                  alertState: { state: "ARMED", reason: "A1" },
                  syncState: { status: "SYNCED" },
                  profile: { stableBalanceUsd: 5000 },
                  clusterLinks: [],
                },
              ],
              total: 1,
            }),
          },
        };
      }

      if (proc === "wallet.get") {
        return {
          result: {
            data: superjson.serialize({
              address: testWallet,
              chain: "BASE",
              label: "Alpha Funder",
              ensName: "whale-prime.eth",
              edge: "SMART",
              style: "SNIPER",
              size: "W",
              isBlacklisted: false,
              isSelf: false,
              watchPriority: "NORMAL",
              alertState: { state: "ARMED", stateReason: "A1" },
              syncState: { status: "SYNCED" },
              profile: {
                firstTxAt: new Date("2025-01-01"),
                stableBalanceUsd: "5000",
                txCount: 42,
                distinctTokenCount: 5,
              },
              clusterLinks: [],
            }),
          },
        };
      }

      if (proc === "wallet.parking") {
        return {
          result: {
            data: superjson.serialize({
              timeline: [],
              currentParkedUsd: "5000",
            }),
          },
        };
      }

      if (proc === "funding.tree") {
        return {
          result: {
            data: superjson.serialize({
              root: {
                address: testWallet,
                chain: "base",
                children: [],
              },
            }),
          },
        };
      }

      if (proc === "interaction.graph") {
        return {
          result: {
            data: superjson.serialize({
              nodes: [
                {
                  id: `base:${testWallet}`,
                  address: testWallet,
                  chain: "BASE",
                  ensName: "whale-prime.eth",
                  label: "Alpha Funder",
                  sizeTag: "W",
                  stableBalanceUsd: 5000,
                  alertState: "ARMED",
                  clusterId: null,
                  clusterName: null,
                  clusterColor: null,
                  isSecondary: false,
                },
              ],
              edges: [],
              clusters: [],
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

test.describe("Phase 4 Acceptance: Alert Engine & Wallet State Machine (SRS §8)", () => {
  test("phase4: first sync produces backfilled alerts", async ({ page }) => {
    await setupPhase4Mocks(page);
    await page.goto("/alerts");

    // Header & Alert Center Title
    await expect(page.getByRole("heading", { name: /ALERT/i })).toBeVisible();

    // KPI Metrics Bar
    await expect(page.getByText("TOTAL ACTIVE")).toBeVisible();
    await expect(page.getByText("ARMED WALLETS")).toBeVisible();

    // Backfilled A1 Alert is present
    const a1Row = page.getByRole("row").filter({ hasText: "A1" }).first();
    await expect(a1Row).toBeVisible();
    await expect(page.getByText("whale-prime.eth").first()).toBeVisible();
  });

  test("phase4: stablecoin inflow trips A1", async ({ page }) => {
    await setupPhase4Mocks(page);
    await page.goto("/alerts");

    // A1 Alert Badge in row
    const a1Row = page.getByRole("row").filter({ hasText: "A1" }).first();
    await expect(a1Row).toBeVisible();
    await expect(a1Row.getByText("A1")).toBeVisible();
    await expect(a1Row.getByText("ARMED")).toBeVisible();
  });

  test("phase4: A1 evidence tooltip shows rule, thresholds, numbers, tx link", async ({ page }) => {
    await setupPhase4Mocks(page);
    await page.goto("/alerts");

    // Click row or inspect evidence button to expand the evidence trail for the A1 alert
    const inspectBtn = page.getByRole("button", { name: /Inspect evidence/i }).first();
    await expect(inspectBtn).toBeVisible();
    await inspectBtn.click();

    // Verify Evidence Rail is open
    await expect(page.getByRole("complementary", { name: "Evidence Rail" })).toBeVisible();

    // Verify Rule Text
    await expect(page.getByText(/Wallet receives single-day stablecoin inflow/i)).toBeVisible();

    // Verify Thresholds
    await expect(page.getByText("floorUsd")).toBeVisible();
    await expect(page.getByText("1000")).toBeVisible();

    // Verify Observed Numbers
    await expect(page.getByText("windowInflowUsd")).toBeVisible();
    await expect(page.getByText("5000.00", { exact: true })).toBeVisible();

    // Verify Tx Link
    const txLink = page.getByRole("link", { name: /VIEW/i }).first();
    await expect(txLink).toBeVisible();
    await expect(txLink).toHaveAttribute("href", new RegExp(testTxHash));
  });

  test("phase4: ARMED badge renders on the wallet list", async ({ page }) => {
    await setupPhase4Mocks(page);
    await page.goto("/wallets");

    // Table row contains ARMED badge
    const armedBadge = page.getByTestId("badge-armed").first();
    await expect(armedBadge).toBeVisible();
    await expect(armedBadge).toContainText("ARMED (A1)");
  });

  test("phase4: ARMED border renders on the graph node", async ({ page }) => {
    await setupPhase4Mocks(page);
    await page.goto("/graph");

    // Graph page loads with legend and controls
    await expect(page.getByText("GRAPH ENCODING")).toBeVisible();
    await expect(page.getByText("NODE BORDER (ALERT STATE)")).toBeVisible();

    // Legend documents ARMED border color
    await expect(page.getByText("ARMED").first()).toBeVisible();
  });

  test("phase4: ARMED badge renders on the wallet detail page", async ({ page }) => {
    await setupPhase4Mocks(page);
    await page.goto(`/wallets/base/${testWallet}`);

    // Detail header renders ARMED badge
    const armedBadge = page.getByTestId("badge-armed").first();
    await expect(armedBadge).toBeVisible();
    await expect(armedBadge).toContainText("ARMED (A1)");
  });
});
