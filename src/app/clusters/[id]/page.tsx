"use client";

import React, { use } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";

interface PageProps {
  params: Promise<{
    id: string;
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

function getClusterColor(id: string): string {
  const colors = ["#D7A84B", "#79B79A", "#85621F", "#5DADE2", "#AF7AC5", "#E59866"];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index] || "#D7A84B";
}

export default function ClusterDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const clusterId = resolvedParams.id;

  const { data: cluster, isLoading, error } = trpc.cluster.get.useQuery({
    id: clusterId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#101214] text-[#E8ECEF] flex items-center justify-center p-8 font-mono text-[13px] text-[#929BA3]">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-[#D7A84B] border-t-transparent animate-spin mx-auto mb-3" />
          <span>Loading cluster #{clusterId.slice(0, 8)} details...</span>
        </div>
      </div>
    );
  }

  if (error || !cluster) {
    return (
      <div className="min-h-screen bg-[#101214] text-[#E8ECEF] p-8 max-w-4xl mx-auto">
        <div className="p-6 bg-[#171A1D] border border-[#D87870]">
          <div className="font-bold text-[14px] text-[#D87870] uppercase tracking-wider mb-2 font-['Geist']">
            Cluster Not Found
          </div>
          <div className="text-[12px] font-mono text-[#929BA3] mb-4">
            Could not find cluster ID: {clusterId}
          </div>
          <Link
            href="/clusters"
            className="inline-block px-4 py-2 bg-[#D7A84B] text-[#101214] text-[11px] font-bold uppercase font-['Geist']"
          >
            ← Return to Clusters Index
          </Link>
        </div>
      </div>
    );
  }

  const color = getClusterColor(cluster.id);
  const members = cluster.members ?? [];

  return (
    <div className="min-h-screen bg-[#101214] text-[#E8ECEF] pb-16">
      {/* Top Header */}
      <header className="border-b border-[#30373D] bg-[#171A1D] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-[11px] text-[#929BA3]">
          <Link href="/" className="hover:text-[#D7A84B] transition-colors">
            WATCHTOWER
          </Link>
          <span className="text-[#30373D]">/</span>
          <Link href="/clusters" className="hover:text-[#D7A84B] transition-colors">
            CLUSTERS
          </Link>
          <span className="text-[#30373D]">/</span>
          <span className="text-[#D7A84B] font-semibold">{cluster.name || cluster.id.slice(0, 8)}</span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/clusters"
            className="text-[11px] font-mono text-[#929BA3] hover:text-[#D7A84B] transition-colors"
          >
            ← All Clusters
          </Link>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto p-4 md:p-6 space-y-6">
        {/* Cluster Header & Overview Card */}
        <section className="bg-[#171A1D] border border-[#30373D] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className="w-5 h-5 border border-[#101214] mt-1 shrink-0"
              style={{ backgroundColor: color }}
            />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-[22px] font-bold text-[#E8ECEF] font-['Geist']">
                  {cluster.name || `Cluster #${cluster.id.slice(0, 8)}`}
                </h1>
                <span className="px-2 py-0.5 border border-[#D7A84B] bg-[#4A3A1A]/30 text-[#D7A84B] text-[10px] font-mono uppercase font-bold">
                  SHARED FUNDER
                </span>
              </div>
              <div className="text-[11px] font-mono text-[#929BA3] mt-1">
                Funder Origin:{" "}
                <span className="text-[#E8ECEF]">{cluster.funderAddress || "—"}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 font-mono text-[12px]">
            <div className="bg-[#101214] border border-[#30373D] px-3 py-1.5">
              <span className="text-[10px] text-[#929BA3] block uppercase font-['Geist']">Members</span>
              <span className="text-[15px] font-bold text-[#E8ECEF]">{members.length}</span>
            </div>

            <div className="bg-[#101214] border border-[#30373D] px-3 py-1.5">
              <span className="text-[10px] text-[#929BA3] block uppercase font-['Geist']">Combined Stables</span>
              <span className="text-[15px] font-bold text-[#79B79A]">
                {formatUsd(cluster.combinedStableUsd)}
              </span>
            </div>
          </div>
        </section>

        {/* Member Wallets Table */}
        <section className="bg-[#171A1D] border border-[#30373D]">
          <div className="p-3.5 border-b border-[#30373D] flex items-center justify-between text-[11px] font-semibold text-[#D7A84B] uppercase font-['Geist']">
            <span>Cluster Member Wallets ({members.length})</span>
          </div>

          {members.length === 0 ? (
            <div className="p-8 text-center font-mono text-[12px] text-[#929BA3]">
              No members enrolled in this cluster.
            </div>
          ) : (
            <div className="divide-y divide-[#30373D]/60 font-mono text-[12px]">
              {/* Header */}
              <div className="grid grid-cols-[1fr_100px_140px_140px_100px] gap-4 p-3 bg-[#101214] text-[10px] font-semibold uppercase text-[#929BA3] font-['Geist']">
                <span>Wallet Identity / Address</span>
                <span>Chain</span>
                <span className="text-right">Parked Stables</span>
                <span className="text-right">Total Txs</span>
                <span className="text-right">Profile</span>
              </div>

              {members.map((member) => {
                const w = member.wallet;
                const profile = w?.profile;
                const chainSlug = (member.walletChain?.toLowerCase() ?? "base");

                return (
                  <div
                    key={`${member.walletAddress}-${member.walletChain}`}
                    className="grid grid-cols-[1fr_100px_140px_140px_100px] gap-4 p-3 items-center hover:bg-[#1E2327]/60 transition-colors"
                  >
                    {/* Wallet Identity / Address */}
                    <div>
                      <div className="flex items-center gap-2">
                        {w?.ensName && (
                          <span className="font-bold text-[#E8ECEF] font-['Geist'] text-[13px]">
                            {w.ensName}
                          </span>
                        )}
                        {w?.label && !w.ensName && (
                          <span className="font-bold text-[#D7A84B] font-['Geist'] text-[13px]">
                            {w.label}
                          </span>
                        )}
                        <span className="text-[#929BA3]">{shortenAddress(member.walletAddress)}</span>
                      </div>
                      {(w?.edge || w?.style || w?.size) && (
                        <div className="text-[10px] text-[#D7A84B] mt-0.5">
                          {w.edge || "RAW"}-{w.style || "UNSET"} [{w.size || "S"}]
                        </div>
                      )}
                    </div>

                    {/* Chain */}
                    <div>
                      <span className="px-2 py-0.5 bg-[#101214] border border-[#30373D] uppercase text-[10px]">
                        {chainSlug}
                      </span>
                    </div>

                    {/* Parked Stables */}
                    <div className="text-right font-semibold text-[#79B79A]">
                      {formatUsd(profile?.stableBalanceUsd ?? "0")}
                    </div>

                    {/* Total Txs */}
                    <div className="text-right text-[#E8ECEF]">
                      {(profile?.txCount ?? 0).toLocaleString()}
                    </div>

                    {/* Link to Profile */}
                    <div className="text-right">
                      <Link
                        href={`/wallets/${chainSlug}/${member.walletAddress}`}
                        className="px-2.5 py-1 bg-[#101214] border border-[#30373D] hover:border-[#D7A84B] text-[#D7A84B] text-[11px] font-semibold uppercase"
                      >
                        Profile ↗
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}