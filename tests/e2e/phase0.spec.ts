import { expect, test } from "@playwright/test";

test.use({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000" });

test.describe("Phase 0 health surface", () => {
  test("renders database, Redis, migration, and enabled provider status", async ({ page }) => {
    await page.goto("/health");
    await expect(page.getByRole("heading", { name: "System health" })).toBeVisible();
    await expect(page.getByText("PostgreSQL")).toBeVisible();
    await expect(page.getByText("Redis")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Provider quota" })).toBeVisible();
    await expect(page.getByLabel("System metadata").getByText("0001_phase0_initial", { exact: true })).toBeVisible();
    await expect(page.getByText("etherscan", { exact: true })).toBeVisible();
    await expect(page.getByText("dexscreener", { exact: true })).toBeVisible();
  });

  test("JSON health endpoint reports the local runtime", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();
    const body = await response.json() as { db: string; redis: string; migration: string };
    expect(body).toMatchObject({ db: "ok", redis: "ok", migration: "0001_phase0_initial" });
  });

  test("exposes the approved shell navigation and time/block toggle", async ({ page }) => {
    await page.goto("/health");
    const navigation = page.getByRole("navigation", { name: "Primary navigation" });
    for (const label of ["Dashboard", "Wallets", "Clusters", "Graph", "Radar", "Alerts", "Self-tracking", "Token lookup", "Settings", "Health"]) {
      await expect(navigation.getByRole("link", { name: label })).toBeVisible();
    }
    const timeCell = page.getByRole("button", { name: "Show block number" });
    await expect(timeCell).toBeVisible();
    await timeCell.click();
    await expect(page.getByRole("button", { name: "Show local time" })).toHaveText("Block unavailable");
  });

  test("serves the protected local Bull Board surface", async ({ page }) => {
    await page.goto("/api/bull-board");
    await expect(page.getByRole("heading", { name: "Bull Board" })).toBeVisible();
    await expect(page.getByText("watchtower.intake", { exact: true })).toBeVisible();
    await expect(page.getByText("watchtower.maintenance", { exact: true })).toBeVisible();
  });
});
