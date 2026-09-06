"use client";

import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  type AlertThresholds,
  type GradedDefinition,
  type SettingsSnapshot,
} from "@/lib/settings-schema";
import { ThresholdForm } from "@/components/settings/ThresholdForm";
import { CadenceForm } from "@/components/settings/CadenceForm";
import { TelegramForm } from "@/components/settings/TelegramForm";
import { StableListEditor, type StableTokensConfig } from "@/components/settings/StableListEditor";
import { MaintenancePanel } from "@/components/settings/MaintenancePanel";

export default function SettingsPage() {
  const utils = trpc.useUtils();
  const settingsQuery = trpc.settings.get.useQuery();

  const initialData = settingsQuery.data;

  // Local draft state
  const [draftThresholds, setDraftThresholds] = useState<AlertThresholds | null>(
    () => initialData?.alertThresholds ?? null
  );
  const [draftGradedDef, setDraftGradedDef] = useState<GradedDefinition>(
    () => initialData?.gradedDefinition ?? "ANY_TAG_OR_COMPUTED"
  );
  const [draftStableTokens, setDraftStableTokens] = useState<StableTokensConfig | null>(
    () => initialData?.stableTokens ?? null
  );
  const [draftCadence, setDraftCadence] = useState<{
    radarCadenceMinutes: number;
    syncCadenceMinutes: number;
    quota: { etherscanDailyLimit: number; reservedForInteractivePct: number };
    minEdgeUsd: number;
    maxTraceDepth: number;
    profitSinkRatioPct: number;
  } | null>(() =>
    initialData
      ? {
          radarCadenceMinutes: initialData.radarCadenceMinutes,
          syncCadenceMinutes: initialData.syncCadenceMinutes,
          quota: initialData.quota,
          minEdgeUsd: initialData.minEdgeUsd,
          maxTraceDepth: initialData.maxTraceDepth,
          profitSinkRatioPct: initialData.profitSinkRatioPct,
        }
      : null
  );
  const [draftTelegram, setDraftTelegram] = useState<{
    enabled: boolean;
    hasCredentials: boolean;
  }>(() => initialData?.telegram ?? { enabled: false, hasCredentials: false });

  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"IDLE" | "SAVED" | "ERROR">("IDLE");
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  // Initialize draft from fetched settings
  useEffect(() => {
    if (settingsQuery.data) {
      const data: SettingsSnapshot = settingsQuery.data;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraftThresholds(data.alertThresholds);
      setDraftGradedDef(data.gradedDefinition);
      setDraftStableTokens(data.stableTokens);
      setDraftCadence({
        radarCadenceMinutes: data.radarCadenceMinutes,
        syncCadenceMinutes: data.syncCadenceMinutes,
        quota: data.quota,
        minEdgeUsd: data.minEdgeUsd,
        maxTraceDepth: data.maxTraceDepth,
        profitSinkRatioPct: data.profitSinkRatioPct,
      });
      setDraftTelegram(data.telegram);
      setHasChanges(false);
    }
  }, [settingsQuery.data]);

  const updateMutation = trpc.settings.update.useMutation({
    onSuccess: () => {
      setSaveStatus("SAVED");
      setHasChanges(false);
      utils.settings.get.invalidate();
      setTimeout(() => setSaveStatus("IDLE"), 4000);
    },
    onError: (err) => {
      setSaveStatus("ERROR");
      setSaveErrorMessage(err.message || "Failed to update configuration.");
    },
  });

  const handleSave = () => {
    if (!draftThresholds || !draftStableTokens || !draftCadence) return;

    setSaveStatus("IDLE");
    setSaveErrorMessage(null);

    updateMutation.mutate({
      alertThresholds: draftThresholds,
      gradedDefinition: draftGradedDef,
      stableTokens: draftStableTokens,
      radarCadenceMinutes: draftCadence.radarCadenceMinutes,
      syncCadenceMinutes: draftCadence.syncCadenceMinutes,
      quota: draftCadence.quota,
      minEdgeUsd: draftCadence.minEdgeUsd,
      maxTraceDepth: draftCadence.maxTraceDepth,
      profitSinkRatioPct: draftCadence.profitSinkRatioPct,
      telegram: {
        enabled: draftTelegram.enabled,
      },
    });
  };

  const handleThresholdsChange = (patch: Partial<AlertThresholds>) => {
    if (!draftThresholds) return;
    setDraftThresholds({ ...draftThresholds, ...patch });
    setHasChanges(true);
    setSaveStatus("IDLE");
  };

  const handleGradedDefChange = (val: GradedDefinition) => {
    setDraftGradedDef(val);
    setHasChanges(true);
    setSaveStatus("IDLE");
  };

  const handleStableTokensChange = (updated: StableTokensConfig) => {
    setDraftStableTokens(updated);
    setHasChanges(true);
    setSaveStatus("IDLE");
  };

  const handleCadenceChange = (patch: {
    radarCadenceMinutes?: number;
    syncCadenceMinutes?: number;
    quota?: { etherscanDailyLimit?: number; reservedForInteractivePct?: number };
    minEdgeUsd?: number;
    maxTraceDepth?: number;
    profitSinkRatioPct?: number;
  }) => {
    if (!draftCadence) return;
    setDraftCadence({
      ...draftCadence,
      ...patch,
      quota: patch.quota
        ? {
            etherscanDailyLimit:
              patch.quota.etherscanDailyLimit ?? draftCadence.quota.etherscanDailyLimit,
            reservedForInteractivePct:
              patch.quota.reservedForInteractivePct ??
              draftCadence.quota.reservedForInteractivePct,
          }
        : draftCadence.quota,
    });
    setHasChanges(true);
    setSaveStatus("IDLE");
  };

  const handleTelegramToggle = (enabled: boolean) => {
    setDraftTelegram((prev) => ({ ...prev, enabled }));
    setHasChanges(true);
    setSaveStatus("IDLE");
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#101214] text-[#E8ECEF]">
      {/* Top App Bar (Docked Sticky Header) */}
      <header className="sticky top-0 z-40 flex items-center justify-between h-16 px-4 md:px-6 bg-[#121416] border-b border-[#30373D]">
        {/* Brand/Breadcrumb */}
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-[#D7A84B]">
            settings
          </span>
          <span className="font-sans font-bold text-[14px] md:text-[16px] uppercase tracking-wider text-[#E8ECEF]">
            Watchtower / Settings
          </span>
        </div>

        {/* Trailing Actions & Status */}
        <div className="flex items-center gap-4">
          {/* Status Indicator */}
          <div className="hidden sm:flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider">
            {updateMutation.isPending ? (
              <span className="text-[#D7A84B] flex items-center gap-1.5 animate-pulse">
                <span>●</span> SAVING CONFIGURATION...
              </span>
            ) : saveStatus === "SAVED" ? (
              <span className="text-[#79B79A] flex items-center gap-1.5">
                <span>●</span> SETTINGS SAVED TO LOCAL DB
              </span>
            ) : saveStatus === "ERROR" ? (
              <span className="text-[#D87870] flex items-center gap-1.5">
                <span>⚠️</span> SAVE FAILED
              </span>
            ) : hasChanges ? (
              <span className="text-[#D7A84B] flex items-center gap-1.5">
                <span>▲</span> UNSAVED CHANGES PENDING
              </span>
            ) : (
              <span className="text-[#79B79A] flex items-center gap-1.5">
                <span>●</span> SETTINGS LOADED FROM LOCAL DB
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 border-l border-[#30373D] pl-4">
            <button
              type="button"
              disabled={updateMutation.isPending || (!hasChanges && saveStatus !== "ERROR")}
              onClick={handleSave}
              className="h-[38px] px-5 bg-[#D7A84B] hover:bg-[#f5c363] active:translate-y-[-1px] text-[#101214] font-sans font-bold text-[12px] uppercase tracking-wider transition-all flex items-center gap-2 rounded-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[16px]">save</span>
              <span>{updateMutation.isPending ? "Saving..." : "Save Configuration"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="flex-1 p-4 md:p-6 flex flex-col gap-8 max-w-[1440px] w-full mx-auto">
        {/* Error Notification if save failed */}
        {saveErrorMessage && (
          <div
            className="p-3 bg-[#D87870]/10 border border-[#D87870] text-[#D87870] font-mono text-[12px] flex items-center justify-between"
            role="alert"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>Error persisting changes: {saveErrorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSaveErrorMessage(null)}
              className="text-[#D87870] hover:text-[#E8ECEF] font-bold px-2 py-0.5"
            >
              ✕
            </button>
          </div>
        )}

        {/* Loading State */}
        {settingsQuery.isLoading && (
          <div className="p-12 text-center border border-[#30373D] bg-[#171A1D] flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-[#D7A84B] border-t-transparent animate-spin" />
            <div className="font-mono text-[12px] text-[#929BA3] uppercase tracking-wider">
              Loading Settings Snapshot from Database...
            </div>
          </div>
        )}

        {/* Failed to Load State */}
        {settingsQuery.isError && (
          <div className="p-6 bg-[#D87870]/10 border border-[#D87870] text-[#D87870] flex flex-col gap-3">
            <div className="font-bold text-[14px]">Failed to load settings snapshot</div>
            <p className="font-mono text-[12px]">{settingsQuery.error.message}</p>
            <button
              type="button"
              onClick={() => settingsQuery.refetch()}
              className="self-start px-4 py-2 bg-[#D87870] text-[#101214] font-bold text-[11px] uppercase tracking-wider rounded-none"
            >
              Retry
            </button>
          </div>
        )}

        {/* Content sections once loaded */}
        {draftThresholds && draftCadence && draftStableTokens && (
          <>
            {/* SECTION 1: Alert Thresholds & Rules (A1–C4) */}
            <ThresholdForm
              thresholds={draftThresholds}
              gradedDefinition={draftGradedDef}
              onChangeThresholds={handleThresholdsChange}
              onChangeGradedDefinition={handleGradedDefChange}
              disabled={updateMutation.isPending}
            />

            {/* Bottom Row: Cadence & System + Telegram Webhook */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* SECTION 2: Cadence & System */}
              <CadenceForm
                settings={draftCadence}
                onChange={handleCadenceChange}
                disabled={updateMutation.isPending}
              />

              {/* SECTION 3: Telegram Webhook */}
              <TelegramForm
                enabled={draftTelegram.enabled}
                hasCredentials={draftTelegram.hasCredentials}
                onToggleEnabled={handleTelegramToggle}
                disabled={updateMutation.isPending}
              />
            </div>

            {/* SECTION 4: Configured Stablecoins per Chain */}
            <StableListEditor
              stableTokens={draftStableTokens}
              onChange={handleStableTokensChange}
              disabled={updateMutation.isPending}
            />

            {/* SECTION 5: Maintenance & Data Retention */}
            <MaintenancePanel />
          </>
        )}
      </main>
    </div>
  );
}
