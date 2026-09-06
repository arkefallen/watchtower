import { describe, expect, it } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { ThresholdForm } from "@/components/settings/ThresholdForm";
import { CadenceForm } from "@/components/settings/CadenceForm";
import { TelegramForm } from "@/components/settings/TelegramForm";
import { StableListEditor } from "@/components/settings/StableListEditor";
import { MaintenancePanel } from "@/components/settings/MaintenancePanel";
import SettingsPage from "@/app/settings/page";
import { DEFAULT_SETTINGS } from "@/lib/settings-schema";
import { vi } from "vitest";

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    useUtils: () => ({
      settings: {
        get: { invalidate: vi.fn() },
        backupStatus: { invalidate: vi.fn() },
      },
      maintenance: {
        backupInfo: { invalidate: vi.fn() },
      },
      graph: {
        invalidate: vi.fn(),
      },
    }),
    maintenance: {
      backupInfo: {
        useQuery: () => ({
          data: {
            newestBackupAt: "2026-09-04T00:00:00.000Z",
            daysOld: 2,
            isStale: false,
            backupCount: 5,
            command: "pnpm run backup",
          },
          isLoading: false,
        }),
      },
      quotaReport: {
        useQuery: () => ({
          data: {
            checkedAt: "2026-09-06T00:00:00.000Z",
            providers: [],
          },
          isLoading: false,
        }),
      },
      pruneToken: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      rebuildDerivations: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
    settings: {
      get: {
        useQuery: () => ({ data: DEFAULT_SETTINGS, isLoading: false }),
      },
      update: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      testTelegram: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      runBackup: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      backupStatus: {
        useQuery: () => ({
          data: {
            lastBackupAt: "2026-09-04T00:00:00.000Z",
            daysAgo: 2,
            isHealthy: true,
            totalBackups: 5,
          },
          isLoading: false,
        }),
      },
      pruneTokenHistory: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
  },
}));

