"use client";

import React from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";

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

// Generate deterministic cluster color from cluster id
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

export default function ClustersIndexPage() {
  const { data: clusters, isLoading, error, refetch } = trpc.cluster.list.useQuery();

  return (
    <div className="min-h-screen bg-[#101214] text-[#E8ECEF] pb-16">
      {/* Top Header */}
      <header className="border-b border-[#30373D] bg-[#171A1D] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-[11px] text-[#929BA3]">
          <Link href="/" className="hover:text-[#D7A84B] transition-colors">
            WATCHTOWER
          </Link>
          <span className="text-[#30373D]">/</span>
          <span className="text-[#D7A84B] font-semibold">CLUSTERS</span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/wallets"
            className="text-[11px] font-mono text-[#929BA3] hover:text-[#D7A84B] transition-colors"
          >
            ← Wallets Registry
          </Link>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto p-4 md:p-6 space-y-6">
        {/* Page Title & Mission Banner */}
        <div className="bg-[#171A1D] border border-[#30373D] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[14px] text-[#D7A84B]">HUB</span>
              <h1 className="text-[20px] font-bold text-[#E8ECEF] font-['Geist'] uppercase tracking-wider">
                Syndicate & Shared Funder Clusters
              </h1>
            </div>
            <div className="text-[11px] text-[#929BA3] font-mono mt-1">
              Deterministic wallet groupings identified by shared upstream funding lineages or co-rotations.
            </div>
          </div>

          <div className="font-mono text-[12px] bg-[#101214] border border-[#30373D] px-3 py-1.5 text-[#929BA3]">
            Tracked Clusters:{" "}
            <strong className="text-[#E8ECEF]">{clusters?.length ?? 0}</strong>
          </div>
        </div>

        {/* Clusters List / Table */}
        <div className="bg-[#171A1D] border border-[#30373D]">
          <div className="p-3.5 border-b border-[#30373D] flex items-center justify-between text-[11px] font-semibold text-[#D7A84B] uppercase font-['Geist']">
            <span>Cluster Registry ({clusters?.length ?? 0})</span>
            <button
              type="button"
              onClick={() => refetch()}
              className="font-mono text-[10px] text-[#929BA3] hover:text-[#E8ECEF]"
            >
              Refresh
            </button>
          </div>

          {isLoading ? (
            <div className="p-12 text-center font-mono text-[12px] text-[#929BA3]">
              <div className="inline-block w-5 h-5 border-2 border-[#D7A84B] border-t-transparent animate-spin mb-2" />
              <div>Loading shared funder clusters...</div>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-[12px] font-mono text-[#D87870]">
              Failed to load clusters: {error.message}
            </div>
          ) : !clusters || clusters.length === 0 ? (
            <div className="p-12 text-center text-[12px] font-mono border border-dashed border-[#30373D] m-4 text-[#929BA3]">
              No shared funder clusters detected yet. When 2 or more tracked wallets share an upstream funding address, clusters will populate automatically.
            </div>
          ) : (
            <div className="divide-y divide-[#30373D]/60 font-mono text-[12px]">
              {/* Header row */}
              <div className="grid grid-cols-[auto_1fr_120px_160px_100px] gap-4 p-3 bg-[#101214] text-[10px] font-semibold uppercase text-[#929BA3] font-['Geist']">
                <span>Color</span>
                <span>Cluster Name / Funder Origin</span>
                <span className="text-right">Members</span>
                <span className="text-right">Combined Stables</span>
                <span className="text-right">Action</span>
              </div>

              {clusters.map((cluster) => {
                const color = getClusterColor(cluster.id);
                return (
                  <div
                    key={cluster.id}
                    className="grid grid-cols-[auto_1fr_120px_160px_100px] gap-4 p-3 items-center hover:bg-[#1E2327]/60 transition-colors"
                  >
                    {/* Color Chip */}
                    <div className="flex items-center">
                      <span
                        className="w-3.5 h-3.5 border border-[#101214]"
                        style={{ backgroundColor: color }}
                        title={`Cluster Color: ${color}`}
                      />
                    </div>

                    {/* Cluster Name & Shared Funder */}
                    <div>
                      <Link
                        href={`/clusters/${cluster.id}`}
                        className="text-[13px] font-bold text-[#E8ECEF] hover:text-[#D7A84B] transition-colors font-['Geist']"
                      >
                        {cluster.name || `Cluster #${cluster.id.slice(0, 4)}`}
                      </Link>
                      <div className="text-[11px] text-[#929BA3] mt-0.5">
                        Shared Funder:{" "}
                        <span className="text-[#E8ECEF] font-mono">
                          {cluster.funderAddress ? shortenAddress(cluster.funderAddress) : "—"}
                        </span>
                      </div>
                    </div>

                    {/* Member Count */}
                    <div className="text-right text-[#E8ECEF]">
                      <span className="px-2 py-0.5 bg-[#101214] border border-[#30373D] text-[11px]">
                        {cluster.members?.length ?? 0} wallets
                      </span>
                    </div>

                    {/* Combined Stable Balance */}
                    <div className="text-right font-semibold text-[#79B79A]">
                      {formatUsd(cluster.combinedStableUsd)}
                    </div>

                    {/* Action Link */}
                    <div className="text-right">
                      <Link
                        href={`/clusters/${cluster.id}`}
                        className="px-2.5 py-1 bg-[#101214] border border-[#30373D] hover:border-[#D7A84B] text-[#D7A84B] text-[11px] font-semibold uppercase"
                      >
                        Inspect ↗
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}