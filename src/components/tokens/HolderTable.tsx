"use client";

import React from "react";
import Link from "next/link";
import type { TrackedHolderSummary } from "@/server/services/token/lookup";
import type { ChainSlug } from "@/lib/chains/types";

interface HolderTableProps {
  holders: TrackedHolderSummary[];
  chain: ChainSlug;
  isLoading?: boolean;
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function HolderTable({ holders, chain, isLoading }: HolderTableProps) {
  if (isLoading) {
    return (
      <div className="bg-[#171A1D] border border-[#30373D] p-5">
        <div className="font-mono text-xs text-[#929BA3] animate-pulse">
          Loading tracked-wallet holders...
        </div>
      </div>
    );
  }

  if (holders.length === 0) {
    return (
      <div className="bg-[#171A1D] border border-[#30373D] p-6 text-center">
        <div className="text-xs font-mono text-[#929BA3]">
          No tracked wallets have recorded positions or executions for this token.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#171A1D] border border-[#30373D] overflow-hidden">
      <div className="p-4 border-b border-[#30373D] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#E8ECEF] font-['Geist']">
            Tracked-Wallet Holders
          </span>
          <span className="px-2 py-0.5 bg-[#101214] border border-[#30373D] font-mono text-[11px] text-[#D7A84B]">
            {holders.length} tracked
          </span>
        </div>
        <span className="text-[11px] font-mono text-[#929BA3]">
          Sorted by entry recency
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-xs">
          <thead className="bg-[#101214] border-b border-[#30373D] text-[10px] uppercase text-[#929BA3]">
            <tr>
              <th className="py-2.5 px-4 font-semibold">Wallet / ENS</th>
              <th className="py-2.5 px-4 font-semibold">Grade</th>
              <th className="py-2.5 px-4 font-semibold">Computed Label</th>
              <th className="py-2.5 px-4 font-semibold text-right">Entry MC</th>
              <th className="py-2.5 px-4 font-semibold">Status</th>
              <th className="py-2.5 px-4 font-semibold text-right">Holdings USD</th>
              <th className="py-2.5 px-4 font-semibold text-right">Tracked Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#30373D]">
            {holders.map((holder) => {
              const gradeObj = holder.grade as any;
              const hasGrade = gradeObj && gradeObj.available;
              const winRate = hasGrade && gradeObj.winRatePct !== null ? `${gradeObj.winRatePct}%` : "—";

              return (
                <tr key={holder.walletAddress} className="hover:bg-[#1E2327]/60 transition-colors">
                  {/* Wallet / ENS */}
                  <td className="py-3 px-4">
                    <Link
                      href={`/wallets/${chain}/${holder.walletAddress}`}
                      className="text-[#E8ECEF] hover:text-[#D7A84B] font-semibold flex items-center gap-1.5"
                    >
                      <span>{holder.ensName || shortenAddress(holder.walletAddress)}</span>
                      <span className="text-[10px] text-[#929BA3]">↗</span>
                    </Link>
                  </td>

                  {/* Grade */}
                  <td className="py-3 px-4">
                    {hasGrade ? (
                      <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 bg-[#101214] border border-[#79B79A]/40 text-[#79B79A]">
                        <span>WR {winRate}</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#929BA3]">—</span>
                    )}
                  </td>

                  {/* Computed Label */}
                  <td className="py-3 px-4">
                    {holder.label ? (
                      <span className="text-[11px] px-2 py-0.5 bg-[#101214] border border-[#30373D] text-[#D7A84B]">
                        {holder.label}
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#929BA3]">UNTAGGED</span>
                    )}
                  </td>

                  {/* Entry MC */}
                  <td className="py-3 px-4 text-right text-[#E8ECEF]">
                    {holder.entryMarketCap ? (
                      `$${Number(holder.entryMarketCap).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
                    ) : (
                      <span className="text-[#929BA3]">—</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4">
                    {holder.status === "HOLDING" && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-[#79B79A]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#79B79A]" />
                        HOLDING
                      </span>
                    )}
                    {holder.status === "DISTRIBUTED" && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-[#D7A84B]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D7A84B]" />
                        DISTRIBUTED
                      </span>
                    )}
                    {holder.status === "EXITED" && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-[#D87870]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D87870]" />
                        EXITED
                      </span>
                    )}
                  </td>

                  {/* Holdings USD */}
                  <td className="py-3 px-4 text-right font-semibold text-[#E8ECEF]">
                    ${Number(holder.holdingsUsd).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  {/* Tracked Share */}
                  <td className="py-3 px-4 text-right text-[#D7A84B]">
                    {holder.status !== "EXITED" ? `${holder.shareOfTrackedPct}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