describe("settings UI components", () => {
  it("settings-ui: every documented setting has a control in ThresholdForm", () => {
    const html = renderToString(
      React.createElement(ThresholdForm, {
        thresholds: DEFAULT_SETTINGS.alertThresholds,
        gradedDefinition: DEFAULT_SETTINGS.gradedDefinition,
        onChangeThresholds: () => undefined,
        onChangeGradedDefinition: () => undefined,
      })
    );

    // Rule headings
    expect(html).toContain("A1: Stablecoin Arming");
    expect(html).toContain("A2: Gas Arming");
    expect(html).toContain("A3: CEX Withdrawal");
    expect(html).toContain("A4: Dormancy Wake");
    expect(html).toContain("A5: Cluster Arming");
    expect(html).toContain("A6: Sweeper Arming");
    expect(html).toContain("T1: Armed Entry");
    expect(html).toContain("T2: Independent Co-Entry");
    expect(html).toContain("T3: Fresh-Launch");
    expect(html).toContain("T4: Add-On-Retrace");
    expect(html).toContain("T5: Cluster Co-Entry");
    expect(html).toContain("C1: Distribution Prep");
    expect(html).toContain("C2: Co-Distribution");
    expect(html).toContain("C3: Moon Discipline");
    expect(html).toContain("C4: Campaign Spent");
    expect(html).toContain("System De-Arm");

    // Decision D-4 cold-start helper
    expect(html).toContain(
      "Cold-start rule: floor-only ($100) binds until wallet has ≥ 7 qualifying daily flow days."
    );

    // Decision D-5 Graded Definition options
    expect(html).toContain("ANY_TAG_OR_COMPUTED");
    expect(html).toContain("EDGE_TAG_ONLY");

    // Decision D-7 c3SelfOnly toggle helper
    expect(html).toContain(
      "When false, monitors all tracked wallets with prominent styling on isSelf trades; when true, restricts to self-registered positions only."
    );
  });

  it("settings-ui: A2 floor defaults to $100 and median multiple to 3x", () => {
    const html = renderToString(
      React.createElement(ThresholdForm, {
        thresholds: DEFAULT_SETTINGS.alertThresholds,
        gradedDefinition: DEFAULT_SETTINGS.gradedDefinition,
        onChangeThresholds: () => undefined,
        onChangeGradedDefinition: () => undefined,
      })
    );

    expect(DEFAULT_SETTINGS.alertThresholds.a2MinNativeInflowUsd).toBe(100);
    expect(DEFAULT_SETTINGS.alertThresholds.a2MedianMultiple).toBe(3);
    expect(html).toContain('value="100"');
    expect(html).toContain('value="3"');
  });

  it("settings-ui: graded definition defaults to ANY_TAG_OR_COMPUTED", () => {
    expect(DEFAULT_SETTINGS.gradedDefinition).toBe("ANY_TAG_OR_COMPUTED");
    const html = renderToString(
      React.createElement(ThresholdForm, {
        thresholds: DEFAULT_SETTINGS.alertThresholds,
        gradedDefinition: DEFAULT_SETTINGS.gradedDefinition,
        onChangeThresholds: () => undefined,
        onChangeGradedDefinition: () => undefined,
      })
    );
    expect(html).toContain('<option value="ANY_TAG_OR_COMPUTED" selected=""');
  });

  it("settings-ui: c3SelfOnly defaults false", () => {
    expect(DEFAULT_SETTINGS.alertThresholds.c3SelfOnly).toBe(false);
    const html = renderToString(
      React.createElement(ThresholdForm, {
        thresholds: DEFAULT_SETTINGS.alertThresholds,
        gradedDefinition: DEFAULT_SETTINGS.gradedDefinition,
        onChangeThresholds: () => undefined,
        onChangeGradedDefinition: () => undefined,
      })
    );
    // The checkbox should NOT have checked attribute
    expect(html).not.toMatch(/id="c3-self-only"[^>]*checked/);
  });

  it("settings-ui: CadenceForm renders radar cadence (5m), quota reserve (10%), and maxTraceDepth capped at 6", () => {
    const html = renderToString(
      React.createElement(CadenceForm, {
        settings: {
          radarCadenceMinutes: DEFAULT_SETTINGS.radarCadenceMinutes,
          syncCadenceMinutes: DEFAULT_SETTINGS.syncCadenceMinutes,
          quota: DEFAULT_SETTINGS.quota,
          minEdgeUsd: DEFAULT_SETTINGS.minEdgeUsd,
          maxTraceDepth: DEFAULT_SETTINGS.maxTraceDepth,
          profitSinkRatioPct: DEFAULT_SETTINGS.profitSinkRatioPct,
        },
        onChange: () => undefined,
      })
    );

    expect(html).toContain("Radar Sweep Cadence");
    expect(html).toContain('value="5"');
    expect(html).toContain("RPC Quota Reserve");
    expect(html).toContain('value="10"');
    expect(html).toContain("Max Trace Depth");
    expect(html).toContain('value="3"');
    expect(html).toContain("Capped at 6");
  });

  it("settings-ui: StableListEditor renders configured tokens for Base, BSC, and Robinhood", () => {
    const html = renderToString(
      React.createElement(StableListEditor, {
        stableTokens: DEFAULT_SETTINGS.stableTokens,
        onChange: () => undefined,
      })
    );

    expect(html).toContain("Configured Stablecoins");
    expect(html).toContain("Base");
    expect(html).toContain("BNB Smart Chain (BSC)");
    expect(html).toContain("Robinhood Chain");
    expect(html).toContain("USDC");
    expect(html).toContain("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
  });

  it("settings-ui: TelegramForm renders webhook toggle, token input, and test action", () => {
    const html = renderToString(
      React.createElement(TelegramForm, {
        enabled: false,
        hasCredentials: false,
        onToggleEnabled: () => undefined,
      })
    );

    expect(html).toContain("Telegram Notifications");
    expect(html).toContain("Disabled");
    expect(html).toContain("Bot Token");
    expect(html).toContain("Target Chat ID");
    expect(html).toContain("Send Test Message");
  });

  it("settings-ui: MaintenancePanel renders backup staleness banner and prune action", () => {
    const html = renderToString(React.createElement(MaintenancePanel));

    expect(html).toContain("Maintenance &amp; Data");
    expect(html).toContain("BACKUP HEALTHY");
    expect(html).toContain("Run Manual Backup");
    expect(html).toContain("Prune Token History");
  });

  it("settings-ui: SettingsPage composes full layout with header and Save button", () => {
    const html = renderToString(React.createElement(SettingsPage));

    expect(html).toContain("Watchtower / Settings");
    expect(html).toContain("Save Configuration");
    expect(html).toContain("SETTINGS LOADED FROM LOCAL DB");
    expect(html).toContain("Alert Thresholds &amp; Rules");
    expect(html).toContain("Cadence &amp; System");
    expect(html).toContain("Telegram Notifications");
    expect(html).toContain("Configured Stablecoins");
    expect(html).toContain("Maintenance &amp; Data");
  });
});
