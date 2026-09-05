import {
  DEFAULT_SETTINGS,
  type SettingsSnapshot,
} from "../../src/lib/settings-schema";

/** Bundled settings used by the settings service and the idempotent seed. */
export const DEFAULT_SETTING_VALUES: SettingsSnapshot = DEFAULT_SETTINGS;

export const DEFAULT_SETTING_ENTRIES = Object.entries(
  DEFAULT_SETTING_VALUES,
) as Array<[keyof SettingsSnapshot, SettingsSnapshot[keyof SettingsSnapshot]]>;
