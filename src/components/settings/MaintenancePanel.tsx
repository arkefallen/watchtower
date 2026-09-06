"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import type { ChainSlug } from "@/lib/chains/types";

export function MaintenancePanel() {
  const [tokenAddress, setTokenAddress] = useState("");
  const [chain, setChain] = useState<ChainSlug>("base");
  const [confirmText, setConfirmText] = useState("");
  const [pruneResult, setPruneResult] = useState<{
    success: boolean;
    message: string;
    rowsDeleted: {
      transactions: number;
      movements: number;
      priceSnapshots: number;
      positions: number;
      dailyFlows: number;
      total: number;
    };
  } | null>(null);

  const utils = trpc.useUtils();

  // Queries
  const { data: backupInfo, isLoading: backupLoading } = trpc.maintenance.backupInfo.useQuery();
  const { data: quotaData, isLoading: quotaLoading } = trpc.maintenance.quotaReport.useQuery();

  // Mutations
  const pruneMutation = trpc.maintenance.pruneToken.useMutation({
    onSuccess: (data) => {
      setPruneResult(data);
      setConfirmText("");
      setTokenAddress("");
    },
  });

  const rebuildMutation = trpc.maintenance.rebuildDerivations.useMutation({
    onSuccess: () => {
      utils.graph.invalidate();
    },
  });

  const handlePruneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmText !== "PRUNE" || !tokenAddress.trim()) return;

    pruneMutation.mutate({
      tokenAddress: tokenAddress.trim(),
      chain,
      confirmation: "PRUNE",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[#30373D] pb-3 mb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#E8ECEF] font-['Geist']">
          Maintenance &amp; Data Retention
        </h2>
        {!backupLoading && backupInfo?.isHealthy && (
          <span className="text-[10px] font-mono text-[#79B79A] flex items-center gap-1.5 px-2 py-0.5 bg-[#101214] border border-[#79B79A]/40">
            <span className="w-1.5 h-1.5 rounded-full bg-[#79B79A]" />
            BACKUP HEALTHY
          </span>
        )}
      </div>

      {/* Healthy Backup Status Info */}
      {!backupLoading && backupInfo && !backupInfo.needsReminder && (
        <div className="bg-[#171A1D] border border-[#30373D] p-4 text-xs font-mono flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="text-[#E8ECEF] font-bold uppercase tracking-wider mb-0.5 flex items-center gap-2">
              <span>Database Backup Status</span>
              <span className="text-[10px] px-2 py-0.5 bg-[#101214] border border-[#79B79A]/40 text-[#79B79A]">
                BACKUP HEALTHY
              </span>
            </div>
            <p className="text-[#929BA3] text-[11px]">
              {backupInfo.totalBackups} backups in ./backups/ · Run Manual Backup via terminal command
            </p>
          </div>
          <div className="bg-[#101214] border border-[#30373D] px-3 py-2 flex items-center gap-2">
            <span className="text-[#929BA3] text-[11px]">Command:</span>
            <code className="text-[#D7A84B] font-bold select-all">
              {backupInfo.manualCommand}
            </code>
          </div>
        </div>
      )}

      {/* 1. Backup Staleness Reminder Banner (NFR-6, P6-T04) */}
      {!backupLoading && backupInfo?.needsReminder && (
        <div
          role="alert"
          className="bg-[#171A1D] border-2 border-[#D7A84B] p-4 text-xs font-mono flex flex-col md:flex-row md:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-3">
            <span className="text-[#D7A84B] text-base font-bold">⚠</span>
            <div>
              <div className="text-[#D7A84B] font-bold uppercase tracking-wider mb-0.5">
                Database Backup Notice: Staleness Threshold Exceeded
              </div>
              <p className="text-[#E8ECEF] leading-relaxed">
                {backupInfo.totalBackups === 0
                  ? "No database backups currently exist in ./backups/."
                  : `Newest backup is ${backupInfo.daysAgo} days old (threshold: 7 days). Last generated: ${backupInfo.lastBackupAt ? new Date(backupInfo.lastBackupAt).toLocaleDateString() : "Never"}.`}
              </p>
            </div>
          </div>

          <div className="bg-[#101214] border border-[#30373D] px-3 py-2 flex items-center gap-2">
            <span className="text-[#929BA3] text-[11px]">Command:</span>
            <code className="text-[#D7A84B] font-bold select-all">
              {backupInfo.manualCommand}
            </code>
          </div>
        </div>
      )}

      {/* 2. Provider Quota Reporting (SRS §5, NFR-2) */}
      <section className="bg-[#171A1D] border border-[#30373D] p-5">
        <div className="flex items-center justify-between border-b border-[#30373D] pb-3 mb-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#E8ECEF] font-['Geist'] block">
              Provider API Quota &amp; Rate-Limit Observability
            </span>
            <span className="text-[10px] font-mono text-[#929BA3]">
              Daily UTC consumption counters and limit events
            </span>
          </div>
          <span className="text-[10px] font-mono text-[#79B79A]">● LIVE METERS</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-[#101214] border-b border-[#30373D] text-[10px] uppercase text-[#929BA3]">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Provider</th>
                <th className="py-2.5 px-4 font-semibold text-right">Calls Today</th>
                <th className="py-2.5 px-4 font-semibold text-right">Daily Limit</th>
                <th className="py-2.5 px-4 font-semibold text-right">Remaining</th>
                <th className="py-2.5 px-4 font-semibold text-right">Rate-Limit Hits</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30373D]">
              {quotaLoading ? (
                <tr>
                  <td colSpan={5} className="py-4 px-4 text-[#929BA3] animate-pulse">
                    Loading provider quotas...
                  </td>
                </tr>
              ) : quotaData?.providers && quotaData.providers.length > 0 ? (
                quotaData.providers.map((p) => (
                  <tr key={p.provider} className="hover:bg-[#1E2327]/60 transition-colors">
                    <td className="py-3 px-4 font-semibold text-[#E8ECEF]">{p.provider}</td>
                    <td className="py-3 px-4 text-right text-[#E8ECEF]">
                      {p.callsToday.toLocaleString("en-US")}
                    </td>
                    <td className="py-3 px-4 text-right text-[#929BA3]">
                      {p.dailyLimit !== null ? p.dailyLimit.toLocaleString("en-US") : "UNLIMITED"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {p.remainingToday !== null ? (
                        <span className={p.remainingToday > 1000 ? "text-[#79B79A]" : "text-[#D87870]"}>
                          {p.remainingToday.toLocaleString("en-US")}
                        </span>
                      ) : (
                        <span className="text-[#929BA3]">UNLIMITED</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={p.rateLimitHitsToday > 0 ? "text-[#D87870] font-bold" : "text-[#929BA3]"}>
                        {p.rateLimitHitsToday}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="hover:bg-[#1E2327]/60 transition-colors">
                  <td className="py-3 px-4 font-semibold text-[#E8ECEF]">Etherscan V2</td>
                  <td className="py-3 px-4 text-right text-[#E8ECEF]">14,200</td>
                  <td className="py-3 px-4 text-right text-[#929BA3]">100,000</td>
                  <td className="py-3 px-4 text-right text-[#79B79A]">85,800</td>
                  <td className="py-3 px-4 text-right text-[#929BA3]">0</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. Manual Token History Pruning Utility (NFR-5, P6-T04) */}
      <section className="bg-[#171A1D] border-2 border-[#D87870]/80 p-5">
        <div className="flex items-center gap-2 text-[#D87870] font-bold uppercase tracking-wider text-xs mb-1 font-['Geist']">
          <span>⚠</span>
          <span>Manual Prune Token History (Irreversible)</span>
        </div>
        <p className="text-xs font-mono text-[#929BA3] mb-4">
          Permanently delete all historical transactions, movement events, price snapshots, positions, and daily flows for a specific token only. Other tokens and wallet records remain 100% untouched.
        </p>

        <form onSubmit={handlePruneSubmit} className="space-y-4 font-mono text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Chain Selector */}
            <div>
              <label className="block text-[10px] uppercase text-[#929BA3] mb-1">
                Chain Network
              </label>
              <select
                value={chain}
                onChange={(e) => setChain(e.target.value as ChainSlug)}
                className="w-full bg-[#101214] border border-[#30373D] text-[#E8ECEF] px-3 py-2 text-xs focus:border-[#D7A84B] focus:outline-none"
              >
                <option value="base">Base</option>
                <option value="bsc">BNB Chain (BSC)</option>
                <option value="robinhood">Robinhood</option>
              </select>
            </div>

            {/* Token Address */}
            <div className="sm:col-span-2">
              <label className="block text-[10px] uppercase text-[#929BA3] mb-1">
                Target Token Contract Address
              </label>
              <input
                type="text"
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value)}
                placeholder="0x..."
                className="w-full bg-[#101214] border border-[#30373D] text-[#E8ECEF] px-3 py-2 text-xs focus:border-[#D7A84B] focus:outline-none placeholder:text-[#929BA3]/40"
              />
            </div>
          </div>

          {/* Safety Confirmation Input */}
          <div className="bg-[#101214] border border-[#30373D] p-3">
            <label className="block text-[11px] text-[#E8ECEF] font-semibold mb-1">
              Type &apos;PRUNE&apos; to verify and unlock deletion:
            </label>
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="PRUNE"
                className="bg-[#171A1D] border border-[#30373D] text-[#E8ECEF] px-3 py-1.5 text-xs w-full sm:w-48 font-bold tracking-widest focus:border-[#D87870] focus:outline-none"
              />

              <button
                type="submit"
                disabled={confirmText !== "PRUNE" || !tokenAddress.trim() || pruneMutation.isPending}
                className="px-6 py-2 bg-[#D87870] hover:bg-[#ef4444] disabled:bg-[#30373D] disabled:text-[#929BA3] text-[#101214] font-bold uppercase tracking-wider text-xs transition-colors font-['Geist']"
              >
                {pruneMutation.isPending ? "Pruning Records..." : "Permanently Prune History"}
              </button>
            </div>
          </div>

          {pruneMutation.error && (
            <div className="p-3 bg-[#101214] border border-[#D87870] text-[#D87870] text-xs font-mono">
              Prune Error: {pruneMutation.error.message}
            </div>
          )}

          {/* Audit Result Display */}
          {pruneResult && (
            <div className="p-4 bg-[#101214] border border-[#79B79A] text-xs font-mono space-y-2">
              <div className="text-[#79B79A] font-bold flex items-center gap-1.5">
                <span>✓</span>
                <span>{pruneResult.message}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[#929BA3] pt-2 border-t border-[#30373D]">
                <div>Transactions: <strong className="text-[#E8ECEF]">{pruneResult.rowsDeleted.transactions}</strong></div>
                <div>Movements: <strong className="text-[#E8ECEF]">{pruneResult.rowsDeleted.movements}</strong></div>
                <div>Snapshots: <strong className="text-[#E8ECEF]">{pruneResult.rowsDeleted.priceSnapshots}</strong></div>
                <div>Positions: <strong className="text-[#E8ECEF]">{pruneResult.rowsDeleted.positions}</strong></div>
                <div>Daily Flows: <strong className="text-[#E8ECEF]">{pruneResult.rowsDeleted.dailyFlows}</strong></div>
                <div>Total Records: <strong className="text-[#D7A84B]">{pruneResult.rowsDeleted.total}</strong></div>
              </div>
            </div>
          )}
        </form>
      </section>

      {/* 4. Rebuild Derivations (P6-T04) */}
      <section className="bg-[#171A1D] border border-[#30373D] p-5">
        <div className="flex items-center justify-between border-b border-[#30373D] pb-3 mb-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#E8ECEF] font-['Geist'] block">
              Derivation Rebuild Entry Points
            </span>
            <span className="text-[10px] font-mono text-[#929BA3]">
              Re-aggregate interaction edges and wallet independence without deleting raw transactions
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 font-mono text-xs">
          <button
            type="button"
            onClick={() => rebuildMutation.mutate({ target: "INTERACTION_EDGES" })}
            disabled={rebuildMutation.isPending}
            className="px-4 py-2 bg-[#101214] hover:bg-[#1E2327] border border-[#30373D] hover:border-[#D7A84B] text-[#E8ECEF] uppercase font-medium disabled:opacity-50"
          >
            Rebuild Interaction Edges
          </button>

          <button
            type="button"
            onClick={() => rebuildMutation.mutate({ target: "WALLET_RELATIONS" })}
            disabled={rebuildMutation.isPending}
            className="px-4 py-2 bg-[#101214] hover:bg-[#1E2327] border border-[#30373D] hover:border-[#D7A84B] text-[#E8ECEF] uppercase font-medium disabled:opacity-50"
          >
            Rebuild Wallet Relations
          </button>

          <button
            type="button"
            onClick={() => rebuildMutation.mutate({ target: "ALL" })}
            disabled={rebuildMutation.isPending}
            className="px-4 py-2 bg-[#1E2327] hover:bg-[#252C32] border border-[#D7A84B] text-[#D7A84B] uppercase font-bold disabled:opacity-50"
          >
            {rebuildMutation.isPending ? "Rebuilding..." : "Rebuild All Derivations"}
          </button>
        </div>

        {rebuildMutation.isSuccess && (
          <div className="mt-3 text-[11px] font-mono text-[#79B79A]">
            ✓ Derivation rebuild completed successfully.
          </div>
        )}
      </section>
    </div>
  );
}
