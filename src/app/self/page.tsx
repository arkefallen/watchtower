// src/app/self/page.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { EdgeDecayChart } from "@/components/self/EdgeDecayChart";
import { PnlBreakdown } from "@/components/self/PnlBreakdown";
import { ComparisonTable } from "@/components/self/ComparisonTable";
import { SelfWalletCard } from "@/components/wallets/SelfWalletCard";

export default function SelfTrackingPage() {
  const [selectedWallet, setSelectedWallet] = useState<string>("");
  const [selectedFollowedWallet, setSelectedFollowedWallet] = useState<string>("");
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [regAddress, setRegAddress] = useState("");
  const [regChain, setRegChain] = useState<"base" | "bsc" | "robinhood">("base");
  const [regLabel, setRegLabel] = useState("");

  const utils = trpc.useUtils();

  // Queries
  const selfWalletsQuery = trpc.self.wallets.useQuery();
  const dashboardQuery = trpc.self.dashboard.useQuery({
    walletAddress: selectedWallet || undefined,
  });
  const decayQuery = trpc.self.decay.useQuery({
    followedWallet: selectedFollowedWallet
      ? {
          address: selectedFollowedWallet,
          chain: "base",
        }
      : undefined,
  });
  const comparisonQuery = trpc.self.comparison.useQuery({
    walletAddress: selectedWallet || undefined,
    followedWalletAddress: selectedFollowedWallet || undefined,
  });
  const watchlistQuery = trpc.wallet.list.useQuery({ take: 100 });

  // Mutations
  const addWalletMutation = trpc.wallet.add.useMutation({
    onSuccess: () => {
      utils.self.wallets.invalidate();
      utils.self.dashboard.invalidate();
      setShowRegisterModal(false);
      setRegAddress("");
      setRegLabel("");
    },
  });

  const toggleSelfMutation = trpc.self.toggleSelf.useMutation({
    onSuccess: () => {
      utils.self.wallets.invalidate();
      utils.self.dashboard.invalidate();
      utils.wallet.list.invalidate();
    },
  });

  const resyncMutation = trpc.wallet.add.useMutation({
    onSuccess: () => {
      utils.self.wallets.invalidate();
    },
  });

  const handleRegisterSelf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regAddress) return;
    await addWalletMutation.mutateAsync({
      address: regAddress.trim(),
      chain: regChain,
      label: regLabel.trim() || undefined,
      isSelf: true,
      forceFullResync: true,
    });
  };

  const followedWalletOptions = (watchlistQuery.data?.items ?? [])
    .filter((w: any) => !w.isSelf)
    .map((w: any) => ({
      address: w.address,
      chain: w.chain,
      label: w.label || null,
    }));

  const metrics = dashboardQuery.data;

  return (
    <main className="min-h-screen bg-[#101214] text-[#E8ECEF] flex flex-col p-6 max-w-[1440px] mx-auto w-full gap-6">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#30373D] pb-4">
        <div>
          <div className="font-mono text-[12px] text-[#929BA3] uppercase mb-1 flex items-center gap-2">
            <span>WATCHTOWER</span>
            <span className="text-[#30373D]">/</span>
            <span className="text-[#D7A84B]">SELF-TRACKING</span>
            <span className="text-[#30373D]">/</span>
            <span className="text-[#E8ECEF]">EDGE RIDER</span>
          </div>
          <h1 className="font-sans text-[32px] font-bold text-[#E8ECEF] uppercase tracking-tight">
            SELF-TRACKING & EDGE DECAY
          </h1>
          <p className="font-sans text-[14px] text-[#929BA3] mt-0.5">
            Surveillance of own executions, lag degradation, and alpha capture efficiency (Module 6)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowRegisterModal(true)}
            className="h-10 px-4 bg-transparent border border-[#30373D] text-[#E8ECEF] font-mono text-[12px] uppercase font-semibold hover:bg-[#1E2327] transition-colors rounded-none flex items-center gap-2"
          >
            <span>+</span> REGISTER SELF WALLET
          </button>
          <Link
            href="/self/trades"
            className="h-10 px-5 bg-[#D7A84B] text-[#101214] font-mono text-[12px] uppercase font-bold hover:brightness-110 active:translate-y-[1px] transition-all rounded-none flex items-center gap-2"
          >
            <span>✍</span> LOG MANUAL TRADE
          </Link>
        </div>
      </div>

      {/* Register Self Wallet Modal */}
      {showRegisterModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="register-modal-title"
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
        >
          <div className="bg-[#171A1D] border border-[#D7A84B] p-6 max-w-[500px] w-full space-y-4">
            <div className="flex items-center justify-between border-b border-[#30373D] pb-3">
              <h3 id="register-modal-title" className="text-[14px] font-mono font-semibold uppercase text-[#E8ECEF]">
                REGISTER OWN WALLET (isSelf)
              </h3>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="text-[#929BA3] hover:text-[#E8ECEF]"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleRegisterSelf} className="space-y-3">
              <div>
                <label className="block text-[11px] font-mono text-[#929BA3] mb-1 uppercase">
                  WALLET ADDRESS *
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={regAddress}
                  onChange={(e) => setRegAddress(e.target.value)}
                  className="w-full bg-[#101214] border border-[#30373D] text-[#E8ECEF] text-[12px] font-mono p-2 focus:border-[#D7A84B] focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-[#929BA3] mb-1 uppercase">
                  CHAIN *
                </label>
                <select
                  value={regChain}
                  onChange={(e) => setRegChain(e.target.value as any)}
                  className="w-full bg-[#101214] border border-[#30373D] text-[#E8ECEF] text-[12px] font-mono p-2 focus:border-[#D7A84B] focus:outline-none"
                >
                  <option value="base">Base</option>
                  <option value="bsc">BSC</option>
                  <option value="robinhood">Robinhood</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-mono text-[#929BA3] mb-1 uppercase">
                  LABEL (OPTIONAL)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Trading Cold Wallet"
                  value={regLabel}
                  onChange={(e) => setRegLabel(e.target.value)}
                  className="w-full bg-[#101214] border border-[#30373D] text-[#E8ECEF] text-[12px] font-mono p-2 focus:border-[#D7A84B] focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 border border-[#30373D] text-[#929BA3] text-[12px] font-mono"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={addWalletMutation.isPending}
                  className="px-4 py-2 bg-[#D7A84B] text-[#101214] text-[12px] font-mono font-bold"
                >
                  {addWalletMutation.isPending ? "REGISTERING..." : "REGISTER & SYNC"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Registered Self Wallets Rail */}
      {selfWalletsQuery.data && selfWalletsQuery.data.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[12px] font-mono font-semibold uppercase text-[#929BA3] flex items-center gap-2">
              <span>●</span> REGISTERED SELF IDENTITIES ({selfWalletsQuery.data.length})
            </h3>
            {selectedWallet && (
              <button
                onClick={() => setSelectedWallet("")}
                className="text-[11px] font-mono text-[#D7A84B] hover:underline"
              >
                CLEAR FILTER (SHOW ALL SELF IDENTITIES)
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {selfWalletsQuery.data.map((w) => (
              <SelfWalletCard
                key={`${w.chain}-${w.address}`}
                wallet={w}
                onToggleSelf={(addr, chain, val) =>
                  toggleSelfMutation.mutate({ address: addr, chain: chain as any, isSelf: val })
                }
                onResync={(addr, chain) =>
                  resyncMutation.mutate({ address: addr, chain: chain as any, forceFullResync: true })
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* Top KPI Metrics Bar */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-[#171A1D] border border-[#30373D] p-4">
          <div className="text-[11px] font-mono uppercase text-[#929BA3]">WIN RATE</div>
          <div className="text-[24px] font-mono font-bold text-[#E8ECEF] mt-1">
            {metrics ? `${metrics.winRatePct}%` : "—"}
          </div>
          <div className="text-[10px] font-mono text-[#79B79A] mt-0.5">Closed Trades</div>
        </div>

        <div className="bg-[#171A1D] border border-[#30373D] p-4">
          <div className="text-[11px] font-mono uppercase text-[#929BA3]">REALIZED PnL</div>
          <div
            className={`text-[24px] font-mono font-bold mt-1 ${
              Number(metrics?.totalPnlUsd || 0) >= 0 ? "text-[#79B79A]" : "text-[#D87870]"
            }`}
          >
            {metrics
              ? Number(metrics.totalPnlUsd) >= 0
                ? `+$${Number(metrics.totalPnlUsd).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                : `-$${Math.abs(Number(metrics.totalPnlUsd)).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
              : "—"}
          </div>
          <div className="text-[10px] font-mono text-[#929BA3] mt-0.5">Net Realized</div>
        </div>

        <div className="bg-[#171A1D] border border-[#30373D] p-4">
          <div className="text-[11px] font-mono uppercase text-[#929BA3]">UNREALIZED PnL</div>
          <div
            className={`text-[24px] font-mono font-bold mt-1 ${
              Number(metrics?.unrealizedPnlUsd || 0) >= 0 ? "text-[#79B79A]" : "text-[#D87870]"
            }`}
          >
            {metrics
              ? Number(metrics.unrealizedPnlUsd) >= 0
                ? `+$${Number(metrics.unrealizedPnlUsd).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                : `-$${Math.abs(Number(metrics.unrealizedPnlUsd)).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
              : "—"}
          </div>
          <div className="text-[10px] font-mono text-[#929BA3] mt-0.5">Open Positions</div>
        </div>

        <div className="bg-[#171A1D] border border-[#30373D] p-4">
          <div className="text-[11px] font-mono uppercase text-[#929BA3]">AVG FOLLOW LAG</div>
          <div className="text-[24px] font-mono font-bold text-[#D7A84B] mt-1">
            {metrics?.avgFollowLagMinutes !== null && metrics?.avgFollowLagMinutes !== undefined
              ? `${metrics.avgFollowLagMinutes}m`
              : "—"}
          </div>
          <div className="text-[10px] font-mono text-[#929BA3] mt-0.5">Vs First Smart Entry</div>
        </div>

        <div className="bg-[#171A1D] border border-[#30373D] p-4">
          <div className="text-[11px] font-mono uppercase text-[#929BA3]">LINKED TRADES</div>
          <div className="text-[24px] font-mono font-bold text-[#E8ECEF] mt-1">
            {metrics?.linkedTradesCount ?? 0}
            <span className="text-[13px] text-[#929BA3] font-normal"> / {metrics?.totalTradesCount ?? 0}</span>
          </div>
          <div className="text-[10px] font-mono text-[#929BA3] mt-0.5">Matched Signals</div>
        </div>
      </section>

      {/* Section 1: Edge Decay Curve (FR-6.4) */}
      <EdgeDecayChart
        buckets={decayQuery.data?.buckets ?? []}
        sampleSize={decayQuery.data?.sampleSize ?? 0}
        insufficientSample={decayQuery.data?.insufficientSample ?? true}
        selectedFollowedWallet={selectedFollowedWallet}
        onFollowedWalletChange={setSelectedFollowedWallet}
        followedWalletOptions={followedWalletOptions}
      />

      {/* Section 2: PnL Breakdown (FR-6.5) */}
      <PnlBreakdown
        byFollowedWallet={metrics?.byFollowedWallet ?? []}
        byToken={metrics?.byToken ?? []}
        byLagBucket={metrics?.byLagBucket ?? []}
      />

      {/* Section 3: Execution Comparison Ledger (FR-6.6) */}
      <ComparisonTable
        items={comparisonQuery.data ?? []}
        isLoading={comparisonQuery.isLoading}
      />
    </main>
  );
}
