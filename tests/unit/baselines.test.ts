// tests/unit/baselines.test.ts
import { describe, expect, it } from "vitest";
import {
  computeInflowMedian,
  compute30DayBaseline,
} from "@/server/services/alert/baselines";
import {
  resetStablePeakOnArming,
  updateStablePeak,
  computeStablePeakSinceArmed,
} from "@/server/services/alert/peak";

describe("P4-T02: Baseline Statistics and Peak Tracker", () => {
  it("baselines: median excludes zero-inflow days", () => {
    // 7 qualifying positive days plus several zero/negative/null days
    const inflows = [0, 100, 0, 200, null, 300, 400, 0, 500, 600, 700, undefined, 0];
    const res = computeInflowMedian(inflows);

    expect(res.available).toBe(true);
    expect(res.qualifyingDays).toBe(7);
    // Median of [100, 200, 300, 400, 500, 600, 700] is 400
    expect(res.medianUsd).toBe(400);
    expect(res.medianStr).toBe("400.00");
  });

  it("baselines: fewer than 7 qualifying days reports unavailable", () => {
    // Only 5 non-zero positive days
    const inflows = [100, 200, 300, 400, 500];
    const res = computeInflowMedian(inflows);

    expect(res.available).toBe(false);
    expect(res.qualifyingDays).toBe(5);
    expect(res.medianUsd).toBeNull();
    expect(res.medianStr).toBeNull();

    // 6 days also unavailable
    const res6 = computeInflowMedian([10, 20, 30, 40, 50, 60]);
    expect(res6.available).toBe(false);
  });

  it("baselines: even-count median uses the standard midpoint", () => {
    // 8 qualifying days: [100, 200, 300, 400, 500, 600, 700, 800]
    // Midpoint of 400 and 500 is 450
    const inflows = [800, 100, 700, 200, 600, 300, 500, 400];
    const res = computeInflowMedian(inflows);

    expect(res.available).toBe(true);
    expect(res.qualifyingDays).toBe(8);
    expect(res.medianUsd).toBe(450);
    expect(res.medianStr).toBe("450.00");
  });

  it("baselines: DoD case [100, 200, 300, 400, 500, 600, 700] median is 400 and 3x is 1200", () => {
    const inflows = [100, 200, 300, 400, 500, 600, 700];
    const res = computeInflowMedian(inflows);

    expect(res.available).toBe(true);
    expect(res.medianUsd).toBe(400);
    const a1MedianMultiple = 3;
    expect(res.medianUsd! * a1MedianMultiple).toBe(1200);
  });

  it("baselines: 30-day baseline covers exactly 30 days", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    const dayMs = 24 * 3600 * 1000;

    const records = [
      // Day 35 ago - OUTSIDE 30d window
      { timestamp: new Date(now.getTime() - 35 * dayMs), balanceUsd: 9999 },
      // Day 31 ago - OUTSIDE 30d window
      { timestamp: new Date(now.getTime() - 31 * dayMs), balanceUsd: 8888 },
      // Day 30 ago - boundary inside
      { timestamp: new Date(now.getTime() - 30 * dayMs), balanceUsd: 1000 },
      // Day 20 ago
      { timestamp: new Date(now.getTime() - 20 * dayMs), balanceUsd: 1000 },
      // Day 10 ago
      { timestamp: new Date(now.getTime() - 10 * dayMs), balanceUsd: 1000 },
      // Day 0 (now)
      { timestamp: now, balanceUsd: 1000 },
      // Future date - OUTSIDE
      { timestamp: new Date(now.getTime() + 1 * dayMs), balanceUsd: 5555 },
    ];

    const res = compute30DayBaseline(records, now);
    expect(res.count).toBe(4);
    // Average of four 1000s is 1000
    expect(res.baselineUsd).toBe(1000);
    expect(res.baselineStr).toBe("1000.00");
  });

  it("baselines: stable peak resets on arming", () => {
    const armTime = new Date("2026-09-01T08:00:00Z");
    const peak = resetStablePeakOnArming(500, armTime);

    expect(peak.peakUsd).toBe("500.00");
    expect(peak.peakAt).toEqual(armTime);

    // Reset with 0 or null
    const zeroPeak = resetStablePeakOnArming(null, armTime);
    expect(zeroPeak.peakUsd).toBe("0.00");
    expect(zeroPeak.peakAt).toEqual(armTime);
  });

  it("baselines: peak timestamp accompanies the peak value", () => {
    const armTime = new Date("2026-09-01T08:00:00Z");
    const time1 = new Date("2026-09-01T10:00:00Z");
    const time2 = new Date("2026-09-01T14:00:00Z");
    const time3 = new Date("2026-09-01T18:00:00Z");

    const snapshots = [
      { timestamp: new Date("2026-09-01T06:00:00Z"), balanceUsd: 5000 }, // Before arming, ignored
      { timestamp: time1, balanceUsd: 1500 },
      { timestamp: time2, balanceUsd: 3500 }, // New peak
      { timestamp: time3, balanceUsd: 2000 }, // Lower, should not overwrite
    ];

    const peak = computeStablePeakSinceArmed(snapshots, armTime);
    expect(peak).not.toBeNull();
    expect(peak?.peakUsd).toBe("3500.00");
    expect(peak?.peakAt).toEqual(time2);

    // Test updating peak step by step
    let runningPeak = resetStablePeakOnArming(1000, armTime);
    expect(runningPeak.peakUsd).toBe("1000.00");

    runningPeak = updateStablePeak(runningPeak, { timestamp: time1, balanceUsd: 1200 })!;
    expect(runningPeak.peakUsd).toBe("1200.00");
    expect(runningPeak.peakAt).toEqual(time1);

    runningPeak = updateStablePeak(runningPeak, { timestamp: time2, balanceUsd: 1100 })!;
    // Remains 1200 at time1
    expect(runningPeak.peakUsd).toBe("1200.00");
    expect(runningPeak.peakAt).toEqual(time1);
  });
});
