import { describe, expect, it } from "vitest";

import {
  DEFAULT_SETTINGS,
  settingsSnapshotSchema,
} from "@/lib/settings-schema";
import { createSettingsStore } from "@/server/services/settings";

describe("settings schema", () => {
  it("matches the documented defaults and approved stablecoin addresses", () => {
    expect(DEFAULT_SETTINGS.defaultChain).toBe("base");
    expect(DEFAULT_SETTINGS.maxTraceDepth).toBe(3);
    expect(DEFAULT_SETTINGS.profitSinkRatioPct).toBe(20);
    expect(DEFAULT_SETTINGS.alertThresholds.a1MinStableInflowUsd).toBe(1000);
    expect(DEFAULT_SETTINGS.alertThresholds.a2MinNativeInflowUsd).toBe(100);
    expect(DEFAULT_SETTINGS.alertThresholds.c3SelfOnly).toBe(false);
    expect(DEFAULT_SETTINGS.coEntryWindows).toEqual(["1h", "6h", "24h", "48h"]);
    expect(DEFAULT_SETTINGS.defaultCoEntryWindow).toBe("24h");
    expect(DEFAULT_SETTINGS.quota).toEqual({
      etherscanDailyLimit: 100_000,
      reservedForInteractivePct: 10,
    });
    expect(DEFAULT_SETTINGS.priceCacheTtlSeconds).toBe(60);
    expect(DEFAULT_SETTINGS.stableTokens.base).toEqual([
      { address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", symbol: "USDC" },
    ]);
    expect(DEFAULT_SETTINGS.stableTokens.bsc).toEqual([
      { address: "0x55d398326f99059ff775485246999027b3197955", symbol: "USDT" },
    ]);
    expect(DEFAULT_SETTINGS.stableTokens.robinhood).toEqual([
      { address: "0x5fc5360d0400a0fd4f2af552add042d716f1d168", symbol: "USDG" },
    ]);
  });

  it("rejects a trace depth above the hard cap", () => {
    const result = settingsSnapshotSchema.safeParse({
      ...DEFAULT_SETTINGS,
      maxTraceDepth: 7,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toContain("maxTraceDepth");
  });

  it("rejects a profit sink percentage outside 0..100", () => {
    const result = settingsSnapshotSchema.safeParse({
      ...DEFAULT_SETTINGS,
      profitSinkRatioPct: 101,
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown settings keys", () => {
    const result = settingsSnapshotSchema.safeParse({
      ...DEFAULT_SETTINGS,
      unknownSetting: true,
    });
    expect(result.success).toBe(false);
  });

  it("updates and reloads a patched value", async () => {
    const rows: Array<{ key: string; valueJson: unknown }> = [];
    const handlers: Array<(channel: string, message: string) => void> = [];
    const pubsub = {
      publish: async (channel: string, message: string) => {
        handlers.forEach((handler) => handler(channel, message));
        return handlers.length;
      },
      subscribe: async () => undefined,
      on: (_event: "message", handler: (channel: string, message: string) => void) => {
        handlers.push(handler);
      },
    };
    const setting = {
      findMany: async () => rows,
      upsert: async (args: { where: { key: string }; create: { key: string; valueJson: unknown }; update: { valueJson: unknown } }) => {
        const existing = rows.find((row) => row.key === args.where.key);
        if (existing) existing.valueJson = args.update.valueJson;
        else rows.push({ key: args.where.key, valueJson: args.create.valueJson });
      },
    };
    const store = createSettingsStore({ setting, publisher: pubsub, subscriber: pubsub });

    await store.updateSettings({ alertThresholds: { a1MinStableInflowUsd: 2500 } });
    expect((await store.loadSettings()).alertThresholds.a1MinStableInflowUsd).toBe(2500);
  });

  it("invalidates a second store when pub/sub publishes", async () => {
    const rows: Array<{ key: string; valueJson: unknown }> = [];
    const handlers: Array<(channel: string, message: string) => void> = [];
    const pubsub = {
      publish: async (channel: string, message: string) => {
        handlers.forEach((handler) => handler(channel, message));
        return handlers.length;
      },
      subscribe: async () => undefined,
      on: (_event: "message", handler: (channel: string, message: string) => void) => {
        handlers.push(handler);
      },
    };
    const setting = {
      findMany: async () => rows,
      upsert: async (args: { where: { key: string }; create: { key: string; valueJson: unknown }; update: { valueJson: unknown } }) => {
        const existing = rows.find((row) => row.key === args.where.key);
        if (existing) existing.valueJson = args.update.valueJson;
        else rows.push({ key: args.where.key, valueJson: args.create.valueJson });
      },
    };
    const first = createSettingsStore({ setting, publisher: pubsub, subscriber: pubsub });
    const second = createSettingsStore({ setting, publisher: pubsub, subscriber: pubsub });
    await second.loadSettings();
    await first.updateSettings({ radarCadenceMinutes: 9 });
    expect((await second.loadSettings()).radarCadenceMinutes).toBe(9);
  });
});
