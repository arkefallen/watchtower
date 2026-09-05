import { expect, test } from "@playwright/test";
import { buildPhase1Csv, PHASE1_WALLETS } from "../helpers/e2e-import";

test.describe("Phase 1 Acceptance: Registry & Funding Tracer (SRS §8)", () => {
  test("phase1: CSV batch import validates lines and enqueues intake", async ({ page }) => {
    await page.goto("/wallets/new");
    await expect(page.getByRole("heading", { name: "WALLET INTAKE" })).toBeVisible();

    // 1. Assert pre-flight validation callout on invalid input
    const textarea = page.getByPlaceholder(/0x71c...a1b2,base,Whale/i);
    await textarea.fill("0xbad_short_address,base,Malformed Line");
    await expect(page.getByText(/Validation Issues Found/i)).toBeVisible();
    await expect(page.getByText(/Line 1: Invalid address length/i)).toBeVisible();

    // 2. Paste valid 10-wallet CSV
    const csvContent = buildPhase1Csv();
    await textarea.fill(csvContent);
    await expect(page.getByText("Ready to import: 10 valid wallets")).toBeVisible();
    await expect(page.getByText("0 invalid lines")).toBeVisible();

    // 3. Start batch intake
    const submitBtn = page.getByRole("button", { name: /Start Batch Intake/i });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 4. Verify live intake monitor drawer
    await expect(page.getByText(/BATCH INTAKE PROGRESS/i)).toBeVisible();
    await expect(page.getByText(/Intake runs asynchronously/i)).toBeVisible();
  });

  test("phase1: wallet list displays dense registry, filters, and bulk actions", async ({ page }) => {
    await page.goto("/wallets");
    await expect(page.getByRole("heading", { name: "WALLETS" })).toBeVisible();

    // Search and filter controls
    await expect(page.getByPlaceholder(/Search 0x address, ENS name/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Import Wallets/i })).toBeVisible();

    // Timezone toggle
    const localToggle = page.getByRole("button", { name: "Local" });
    const utcToggle = page.getByRole("button", { name: "UTC" });
    await expect(localToggle).toBeVisible();
    await expect(utcToggle).toBeVisible();
  });

  test("phase1: wallet profile displays stats, dual heatmaps, and parking timeline", async ({ page }) => {
    const target = PHASE1_WALLETS[0];
    await page.goto(`/wallets/${target.chain}/${target.address}`);

    // Profile header
    await expect(page.getByText(target.address)).toBeVisible();
    await expect(page.getByRole("button", { name: /Re-sync Wallet/i })).toBeVisible();

    // 6 profile stats cards
    await expect(page.getByText("First Tx Date")).toBeVisible();
    await expect(page.getByText("Age at 1st Memecoin")).toBeVisible();
    await expect(page.getByText("Total Ingested Txs")).toBeVisible();
    await expect(page.getByText("Distinct Tokens")).toBeVisible();
    await expect(page.getByText("Current Parked Stables")).toBeVisible();
    await expect(page.getByText("Dormancy Status")).toBeVisible();

    // Dual-mode Activity Heatmap
    await expect(page.getByText(/ONCHAIN ACTIVITY HEATMAP/i)).toBeVisible();
    const habitualBtn = page.getByRole("button", { name: /Habitual Timing/i });
    const rollingBtn = page.getByRole("button", { name: /Rolling 7 Local Days/i });
    await expect(habitualBtn).toBeVisible();
    await expect(rollingBtn).toBeVisible();

    // Mode toggle interaction
    await rollingBtn.click();
    await expect(rollingBtn).toHaveClass(/bg-amber-400/);
    await habitualBtn.click();
    await expect(habitualBtn).toHaveClass(/bg-amber-400/);

    // Parking Timeline
    await expect(page.getByText(/STABLECOIN PARKING TIMELINE/i)).toBeVisible();
  });

  test("phase1: recursive funding tree renders terminal entities, primary warnings, and deep trace", async ({ page }) => {
    const target = PHASE1_WALLETS[0];
    await page.goto(`/wallets/${target.chain}/${target.address}`);

    // Switch to Funding & Clusters tab
    const fundingTab = page.getByRole("button", { name: /Recursive Funding & Clusters/i });
    await expect(fundingTab).toBeVisible();
    await fundingTab.click();

    // Funding tree canvas and headers
    await expect(page.getByText(/RECURSIVE FUNDING TREE/i)).toBeVisible();
    await expect(page.getByText(/FUNDING AUDIT & ENTITY METRICS/i)).toBeVisible();
  });

  test("phase1: cluster index lists auto-created clusters with member rollups", async ({ page }) => {
    await page.goto("/clusters");
    await expect(page.getByRole("heading", { name: "SHARED-FUNDER CLUSTERS" })).toBeVisible();
    await expect(page.getByText(/Auto-detected wallet groups/i)).toBeVisible();
  });

  test("phase1: UI remains navigable during operations", async ({ page }) => {
    await page.goto("/wallets");
    await expect(page.getByRole("heading", { name: "WALLETS" })).toBeVisible();

    await page.getByRole("link", { name: "Clusters" }).click();
    await expect(page.getByRole("heading", { name: "SHARED-FUNDER CLUSTERS" })).toBeVisible();

    await page.getByRole("link", { name: "Health" }).click();
    await expect(page.getByRole("heading", { name: "System health" })).toBeVisible();

    await page.getByRole("link", { name: "Wallets" }).click();
    await expect(page.getByRole("heading", { name: "WALLETS" })).toBeVisible();
  });
});
