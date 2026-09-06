// src/components/self/ComparisonTable.tsx
"use client";

import React, { useState } from "react";
import type { TradeComparisonItem } from "@/server/services/self/comparison";

interface ComparisonTableProps {
  items: TradeComparisonItem[];
  isLoading?: boolean;
}

export function ComparisonTable({ items, isLoading = false }: ComparisonTableProps) {
  const [sortBy, setSortBy] = useState<"timestamp" | "lagMinutes" | "roiGap" | "amountUsd">("timestamp");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const sortedItems = [...items].sort((a, b) => {
    let diff = 0;
    if (sortBy === "lagMinutes") {
      const aVal = a.lagMinutes ?? (sortOrder === "asc" ? Infinity : -Infinity);
      const bVal = b.lagMinutes ?? (sortOrder === "asc" ? Infinity : -Infinity);
      diff = aVal - bVal;
    } else if (sortBy === "roiGap") {
      const aVal = a.roiGapPct ? Number(a.roiGapPct) : (sortOrder === "asc" ? Infinity : -Infinity);
      const bVal = b.roiGapPct ? Number(b.roiGapPct) : (sortOrder === "asc" ? Infinity : -Infinity);
      diff = aVal - bVal;
    } else if (sortBy === "amountUsd") {
      diff = Number(a.amountUsd) - Number(b.amountUsd);
    } else {
      diff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    }
    return sortOrder === "asc" ? diff : -diff;
  });

  return (
    <div className="bg-[#171A1D] border border-[#30373D] p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#30373D] pb-3">
        <div>
          <h3 className="text-[14px] font-mono font-semibold uppercase text-[#E8ECEF] flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-[#D7A84B]"></span>
            EXECUTION COMPARISON VIEW (FR-6.6)
          </h3>
          <p className="text-[12px] font-mono text-[#929BA3] mt-0.5">
            User ROI vs Followed Wallet ROI per linked trade (Did I capture the edge or arrive after it decayed?)
          </p>
        </div>

        <div className="text-[11px] font-mono text-[#929BA3]">
          SHOWING {items.length} LINKED EXECUTIONS
        </div>
      </div>

      <div className="border border-[#30373D] bg-[#101214] overflow-x-auto">
        <table className="w-full text-left text-[12px] font-mono border-collapse">
          <thead>
            <tr className="border-b border-[#30373D] text-[#929BA3] text-[11px] uppercase bg-[#171A1D]">
              <th
                className="p-3 cursor-pointer hover:text-[#E8ECEF]"
                onClick={() => handleSort("timestamp")}
              >
                TIMESTAMP {sortBy === "timestamp" && (sortOrder === "asc" ? "▲" : "▼")}
              </th>
              <th className="p-3">TOKEN</th>
              <th className="p-3">FOLLOWED SIGNAL</th>
              <th
                className="p-3 cursor-pointer hover:text-[#E8ECEF]"
                onClick={() => handleSort("lagMinutes")}
              >
                ENTRY LAG {sortBy === "lagMinutes" && (sortOrder === "asc" ? "▲" : "▼")}
              </th>
              <th className="p-3 text-right">MC DELTA</th>
              <th className="p-3 text-right">USER ROI</th>
              <th className="p-3 text-right">WALLET ROI</th>
              <th
                className="p-3 text-center cursor-pointer hover:text-[#E8ECEF]"
                onClick={() => handleSort("roiGap")}
              >
                VERDICT {sortBy === "roiGap" && (sortOrder === "asc" ? "▲" : "▼")}
              </th>
              <th className="p-3">THESIS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#30373D]/60 text-[#E8ECEF]">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="p-4 text-center text-[#929BA3]">
                  Loading comparison records...
                </td>
              </tr>
            ) : sortedItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-[#929BA3]">
                  No linked executions found. Either log manual trades with followed signals or ingest trades on monitored self wallets.
                </td>
              </tr>
            ) : (
              sortedItems.map((item) => (
                <tr key={item.id} className="hover:bg-[#1E2327] transition-colors">
                  <td className="p-3 text-[#929BA3]">
                    {new Date(item.timestamp).toISOString().replace("T", " ").slice(0, 16)}
                  </td>
                  <td className="p-3">
                    <span className="font-semibold text-[#D7A84B]">
                      {item.tokenSymbol || "TOKEN"}
                    </span>
                    <span className="text-[#929BA3] text-[10px] ml-1">
                      ({item.tokenAddress.slice(0, 6)}...{item.tokenAddress.slice(-4)})
                    </span>
                  </td>
                  <td className="p-3">
                    {item.followedWalletAddress ? (
                      <div className="flex items-center gap-1.5">
                        {item.isLinkPinned && <span title="Pinned by user">📌</span>}
                        <span>
                          {item.followedWalletLabel ||
                            `${item.followedWalletAddress.slice(0, 6)}...${item.followedWalletAddress.slice(-4)}`}
                        </span>
                        <span className="text-[10px] uppercase text-[#929BA3]">
                          [{item.followedWalletChain}]
                        </span>
                      </div>
                    ) : (
                      <span className="text-[#929BA3]">Unlinked</span>
                    )}
                  </td>
                  <td className="p-3 font-semibold">
                    {item.lagMinutes !== null ? (
                      <span
                        className={
                          item.lagMinutes < 60
                            ? "text-[#D7A84B]"
                            : "text-[#E8ECEF]"
                        }
                      >
                        {item.lagMinutes}m ({item.lagBucket || "—"})
                      </span>
                    ) : (
                      <span className="text-[#929BA3]">—</span>
                    )}
                  </td>
                  <td className="p-3 text-right text-[#929BA3]">
                    {item.lagMcDelta !== null ? (
                      <span>
                        {Number(item.lagMcDelta) >= 0 ? "+" : ""}
                        ${Number(item.lagMcDelta).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td
                    className={`p-3 text-right font-semibold ${
                      item.userRoiPct !== null
                        ? Number(item.userRoiPct) >= 0
                          ? "text-[#79B79A]"
                          : "text-[#D87870]"
                        : "text-[#929BA3]"
                    }`}
                  >
                    {item.userRoiPct !== null ? `${item.userRoiPct}%` : "—"}
                  </td>
                  <td className="p-3 text-right text-[#929BA3]">
                    {item.walletRoiPct !== null ? `${item.walletRoiPct}%` : "—"}
                  </td>
                  <td className="p-3 text-center">
                    {item.verdict === "CAPTURED" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase bg-[#D7A84B]/10 text-[#D7A84B] border border-[#D7A84B]">
                        ● CAPTURED
                      </span>
                    ) : item.verdict === "DECAYED" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase bg-[#D87870]/10 text-[#D87870] border border-[#D87870]">
                        ○ DECAYED
                      </span>
                    ) : (
                      <span className="text-[#929BA3] text-[11px]">—</span>
                    )}
                  </td>
                  <td className="p-3 max-w-[200px] truncate text-[#929BA3]" title={item.thesis || ""}>
                    {item.thesis || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
