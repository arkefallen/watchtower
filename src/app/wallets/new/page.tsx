"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { parseImportBatch, type ParseImportBatchResult } from "@/server/services/wallet/import";

export const INTAKE_STAGES_LIST = [
  "resolve:ens",
  "fetch:normal",
  "fetch:internal",
  "fetch:erc20",
  "persist:tx",
  "price:events",
  "profile:stats",
  "funding:trace",
  "cluster:detect",
  "derive:movements",
  "derive:positions",
  "derive:relations",
  "alert:backfill",
  "done",
] as const;

export default function WalletIntakePage() {
  // Left Column State: Single Intake
  const [singleInput, setSingleInput] = useState("vitalik.eth");
  const [singleChain, setSingleChain] = useState<"base" | "bsc" | "robinhood">("base");
  const [singleLabel, setSingleLabel] = useState("");
  const [singlePriority, setSinglePriority] = useState<"HIGH" | "NORMAL">("HIGH");
  const [singleIsSelf, setSingleIsSelf] = useState(false);
  const [singleSuccessMsg, setSingleSuccessMsg] = useState<string | null>(null);

  // Right Column State: Batch CSV Import
  const [batchRawText, setBatchRawText] = useState(
    "0x71c7656ec7ab88b098defb751b7401b5f6d8976f,base,Fund_A\n0x89205a3a3b2a69de6d1238997a31f24d2777492c,base,Fund_B\n0xbad_invalid_address,base,Malformed\n0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc,base,Fund_C"
  );
  const [batchSuccessMsg, setBatchSuccessMsg] = useState<string | null>(null);

  // Active Job Drawer State
  const [activeJob, setActiveJob] = useState<{
    id: string;
    stageIndex: number;
    stageName: string;
    progress: number;
    completed: boolean;
  } | null>(null);

  // Live ENS Resolution
  const resolveEnsMutation = trpc.wallet.resolveEns.useMutation();

  // Debounced ENS check when singleInput changes
  useEffect(() => {
    const trimmed = singleInput.trim();
    if (!trimmed) return;
    const timer = setTimeout(() => {
      resolveEnsMutation.mutate({ nameOrAddress: trimmed });
    }, 400);
    return () => clearTimeout(timer);
  }, [singleInput]);

  // Mutations
  const utils = trpc.useUtils();
  const addSingleMutation = trpc.wallet.add.useMutation({
    onSuccess: (data) => {
      setSingleSuccessMsg(`Successfully registered wallet ${data.address}`);
      utils.wallet.list.invalidate();
      // Trigger live intake progress drawer simulation/monitor
      const uniqueSuffix = data.address.slice(-6);
      startSimulatedPipeline(`intake-${uniqueSuffix}`);
    },
  });

  const addBatchMutation = trpc.wallet.addBatch.useMutation({
    onSuccess: (res) => {
      setBatchSuccessMsg(`Batch started: ${res.accepted} accepted, ${res.existing} existing, ${res.duplicates} duplicates.`);
      utils.wallet.list.invalidate();
      startSimulatedPipeline(res.batchId);
    },
  });

  // Simulated 14-stage intake pipeline progress ticker when a job begins
  const startSimulatedPipeline = (jobId: string) => {
    setActiveJob({
      id: jobId,
      stageIndex: 0,
      stageName: INTAKE_STAGES_LIST[0],
      progress: 7,
      completed: false,
    });
  };

  useEffect(() => {
    if (!activeJob || activeJob.completed) return;
    const interval = setInterval(() => {
      setActiveJob((prev) => {
        if (!prev) return null;
        if (prev.stageIndex >= INTAKE_STAGES_LIST.length - 1) {
          return { ...prev, progress: 100, completed: true, stageName: "done" };
        }
        const nextIndex = prev.stageIndex + 1;
        const nextProgress = Math.round(((nextIndex + 1) / INTAKE_STAGES_LIST.length) * 100);
        return {
          ...prev,
          stageIndex: nextIndex,
          stageName: INTAKE_STAGES_LIST[nextIndex],
          progress: nextProgress,
        };
      });
    }, 1500);
    return () => clearInterval(interval);
  }, [activeJob?.completed, activeJob?.id]);

  // Client-side validation of CSV text
  const batchValidation: ParseImportBatchResult = useMemo(() => {
    return parseImportBatch(batchRawText, "base");
  }, [batchRawText]);

  // Submit Single
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSingleSuccessMsg(null);
    await addSingleMutation.mutateAsync({
      address: singleInput.trim(),
      chain: singleChain,
      label: singleLabel.trim() || undefined,
      watchPriority: singlePriority,
      isSelf: singleIsSelf,
      forceFullResync: false,
    });
  };

  // Submit Batch
  const handleBatchSubmit = async () => {
    setBatchSuccessMsg(null);
    await addBatchMutation.mutateAsync({
      rawText: batchRawText,
      defaultChain: "base",
    });
  };

  return (
    <main className="min-h-screen bg-[#101214] text-[#E8ECEF] flex flex-col p-6 max-w-[1440px] mx-auto w-full gap-4">
      {/* Top Breadcrumb & Back */}
      <div className="flex items-center justify-between border-b border-[#30373D] pb-3">
        <div className="flex items-center gap-2 font-mono text-[12px] text-[#929BA3] uppercase tracking-wider">
          <span>WATCHTOWER</span>
          <span className="text-[#30373D]">/</span>
          <Link href="/wallets" className="hover:text-[#E8ECEF]">
            WALLETS
          </Link>
          <span className="text-[#30373D]">/</span>
          <span className="text-[#D7A84B]">INTAKE</span>
        </div>
        <Link
          href="/wallets"
          className="h-8 px-3 border border-[#30373D] bg-[#171A1D] text-[#E8ECEF] font-sans text-[12px] uppercase font-semibold hover:border-[#D7A84B] transition-colors flex items-center gap-2 rounded-none"
        >
          ← Back to Wallets
        </Link>
      </div>

      {/* Page Title */}
      <div>
        <h1 className="font-sans text-[32px] font-bold text-[#E8ECEF] uppercase tracking-tight">
          WALLET INTAKE
        </h1>
        <p className="font-sans text-[14px] text-[#929BA3] mt-1">
          Register individual wallets with live ENS resolution or batch import via CSV format
        </p>
      </div>

      {/* Two Column Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 border border-[#30373D] bg-[#171A1D] min-h-[600px]">
        {/* Left Column: Single Address Intake (Approx 45% -> 5 cols) */}
        <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-[#30373D] p-6 flex flex-col">
          <h2 className="font-sans text-[20px] font-semibold text-[#E8ECEF] uppercase tracking-tight mb-4">
            Single Address Intake
          </h2>

          <form onSubmit={handleSingleSubmit} className="space-y-4 flex-1 flex flex-col">
            {singleSuccessMsg && (
              <div className="p-3 bg-[#79B79A]/20 border border-[#79B79A] text-[#79B79A] font-mono text-[12px] flex items-center justify-between">
                <span>{singleSuccessMsg}</span>
                <Link
                  href={`/wallets/${singleChain}/${singleInput.trim()}`}
                  className="px-2 py-1 bg-[#79B79A] text-[#101214] font-bold text-[11px] uppercase tracking-wider font-['Geist'] hover:brightness-110"
                >
                  View Profile →
                </Link>
              </div>
            )}
            {addSingleMutation.isError && (
              <div className="p-3 bg-[#93000a]/20 border border-[#D87870] text-[#D87870] font-mono text-[12px]">
                {addSingleMutation.error.message}
              </div>
            )}

            {/* Address / ENS Input */}
            <div>
              <label className="block font-sans font-semibold text-[12px] text-[#E8ECEF] mb-1.5 uppercase">
                Address / ENS
              </label>
              <input
                type="text"
                value={singleInput}
                onChange={(e) => setSingleInput(e.target.value)}
                placeholder="0x... or vitalik.eth"
                required
                className="w-full h-10 bg-[#101214] border border-[#30373D] px-3 font-mono text-[13px] text-[#E8ECEF] focus:outline-none focus:border-[#D7A84B] rounded-none"
              />

              {/* Live ENS Resolution Badge */}
              {resolveEnsMutation.isPending && (
                <p className="mt-2 font-mono text-[11px] text-[#D7A84B] flex items-center gap-1">
                  <span className="animate-spin">↻</span> Resolving name via Universal Resolver...
                </p>
              )}

              {resolveEnsMutation.data && (
                <div className="mt-2 font-mono text-[11px] text-[#79B79A] bg-[#79B79A]/10 border border-[#79B79A]/30 p-2">
                  <div className="flex items-center gap-1 font-bold">
                    <span>✓</span> Resolved to {resolveEnsMutation.data.address}
                  </div>
                  {resolveEnsMutation.data.ensName && (
                    <div className="text-[#929BA3] mt-0.5">
                      ENS Primary: {resolveEnsMutation.data.ensName}
                    </div>
                  )}
                </div>
              )}

              {resolveEnsMutation.isError && (
                <p className="mt-2 font-mono text-[11px] text-[#D87870]">
                  Could not resolve: {resolveEnsMutation.error.message}
                </p>
              )}
            </div>

            {/* Chain Selector */}
            <div>
              <label className="block font-sans font-semibold text-[12px] text-[#E8ECEF] mb-1.5 uppercase">
                Target Chain
              </label>
              <select
                value={singleChain}
                onChange={(e) => setSingleChain(e.target.value as any)}
                className="w-full h-10 bg-[#101214] border border-[#30373D] px-3 font-mono text-[13px] text-[#E8ECEF] focus:outline-none focus:border-[#D7A84B] rounded-none uppercase"
              >
                <option value="base">Base (Chain 8453)</option>
                <option value="bsc">BSC (Chain 56)</option>
                <option value="robinhood">Robinhood</option>
              </select>
            </div>

            {/* Internal Label */}
            <div>
              <label className="block font-sans font-semibold text-[12px] text-[#E8ECEF] mb-1.5 uppercase">
                Internal Label
              </label>
              <input
                type="text"
                value={singleLabel}
                onChange={(e) => setSingleLabel(e.target.value)}
                placeholder="e.g. Vitalik Primary, Alpha 01"
                className="w-full h-10 bg-[#101214] border border-[#30373D] px-3 font-sans text-[13px] text-[#E8ECEF] focus:outline-none focus:border-[#D7A84B] rounded-none"
              />
            </div>

            {/* Priority & IsSelf Flags */}
            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={singlePriority === "HIGH"}
                  onChange={(e) => setSinglePriority(e.target.checked ? "HIGH" : "NORMAL")}
                  className="w-4 h-4 rounded-none bg-[#101214] border-[#30373D] text-[#D7A84B] focus:ring-0"
                />
                <span className="font-sans font-semibold text-[12px] text-[#E8ECEF] uppercase">
                  High Watch Priority
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={singleIsSelf}
                  onChange={(e) => setSingleIsSelf(e.target.checked)}
                  className="w-4 h-4 rounded-none bg-[#101214] border-[#30373D] text-[#D7A84B] focus:ring-0"
                />
                <span className="font-sans font-semibold text-[12px] text-[#929BA3] uppercase">
                  Is Self (My Wallet)
                </span>
              </label>
            </div>

            {/* Action Button */}
            <div className="mt-auto pt-6">
              <button
                type="submit"
                disabled={addSingleMutation.isPending}
                className="w-full h-10 bg-[#D7A84B] text-[#101214] font-sans text-[12px] uppercase tracking-widest font-bold hover:brightness-110 active:translate-y-[1px] transition-all rounded-none disabled:opacity-50"
              >
                {addSingleMutation.isPending ? "Submitting..." : "Add Wallet & Start Ingestion"}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Batch Import (Approx 55% -> 7 cols) */}
        <div className="lg:col-span-7 p-6 flex flex-col bg-[#121416]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-sans text-[20px] font-semibold text-[#E8ECEF] uppercase tracking-tight">
              Batch Import (CSV / Raw)
            </h2>
            <span className="font-mono text-[11px] text-[#929BA3] bg-[#1E2327] px-2 py-1 border border-[#30373D]">
              FORMAT: address,chain,label
            </span>
          </div>

          {batchSuccessMsg && (
            <div className="p-3 mb-3 bg-[#79B79A]/20 border border-[#79B79A] text-[#79B79A] font-mono text-[12px]">
              {batchSuccessMsg}
            </div>
          )}

          {/* Textarea with Validation Overlay */}
          <div className="flex-1 flex flex-col relative mb-4">
            <textarea
              value={batchRawText}
              onChange={(e) => setBatchRawText(e.target.value)}
              spellCheck={false}
              rows={12}
              placeholder="0xaddress,base,Label&#10;0xaddress2,bsc,Label2"
              className="w-full flex-1 min-h-[260px] bg-[#0c0e10] border border-[#30373D] p-4 font-mono text-[13px] text-[#E8ECEF] focus:outline-none focus:border-[#D7A84B] resize-none leading-relaxed rounded-none"
            />

            {/* Line Validation Error Callout */}
            {batchValidation.invalid.length > 0 && (
              <div className="mt-2 bg-[#1E2327] border border-[#D87870] p-3 shadow-lg">
                <div className="flex items-start gap-2">
                  <span className="text-[#D87870] font-bold text-[16px]">⚠</span>
                  <div>
                    <p className="font-sans font-semibold text-[12px] text-[#D87870] uppercase mb-1">
                      Validation Issues Found ({batchValidation.invalid.length} invalid line
                      {batchValidation.invalid.length > 1 ? "s" : ""})
                    </p>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {batchValidation.invalid.map((inv, i) => (
                        <p key={i} className="font-mono text-[11px] text-[#E8ECEF]">
                          Line {inv.lineNumber}: {inv.reason} — <span className="text-[#929BA3]">will be skipped</span>
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Stats Summary & Action */}
          <div className="flex flex-wrap items-center justify-between pt-3 border-t border-[#30373D] gap-3">
            <div className="flex gap-4 font-mono text-[12px]">
              <span className="text-[#79B79A] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-none bg-[#79B79A] block" />
                {batchValidation.acceptedCount} Valid
              </span>
              <span className="text-[#D7A84B] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-none bg-[#D7A84B] block" />
                {batchValidation.duplicates.length} Duplicates
              </span>
              <span className="text-[#D87870] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-none bg-[#D87870] block" />
                {batchValidation.invalid.length} Invalid
              </span>
            </div>

            <button
              type="button"
              disabled={addBatchMutation.isPending || batchValidation.acceptedCount === 0}
              onClick={handleBatchSubmit}
              className="h-10 px-6 border border-[#30373D] bg-[#171A1D] text-[#E8ECEF] font-sans text-[12px] uppercase tracking-widest font-bold hover:border-[#D7A84B] hover:text-[#D7A84B] active:translate-y-[1px] transition-all rounded-none disabled:opacity-50 cursor-pointer"
            >
              {addBatchMutation.isPending
                ? "Submitting..."
                : `Start Batch Intake (${batchValidation.acceptedCount} Wallets)`}
            </button>
          </div>
        </div>
      </div>

      {/* Docked BullMQ 14-Stage Intake Pipeline Monitor (JobProgress) */}
      {activeJob && (
        <aside
          aria-label="Intake pipeline drawer"
          className="fixed bottom-6 right-6 w-[420px] bg-[#171A1D] border border-[#30373D] border-t-2 border-t-[#D7A84B] shadow-2xl z-50 flex flex-col"
        >
          {/* Header */}
          <div className="p-3 border-b border-[#30373D] flex justify-between items-center bg-[#1E2327]">
            <h3 className="font-sans font-semibold text-[12px] text-[#E8ECEF] uppercase tracking-wider">
              BATCH INTAKE PROGRESS
            </h3>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-[#929BA3] bg-[#101214] border border-[#30373D] px-2 py-0.5">
                Job #{activeJob.id}
              </span>
              <button
                type="button"
                onClick={() => setActiveJob(null)}
                className="text-[#929BA3] hover:text-[#E8ECEF] font-mono text-[12px]"
                title="Close monitor"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 space-y-4">
            {/* Live Status and Progress Bar */}
            <div>
              <div className="flex justify-between items-center mb-1 font-mono text-[12px]">
                <span className="text-[#929BA3]">
                  Stage {activeJob.stageIndex + 1}/14: {activeJob.stageName}
                </span>
                <span className="text-[#D7A84B] font-bold">
                  [● {activeJob.completed ? "DONE 100%" : `RUNNING ${activeJob.progress}%`}]
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#101214] border border-[#30373D] overflow-hidden">
                <div
                  className="h-full bg-[#D7A84B] transition-all duration-500 ease-out"
                  style={{ width: `${activeJob.progress}%` }}
                />
              </div>
            </div>

            {/* Stages Step List */}
            <div className="h-36 overflow-y-auto pr-2 space-y-1.5 border border-[#30373D] bg-[#0c0e10] p-2 font-mono text-[11px]">
              {INTAKE_STAGES_LIST.map((stageName, idx) => {
                const isPassed = idx < activeJob.stageIndex || activeJob.completed;
                const isCurrent = idx === activeJob.stageIndex && !activeJob.completed;

                if (isPassed) {
                  return (
                    <div key={stageName} className="flex items-center gap-2 text-[#79B79A]">
                      <span>✓</span>
                      <span>
                        Stage {idx + 1}: {stageName}
                      </span>
                    </div>
                  );
                }

                if (isCurrent) {
                  return (
                    <div key={stageName} className="flex items-center gap-2 text-[#D7A84B] font-bold">
                      <span className="animate-spin">↻</span>
                      <span>
                        Stage {idx + 1}: {stageName}
                      </span>
                    </div>
                  );
                }

                return (
                  <div key={stageName} className="flex items-center gap-2 text-[#929BA3] opacity-50">
                    <span className="w-2.5 h-2.5 border border-[#30373D] inline-block" />
                    <span>
                      Stage {idx + 1}: {stageName}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Notice Footer */}
            <div className="font-mono text-[11px] text-[#929BA3] flex justify-between items-center pt-1">
              <span>Intake runs asynchronously...</span>
              <Link
                href="/api/bull-board"
                target="_blank"
                className="text-[#D7A84B] hover:underline flex items-center gap-1"
              >
                View in Bull Board ↗
              </Link>
            </div>
          </div>
        </aside>
      )}
    </main>
  );
}
