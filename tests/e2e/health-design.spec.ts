import { expect, test, type Page } from "@playwright/test";
import superjson from "superjson";

test.use({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000" });

async function mockHealth(page: Page, exhausted = false, unavailable = false) {
  await page.route("**/api/trpc/**", async (route) => {
    const procedures = new URL(route.request().url()).pathname.split("/").at(-1)!.split(",");
    await route.fulfill({ json: procedures.map((name) => {
      if (unavailable && name === "health.quota") return { error: { json: { message: "Unavailable", code: -32603, data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 } } } };
      const data = name === "health.status"
        ? { db: "ok", redis: "ok", migration: "0001_phase0_initial", settings: null, queues: { intake: { waiting: 3, active: 1, completed: 8, failed: 0, delayed: 0 } } }
        : { providers: [
          { provider: "etherscan", callsToday: exhausted ? 100000 : 4500, dailyLimit: 100000, remainingToday: exhausted ? 0 : 95500, tokensAvailable: 4, refillPerSecond: 4, rateLimitHitsToday: 0, windowResetsAt: new Date("2026-09-07T00:00:00Z") },
          { provider: "alchemy-robinhood", callsToday: 120, dailyLimit: null, remainingToday: null, tokensAvailable: 0, refillPerSecond: 4, rateLimitHitsToday: 2, windowResetsAt: new Date("2026-09-07T00:00:00Z") },
        ] };
      return { result: { data: superjson.serialize(data) } };
    }) });
  });
}

test("health uses live queue and quota data, explicit unknown limits, and timezone controls", async ({ page }) => {
  await mockHealth(page);
  await page.goto("/health");
  await expect(page.getByText("3 waiting / 1 active")).toBeVisible();
  await expect(page.getByRole("row", { name: /etherscan/ })).toContainText("95,500");
  await expect(page.getByRole("row", { name: /alchemy-robinhood/ })).toContainText("UNKNOWN");
  await page.getByRole("button", { name: "UTC", exact: true }).click();
  await expect(page.getByRole("button", { name: "UTC", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "BLK", exact: true }).click();
  await expect(page.getByText("Block unavailable", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Bull Board/ })).toHaveAttribute("href", "/api/bull-board");
});

test("quota exhaustion preserves other providers and mobile layout", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockHealth(page, true);
  await page.goto("/health");
  await expect(page.getByRole("row", { name: /etherscan/ })).toContainText("RATE LIMITED");
  await expect(page.getByRole("row", { name: /alchemy-robinhood/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/health-mobile.png", fullPage: true });
});

test("quota failure is visible while infrastructure remains readable", async ({ page }) => {
  await mockHealth(page, false, true);
  await page.goto("/health");
  await expect(page.getByText("Provider usage unavailable")).toBeVisible();
  await expect(page.getByText("PostgreSQL", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh status" })).toBeEnabled();
});
