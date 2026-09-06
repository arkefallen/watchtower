"use client";

import React, { use, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { CHAIN_REGISTRY } from "@/lib/chains/registry";
import type { ChainSlug } from "@/lib/chains/types";
import { ActivityHeatmap } from "@/components/wallets/ActivityHeatmap";
import { ParkingTimeline } from "@/components/wallets/ParkingTimeline";
import { FundingTree } from "@/components/funding/FundingTree";
import { type TreeNodeData } from "@/components/funding/FundingNode";
import { EntityLabelEditor } from "@/components/settings/EntityLabelEditor";
import { StateBadge } from "@/components/shared/StateBadge";
import { ClusterChip } from "@/components/clusters/ClusterChip";
import { GradeCard } from "@/components/wallets/GradeCard";

interface PageProps {
  params: Promise<{
    chain: string;
    address: string;
  }>;
}

function formatUsd(val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  const str = String(val);
  const num = parseFloat(str);
  if (isNaN(num)) return "—";
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function WalletDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const chain = (resolvedParams.chain as string).toLowerCase() as ChainSlug;
  const address = resolvedParams.address.toLowerCase();

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "funding">("overview");
  const [selectedNode, setSelectedNode] = useState<TreeNodeData | null>(null);

  // Edit tag local states
  const [edge, setEdge] = useState<string>("SMART");
  const [style, setStyle] = useState<string>("RIDER");
  const [size, setSize] = useState<string>("W");
  const [labelInput, setLabelInput] = useState<string>("");
  const [notesInput, setNotesInput] = useState<string>("");
  const [isSelf, setIsSelf] = useState<boolean>(false);
  const [watchPriority, setWatchPriority] = useState<"NORMAL" | "HIGH">("NORMAL");
  const [tagsSavedMsg, setTagsSavedMsg] = useState(false);

  const utils = trpc.useUtils();

  // Queries
  const { data: wallet, isLoading: walletLoading, error: walletError } = trpc.wallet.get.useQuery({
    address,
    chain,
  });

  const { data: parkingData, isLoading: parkingLoading } = trpc.wallet.parking.useQuery({
    address,
    chain,
  });

  const { data: gradeData, isLoading: isGradeLoading } = trpc.wallet.grade.useQuery({
    address,
    chain,
  });

  const recomputeGradeMutation = trpc.wallet.recomputeGrade.useMutation({
    onSuccess: () => {
      utils.wallet.grade.invalidate({ address, chain });
      utils.wallet.get.invalidate({ address, chain });
    },
  });

  // Re-sync mutation
  const resyncMutation = trpc.wallet.resync.useMutation({
    onSuccess: () => {
      utils.wallet.get.invalidate({ address, chain });
      utils.wallet.parking.invalidate({ address, chain });
      utils.funding.tree.invalidate({ address, chain });
    },
  });

  // Update tags mutation
  const updateTagsMutation = trpc.wallet.updateTags.useMutation({
    onSuccess: () => {
      setTagsSavedMsg(true);
      utils.wallet.get.invalidate({ address, chain });
      setTimeout(() => setTagsSavedMsg(false), 2500);
    },
  });

  // Sync initial tag form values when wallet data loads
  React.useEffect(() => {
    if (wallet) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (wallet.edge) setEdge(wallet.edge);
      if (wallet.style) setStyle(wallet.style);
      if (wallet.size) setSize(wallet.size);
      if (wallet.label) setLabelInput(wallet.label);
      if (wallet.notes) setNotesInput(wallet.notes);
      if (wallet.isSelf !== undefined) setIsSelf(wallet.isSelf);
      if (wallet.watchPriority) setWatchPriority(wallet.watchPriority);
    }
  }, [wallet]);

  // Must be declared before any conditional returns to respect React's rules of hooks
  const addMutation = trpc.wallet.add.useMutation({
    onSuccess: () => {
      utils.wallet.get.invalidate({ address, chain });
      utils.wallet.list.invalidate();
    },
  });

  const explorerBase = CHAIN_REGISTRY[chain]?.explorerBaseUrl ?? "https://basescan.org";

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSaveTags = (e: React.FormEvent) => {
    e.preventDefault();
    updateTagsMutation.mutate({
      address,
      chain,
      edge: edge as any,
      style: style as any,
      size: size as any,
      label: labelInput.trim() || null,
      notes: notesInput.trim() || null,
      isSelf,
      watchPriority,
    });
  };

  if (walletLoading) {
    return (
      <div className="min-h-screen bg-[#101214] text-[#E8ECEF] flex items-center justify-center p-8">
        <div className="text-center font-mono text-[13px] text-[#929BA3]">
          <div className="w-6 h-6 border-2 border-[#D7A84B] border-t-transparent animate-spin mx-auto mb-3" />
          <span>Loading wallet profile: {shortenAddress(address)}...</span>
        </div>
      </div>
    );
  }

  if (walletError || !wallet) {
    return (
      <div className="min-h-screen bg-[#101214] text-[#E8ECEF] p-8 max-w-4xl mx-auto flex flex-col justify-center">
        <div className="p-6 bg-[#171A1D] border border-[#30373D] text-[#E8ECEF]">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-none bg-[#D7A84B]" />
            <h1 className="font-bold text-[16px] text-[#E8ECEF] uppercase tracking-wider font-['Geist']">
              Wallet Not In Registry
            </h1>
          </div>
          <p className="text-[13px] font-mono text-[#929BA3] mb-4">
            The address <span className="text-[#E8ECEF] font-semibold">{address}</span> is not yet being tracked on chain <span className="text-[#D7A84B] font-semibold uppercase">{chain}</span>.
          </p>
          <div className="p-4 bg-[#101214] border border-[#30373D] mb-6 space-y-2 font-mono text-[12px] text-[#929BA3]">
            <p>• To generate profile statistics, heatmaps, and recursive funding trees, this wallet must first be registered in your local Watchtower database.</p>
            <p>• You can click <strong className="text-[#E8ECEF]">Register &amp; Track Now</strong> below, or batch import up to 10 wallets from the Intake console.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={addMutation.isPending}
              onClick={() =>
                addMutation.mutate({
                  address,
                  chain,
                  watchPriority: "NORMAL",
                  isSelf: false,
                })
              }
              className="px-5 py-2.5 bg-[#D7A84B] text-[#101214] text-[12px] font-bold uppercase tracking-wider font-['Geist'] hover:brightness-110 active:translate-y-[1px] transition-all flex items-center gap-2"
            >
              <span>{addMutation.isPending ? "Registering..." : "+ Register & Track Now"}</span>
            </button>
            <Link
              href="/wallets/new"
              className="px-4 py-2 bg-transparent border border-[#30373D] text-[#E8ECEF] text-[12px] font-semibold uppercase tracking-wider font-['Geist'] hover:bg-[#1E2327] transition-colors"
            >
              Open Intake Console
            </Link>
            <Link
              href="/wallets"
              className="px-4 py-2 text-[#929BA3] hover:text-[#E8ECEF] text-[12px] font-semibold uppercase tracking-wider font-['Geist'] transition-colors"
            >
              ← Return to Wallets
            </Link>
          </div>
          {addMutation.isError && (
            <p className="mt-3 text-[12px] font-mono text-[#D87870]">
              Failed to register: {addMutation.error.message}
            </p>
          )}
        </div>
      </div>
    );
  }

  const profile = wallet.profile;
  const syncState = wallet.syncState;
  const clusterLink = wallet.clusterLinks?.[0];
  const cluster = clusterLink?.cluster;

  // Compute profile stats card values
  const firstTxDateFormatted = profile?.firstTxAt
    ? new Date(profile.firstTxAt).toISOString().split("T")[0]
    : "—";

  const firstMemecoinDays =
    profile?.walletAgeDaysAtFirstMemecoinTrade !== null &&
    profile?.walletAgeDaysAtFirstMemecoinTrade !== undefined
      ? `${profile.walletAgeDaysAtFirstMemecoinTrade} days`
      : "—";

  const totalTxs = profile?.txCount ?? 0;
  const distinctTokens = profile?.distinctTokenCount ?? 0;
  const currentParked = profile?.stableBalanceUsd ?? "0";
  const isDormant = !!profile?.dormantSince;

  const isSyncIdle = syncState?.status === "IDLE";
  const isSyncRunning = syncState?.status === "RUNNING" || syncState?.status === "QUEUED";

  return (
    <div className="min-h-screen bg-[#101214] text-[#E8ECEF] pb-16">
      {/* Top Header / Breadcrumb */}
      <header className="border-b border-[#30373D] bg-[#171A1D] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-[11px] text-[#929BA3]">
          <Link href="/" className="hover:text-[#D7A84B] transition-colors">
            WATCHTOWER
          </Link>
          <span className="text-[#30373D]">/</span>
          <Link href="/wallets" className="hover:text-[#D7A84B] transition-colors">
            WALLETS
          </Link>
          <span className="text-[#30373D]">/</span>
          <span className="text-[#D7A84B] uppercase">{chain}</span>
          <span className="text-[#30373D]">/</span>
          <span className="text-[#E8ECEF] font-semibold">{shortenAddress(address)}</span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/clusters"
            className="text-[11px] font-mono text-[#929BA3] hover:text-[#D7A84B] transition-colors"
          >
            Clusters Index ↗
          </Link>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto p-4 md:p-6 space-y-6">
        {/* Top Identity Header */}
        <section className="bg-[#171A1D] border border-[#30373D] p-5 flex flex-col xl:flex-row justify-between gap-4 items-start xl:items-center">
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[22px] font-bold text-[#E8ECEF] font-['Geist']">
                {wallet.ensName || wallet.label || shortenAddress(address)}
              </h1>

              {/* Full Checksum Address Copy Pill */}
              <div
                onClick={handleCopy}
                className="flex items-center gap-2 font-mono text-[12px] text-[#929BA3] bg-[#101214] px-2.5 py-1 border border-[#30373D] hover:border-[#D7A84B] cursor-pointer transition-colors relative"
                title="Click to copy full address"
              >
                <span>{address}</span>
                <span className="text-[10px] text-[#D7A84B]">{copied ? "COPIED!" : "COPY"}</span>
                <a
                  href={`${explorerBase}/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[#929BA3] hover:text-[#D7A84B] ml-1"
                  title="Open in block explorer"
                >
                  ↗
                </a>
              </div>
            </div>

            {/* Badges / Chips Row */}
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
              {/* Chain Badge */}
              <span className="px-2 py-0.5 border border-[#30373D] bg-[#101214] text-[#E8ECEF] uppercase font-semibold">
                {chain}
              </span>

              {/* Computed Label Pill */}
              {(wallet.edge || wallet.style || wallet.size) && (
                <span className="px-2 py-0.5 border border-[#D7A84B] bg-[#4A3A1A]/30 text-[#D7A84B] uppercase font-bold">
                  {wallet.edge || "RAW"}-{wallet.style || "UNSET"} [{wallet.size || "S"}]
                </span>
              )}

              {/* Cluster Chip */}
              {cluster ? (
                <ClusterChip
                  cluster={{
                    id: cluster.id,
                    name: cluster.name,
                    colorHex: cluster.colorHex,
                    isArmed: cluster.isArmed,
                  }}
                />
              ) : (
                <span className="px-2 py-0.5 border border-[#30373D] bg-[#101214] text-[#929BA3] uppercase">
                  No Cluster
                </span>
              )}

              {/* Alert State Badge (P4-T10) */}
              <StateBadge
                state={wallet.alertState?.state || "IDLE"}
                subText={wallet.alertState?.stateReason ?? undefined}
              />

              {/* Sync Status Badge */}
              <span className="px-2 py-0.5 border border-[#30373D] bg-[#101214] text-[#E8ECEF] uppercase flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isSyncIdle
                      ? "bg-[#79B79A]"
                      : isSyncRunning
                      ? "bg-[#D7A84B] animate-pulse"
                      : "bg-[#D87870]"
                  }`}
                />
                <span>
                  {isSyncIdle
                    ? "● SYNCED"
                    : isSyncRunning
                    ? "● SYNCING"
                    : syncState?.status || "NEVER_SYNCED"}
                </span>
              </span>

              {wallet.isSelf && (
                <span className="px-2 py-0.5 border border-[#79B79A] text-[#79B79A] uppercase bg-[#79B79A]/10">
                  SELF-WALLET
                </span>
              )}

              {wallet.watchPriority === "HIGH" && (
                <span className="px-2 py-0.5 border border-[#D87870] text-[#D87870] uppercase bg-[#D87870]/10">
                  PRIORITY: HIGH
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={resyncMutation.isPending}
              onClick={() => resyncMutation.mutate({ address, chain })}
              className="px-4 py-2 border border-[#30373D] bg-[#101214] hover:border-[#D7A84B] text-[#E8ECEF] hover:text-[#D7A84B] text-[11px] font-bold uppercase tracking-wider transition-colors font-['Geist'] flex items-center gap-1.5"
            >
              <span className={resyncMutation.isPending ? "animate-spin inline-block" : ""}>
                🔄
              </span>
              <span>{resyncMutation.isPending ? "Syncing..." : "Re-sync (Full)"}</span>
            </button>
          </div>
        </section>

        {/* Compact TagEditor / LabelPreview Toolbar */}
        <section className="bg-[#171A1D] border border-[#30373D] p-4">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#30373D]">
            <span className="text-[11px] font-semibold text-[#D7A84B] uppercase tracking-wider font-['Geist']">
              Tag Editor & Intelligence Overlay
            </span>
            {tagsSavedMsg && (
              <span className="text-[11px] font-mono text-[#79B79A] font-bold">
                ✓ Tags updated successfully
              </span>
            )}
          </div>

          <form onSubmit={handleSaveTags} className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-3 items-end font-mono text-[11px]">
            <div>
              <label className="block text-[9px] uppercase text-[#929BA3] mb-1 font-['Geist']">
                Edge
              </label>
              <select
                value={edge}
                onChange={(e) => setEdge(e.target.value)}
                className="w-full bg-[#101214] border border-[#30373D] px-2 py-1.5 text-[#E8ECEF] focus:border-[#D7A84B] focus:outline-none"
              >
                {["SMART", "INSIDER", "EARLY", "BOT", "KOL", "DEGEN", "FRESH", "DEV"].map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[9px] uppercase text-[#929BA3] mb-1 font-['Geist']">
                Style
              </label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full bg-[#101214] border border-[#30373D] px-2 py-1.5 text-[#E8ECEF] focus:border-[#D7A84B] focus:outline-none"
              >
                {["SNIPER", "JEET", "RIDER", "SWING", "DIAMOND"].map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[9px] uppercase text-[#929BA3] mb-1 font-['Geist']">
                Size
              </label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full bg-[#101214] border border-[#30373D] px-2 py-1.5 text-[#E8ECEF] focus:border-[#D7A84B] focus:outline-none"
              >
                <option value="W">W (Whale)</option>
                <option value="M">M (Medium)</option>
                <option value="S">S (Shrimp)</option>
              </select>
            </div>

            <div>
              <label className="block text-[9px] uppercase text-[#929BA3] mb-1 font-['Geist']">
                Label
              </label>
              <input
                type="text"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                placeholder="Vitalik Main"
                className="w-full bg-[#101214] border border-[#30373D] px-2 py-1.5 text-[#E8ECEF] focus:border-[#D7A84B] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[9px] uppercase text-[#929BA3] mb-1 font-['Geist']">
                Notes
              </label>
              <input
                type="text"
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder="High conviction wallet"
                className="w-full bg-[#101214] border border-[#30373D] px-2 py-1.5 text-[#E8ECEF] focus:border-[#D7A84B] focus:outline-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={updateTagsMutation.isPending}
                className="w-full py-1.5 bg-[#D7A84B] text-[#101214] hover:bg-[#f5c363] font-bold uppercase tracking-wider text-[11px] transition-colors font-['Geist']"
              >
                {updateTagsMutation.isPending ? "Saving..." : "Save Tags"}
              </button>
            </div>
          </form>
        </section>

        {/* Profile Statistics Grid (6 Metric Cards) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {/* Card 1: First Tx Date */}
          <div className="bg-[#171A1D] border border-[#30373D] p-3.5 flex flex-col justify-between">
            <div className="text-[10px] font-semibold text-[#929BA3] uppercase tracking-wider font-['Geist']">
              First Tx Date
            </div>
            <div className="font-mono text-[16px] font-bold text-[#E8ECEF] my-1">
              {firstTxDateFormatted}
            </div>
            <div className="text-[10px] font-mono text-[#929BA3]">
              Wallet genesis timestamp
            </div>
          </div>

          {/* Card 2: Age at 1st Memecoin Trade */}
          <div className="bg-[#171A1D] border border-[#30373D] p-3.5 flex flex-col justify-between">
            <div className="text-[10px] font-semibold text-[#929BA3] uppercase tracking-wider font-['Geist']">
              Age @ 1st Memecoin
            </div>
            <div className="font-mono text-[16px] font-bold text-[#E8ECEF] my-1">
              {firstMemecoinDays}
            </div>
            <div className="text-[10px] font-mono text-[#929BA3]">
              Time to first token trade
            </div>
          </div>

          {/* Card 3: Total Ingested Txs */}
          <div className="bg-[#171A1D] border border-[#30373D] p-3.5 flex flex-col justify-between">
            <div className="text-[10px] font-semibold text-[#929BA3] uppercase tracking-wider font-['Geist']">
              Total Ingested Txs
            </div>
            <div className="font-mono text-[16px] font-bold text-[#E8ECEF] my-1">
              {totalTxs.toLocaleString()}
            </div>
            <div className="text-[10px] font-mono text-[#929BA3]">
              Full indexed tx history
            </div>
          </div>

          {/* Card 4: Distinct Tokens Count */}
          <div className="bg-[#171A1D] border border-[#30373D] p-3.5 flex flex-col justify-between">
            <div className="text-[10px] font-semibold text-[#929BA3] uppercase tracking-wider font-['Geist']">
              Distinct Tokens
            </div>
            <div className="font-mono text-[16px] font-bold text-[#E8ECEF] my-1">
              {distinctTokens}
            </div>
            <div className="text-[10px] font-mono text-[#929BA3]">
              Non-stable traded assets
            </div>
          </div>

          {/* Card 5: Current Parked Stables */}
          <div className="bg-[#171A1D] border border-[#30373D] p-3.5 flex flex-col justify-between">
            <div className="text-[10px] font-semibold text-[#929BA3] uppercase tracking-wider font-['Geist']">
              Parked Stables
            </div>
            <div className="font-mono text-[16px] font-bold text-[#79B79A] my-1">
              {formatUsd(currentParked)}
            </div>
            <div className="text-[10px] font-mono text-[#929BA3]">
              Dry-powder balance
            </div>
          </div>

          {/* Card 6: Dormancy Status */}
          <div className="bg-[#171A1D] border border-[#30373D] p-3.5 flex flex-col justify-between">
            <div className="text-[10px] font-semibold text-[#929BA3] uppercase tracking-wider font-['Geist']">
              Dormancy Status
            </div>
            <div
              className={`font-mono text-[16px] font-bold my-1 flex items-center gap-1.5 ${
                isDormant ? "text-[#D87870]" : "text-[#79B79A]"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isDormant ? "bg-[#D87870]" : "bg-[#79B79A]"
                }`}
              />
              <span>{isDormant ? "DORMANT" : "ACTIVE"}</span>
            </div>
            <div className="text-[10px] font-mono text-[#929BA3]">
              {profile?.lastActivityAt
                ? `Last tx ${new Date(profile.lastActivityAt).toLocaleDateString()}`
                : "No recent activity"}
            </div>
          </div>
        </section>

        {/* Auto-Grade Card (P6-T01, FR-1.4) */}
        <section aria-label="Wallet Auto-Grade">
          <GradeCard
            grade={gradeData ?? (wallet?.profile?.gradeJson as any)}
            isLoading={isGradeLoading}
            onRecompute={() => recomputeGradeMutation.mutate({ address, chain })}
            isRecomputing={recomputeGradeMutation.isPending}
          />
        </section>

        {/* View Switcher / Tabs */}
        <div className="flex items-center border-b border-[#30373D] gap-2 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 text-[12px] font-bold uppercase tracking-wider font-['Geist'] transition-colors border-b-2 ${
              activeTab === "overview"
                ? "border-[#D7A84B] text-[#D7A84B] bg-[#171A1D]"
                : "border-transparent text-[#929BA3] hover:text-[#E8ECEF]"
            }`}
          >
            Activity & Parking Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("funding")}
            className={`px-4 py-2 text-[12px] font-bold uppercase tracking-wider font-['Geist'] transition-colors border-b-2 ${
              activeTab === "funding"
                ? "border-[#D7A84B] text-[#D7A84B] bg-[#171A1D]"
                : "border-transparent text-[#929BA3] hover:text-[#E8ECEF]"
            }`}
          >
            Recursive Funding Tracer & Clusters
          </button>
        </div>

        {/* Tab 1: Activity Heatmap & Parking Timeline */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Activity Heatmap Component */}
            <ActivityHeatmap
              heatmapData={profile?.heatmapJson as any}
              totalTxCount={totalTxs}
            />

            {/* Parking Timeline Component */}
            <ParkingTimeline
              chain={chain}
              address={address}
              parkingData={parkingData as any}
              isLoading={parkingLoading}
            />
          </div>
        )}

        {/* Tab 2: Funding Tree & Shared Funder Clusters with Right Evidence Drawer */}
        {activeTab === "funding" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left 2 Cols: Funding Tree */}
            <div className="lg:col-span-2">
              <FundingTree
                address={address}
                chain={chain}
                onSelectNode={(node) => setSelectedNode(node)}
              />
            </div>

            {/* Right 1 Col: Evidence & Cluster Drawer */}
            <div className="space-y-6">
              {/* Cluster Rollup Card if wallet has a cluster */}
              {cluster && (
                <div className="bg-[#171A1D] border border-[#30373D] p-4 text-[#E8ECEF]">
                  <div className="flex items-center justify-between pb-3 border-b border-[#30373D] mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px]">HUB</span>
                      <span className="font-bold text-[13px] text-[#D7A84B] font-['Geist'] uppercase">
                        {cluster.name || `Cluster #${cluster.id.slice(0, 4)}`}
                      </span>
                    </div>
                    <Link
                      href={`/clusters/${cluster.id}`}
                      className="text-[10px] font-mono text-[#929BA3] hover:text-[#D7A84B] underline"
                    >
                      View Detail ↗
                    </Link>
                  </div>

                  <div className="space-y-3 font-mono text-[11px]">
                    <div>
                      <div className="text-[#929BA3] text-[9px] uppercase font-['Geist']">
                        Combined Parked Stables
                      </div>
                      <div className="text-[18px] font-bold text-[#79B79A]">
                        {formatUsd(cluster.combinedStableUsd)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[#929BA3] text-[9px] uppercase font-['Geist'] mb-1">
                        Shared Funder Origin
                      </div>
                      <div className="text-[#E8ECEF] bg-[#101214] p-1.5 border border-[#30373D] truncate">
                        {cluster.funderAddress}
                      </div>
                    </div>

                    <div>
                      <div className="text-[#929BA3] text-[9px] uppercase font-['Geist'] mb-1">
                        Discovered At
                      </div>
                      <div className="text-[#929BA3]">
                        {new Date(cluster.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Custom Entity Label Editor (for selected tree node or current wallet) */}
              <EntityLabelEditor
                address={selectedNode ? selectedNode.address : address}
                chain={selectedNode ? selectedNode.chain : chain}
                currentLabel={
                  selectedNode
                    ? {
                        name: selectedNode.entityName || selectedNode.label || "",
                        kind: selectedNode.entityKind || "CEX",
                        isTerminal: selectedNode.isTerminalEntity,
                      }
                    : {
                        name: wallet.label || "",
                        kind: "CEX",
                        isTerminal: false,
                      }
                }
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}