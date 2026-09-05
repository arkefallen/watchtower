import { describe, expect, it } from "vitest";

import { clampProgress, reportProgress } from "@/lib/queue/progress";
import { deterministicJobId } from "@/server/workers/job-run-projection";

describe("queue infrastructure", () => {
  it("keeps progress monotonic and clamps it to 100", async () => {
    const updates: number[] = [];
    const job = { updateProgress: async (value: { pct: number }) => { updates.push(value.pct); } };
    await reportProgress(job, { pct: 80, stage: "a", message: "a" });
    await reportProgress(job, { pct: 20, stage: "b", message: "b" }, updates.at(-1));
    await reportProgress(job, { pct: 150, stage: "done", message: "done" }, updates.at(-1));
    expect(updates).toEqual([80, 80, 100]);
    expect(clampProgress({ pct: -2, stage: "x", message: "x" }).pct).toBe(0);
  });

  it("builds deterministic job IDs", () => {
    expect(deterministicJobId("intake", ["base", "0x1"])).toBe("intake:base:0x1");
  });
});
