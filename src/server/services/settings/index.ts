import Redis from "ioredis";

import { loadEnv } from "@/lib/env";
import {
  DEFAULT_SETTINGS,
  settingsSnapshotSchema,
  type DeepPartial,
  type SettingsSnapshot,
} from "@/lib/settings-schema";
import type { Prisma } from "@/generated/prisma/client";

const SETTINGS_CHANNEL = "watchtower:settings:invalidate";
const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as Array<keyof SettingsSnapshot>;

export type { SettingsSnapshot };

type SettingRow = { key: string; valueJson: unknown };
type SettingDelegate = {
  findMany: () => Promise<SettingRow[]>;
  upsert: (args: {
    where: { key: string };
    create: { key: string; valueJson: Prisma.InputJsonValue };
    update: { valueJson: Prisma.InputJsonValue };
  }) => Promise<unknown>;
};
type PubSub = {
  publish: (channel: string, message: string) => Promise<number>;
  subscribe: (channel: string) => Promise<unknown>;
  on: (event: "message", handler: (channel: string, message: string) => void) => unknown;
};
type SettingsStoreDependencies = {
  setting: SettingDelegate;
  publisher: PubSub;
  subscriber: PubSub;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function merge<T extends Record<string, unknown>>(
  base: T,
  patch: DeepPartial<T>,
): T {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined && isRecord(value) && isRecord(result[key])) {
      result[key] = merge(result[key] as Record<string, unknown>, value);
    } else if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function snapshotFromRows(rows: SettingRow[]): SettingsSnapshot {
  const values: Record<string, unknown> = {};
  for (const row of rows) {
    if (SETTING_KEYS.includes(row.key as keyof SettingsSnapshot)) {
      values[row.key] = row.valueJson;
    }
  }
  return settingsSnapshotSchema.parse(
    merge(DEFAULT_SETTINGS as unknown as Record<string, unknown>, values),
  );
}

export function createSettingsStore(deps: SettingsStoreDependencies) {
  let cached: SettingsSnapshot | undefined;
  let subscribed = false;

  const ensureSubscription = async (): Promise<void> => {
    if (subscribed) return;
    subscribed = true;
    deps.subscriber.on("message", (channel) => {
      if (channel === SETTINGS_CHANNEL) cached = undefined;
    });
    await deps.subscriber.subscribe(SETTINGS_CHANNEL);
  };

  return {
    async loadSettings(): Promise<SettingsSnapshot> {
      await ensureSubscription();
      if (cached) return clone(cached);
      cached = snapshotFromRows(await deps.setting.findMany());
      return clone(cached);
    },

    async updateSettings(
      patch: DeepPartial<SettingsSnapshot>,
    ): Promise<SettingsSnapshot> {
      await ensureSubscription();
      const current = await this.loadSettings();
      const next = settingsSnapshotSchema.parse(
        merge(
          current as unknown as Record<string, unknown>,
          patch as DeepPartial<Record<string, unknown>>,
        ),
      );
      for (const key of SETTING_KEYS) {
        await deps.setting.upsert({
          where: { key },
          create: {
            key,
            valueJson: clone(next[key]) as Prisma.InputJsonValue,
          },
          update: { valueJson: clone(next[key]) as Prisma.InputJsonValue },
        });
      }
      cached = next;
      await deps.publisher.publish(SETTINGS_CHANNEL, "updated");
      return clone(next);
    },
  };
}

let defaultStore: ReturnType<typeof createSettingsStore> | undefined;

async function getDefaultStore(): Promise<ReturnType<typeof createSettingsStore>> {
  if (defaultStore) return defaultStore;
  const env = loadEnv();
  const { prisma } = await import("@/server/db/client");
  const publisher = new Redis(env.REDIS_URL);
  const subscriber = new Redis(env.REDIS_URL);
  defaultStore = createSettingsStore({
    setting: prisma.setting,
    publisher,
    subscriber,
  });
  return defaultStore;
}

export function loadSettings(): Promise<SettingsSnapshot> {
  return getDefaultStore().then((store) => store.loadSettings());
}

export function updateSettings(
  patch: DeepPartial<SettingsSnapshot>,
): Promise<SettingsSnapshot> {
  return getDefaultStore().then((store) => store.updateSettings(patch));
}
