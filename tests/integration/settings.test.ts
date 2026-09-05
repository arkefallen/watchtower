import { describe, expect, it } from "vitest";

import { loadSettings, updateSettings } from "@/server/services/settings";

const canRun = Boolean(process.env.DATABASE_URL && process.env.REDIS_URL);

describe.skipIf(!canRun)("settings store integration", () => {
  it("persists a patch and reads it back from the DB-backed store", async () => {
    const updated = await updateSettings({
      alertThresholds: { a1MinStableInflowUsd: 2500 },
    });
    expect(updated.alertThresholds.a1MinStableInflowUsd).toBe(2500);

    const loaded = await loadSettings();
    expect(loaded.alertThresholds.a1MinStableInflowUsd).toBe(2500);
  }, 15_000);
});
