// src/components/self/PnlBreakdown.tsx
"use client";

import React, { useState } from "react";
import type {
  FollowedWalletPnlSummary,
  TokenPnlSummary,
} from "@/server/services/self/dashboard";
import type { EdgeDecayBucket } from "@/server/services/self/decay";

interface PnlBreakdownProps {
  byFollowedWallet: FollowedWalletPnlSummary[];
  byToken: TokenPnlSummary[];
  byLagBucket: EdgeDecayBucket[];
}

export function PnlBreakdown({
  byFollowedWallet,
  byToken,
  byLagBucket,
}: PnlBreakdownProps) {
  const [activeTab, setActiveTab] = useState<"wallet" | "token" | "lag">("wallet");

  return (
    <div className="bg-[#171A1D] border border-[#30373D] p-5 space-y-4">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#30373D] pb-3">
        <div>
          <h3 className="text-[14px] font-mono font-semibold uppercase text-[#E8ECEF] flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-[#D7A84B]"></span>
            PERSONAL PnL BREAKDOWN (FR-6.5)
          </h3>
          <p className="text-[12px] font-mono text-[#929BA3] mt-0.5">
            Profitability segmented by followed signal, asset, and entry latency
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex border border-[#30373D] bg-[#101214]">
          <button
            type="button"
            onClick={() => setActiveTab("wallet")}
            className={`px-3 py-1.5 text-[11px] font-mono font-semibold uppercase transition-colors ${
              activeTab === "wallet"
                ? "bg-[#D7A84B] text-[#101214]"
                : "text-[#929BA3] hover:text-[#E8ECEF]"
            }`}
          >
            BY FOLLOWED WALLET
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("token")}
            className={`px-3 py-1.5 text-[11px] font-mono font-semibold uppercase transition-colors border-l border-[#30373D] ${
              activeTab === "token"
                ? "bg-[#D7A84B] text-[#101214]"
                : "text-[#929BA3] hover:text-[#E8ECEF]"
            }`}
          >
            BY TOKEN
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("lag")}
            className={`px-3 py-1.5 text-[11px] font-mono font-semibold uppercase transition-colors border-l border-[#30373D] ${
              activeTab === "lag"
                ? "bg-[#D7A84B] text-[#101214]"
                : "text-[#929BA3] hover:text-[#E8ECEF]"
            }`}
          >
            BY LAG BUCKET
          </button>
        </div>
      </div>

      {/* Tab 1: By Followed Wallet */}
      {activeTab === "wallet" && (
        <div className="border border-[#30373D] bg-[#101214] overflow-x-auto">
          <table className="w-full text-left text-[12px] font-mono border-collapse">
            <thead>
              <tr className="border-b border-[#30373D] text-[#929BA3] text-[11px] uppercase bg-[#171A1D]">
                <th className="p-3">FOLLOWED WALLET</th>
                <th className="p-3">CHAIN</th>
                <th className="p-3 text-right">LINKED TRADES</th>
                <th className="p-3 text-right">AVG FOLLOW LAG</th>
                <th className="p-3 text-right">NET REALIZED PnL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30373D]/60 text-[#E8ECEF]">
              {byFollowedWallet.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-[#929BA3]">
                    No followed wallet executions linked yet.
                  </td>
                </tr>
              ) : (
                byFollowedWallet.map((fw) => {
                  const pnlNum = Number(fw.pnlUsd);
                  return (
                    <tr key={`${fw.chain}-${fw.address}`} className="hover:bg-[#1E2327]">
                      <td className="p-3 font-semibold text-[#D7A84B]">
                        {fw.label || `${fw.address.slice(0, 8)}...${fw.address.slice(-6)}`}
                      </td>
                      <td className="p-3 uppercase text-[#929BA3]">{fw.chain}</td>
                      <td className="p-3 text-right">{fw.tradeCount}</td>
                      <td className="p-3 text-right text-[#929BA3]">
                        {fw.avgLagMinutes !== null ? `${fw.avgLagMinutes}m` : "—"}
                      </td>
                      <td
                        className={`p-3 text-right font-semibold ${
                          pnlNum >= 0 ? "text-[#79B79A]" : "text-[#D87870]"
                        }`}
                      >
                        {pnlNum >= 0 ? `+$${pnlNum.toFixed(2)}` : `-$${Math.abs(pnlNum).toFixed(2)}`}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: By Token */}
      {activeTab === "token" && (
        <div className="border border-[#30373D] bg-[#101214] overflow-x-auto">
          <table className="w-full text-left text-[12px] font-mono border-collapse">
            <thead>
              <tr className="border-b border-[#30373D] text-[#929BA3] text-[11px] uppercase bg-[#171A1D]">
                <th className="p-3">TOKEN SYMBOL</th>
                <th className="p-3">ADDRESS</th>
                <th className="p-3">CHAIN</th>
                <th className="p-3 text-right">TOTAL TRADES</th>
                <th className="p-3 text-right">NET REALIZED PnL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30373D]/60 text-[#E8ECEF]">
              {byToken.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-[#929BA3]">
                    No token activity recorded yet.
                  </td>
                </tr>
              ) : (
                byToken.map((tp) => {
                  const pnlNum = Number(tp.pnlUsd);
                  return (
                    <tr key={`${tp.chain}-${tp.tokenAddress}`} className="hover:bg-[#1E2327]">
                      <td className="p-3 font-semibold text-[#D7A84B]">
                        {tp.symbol || "TOKEN"}
                      </td>
                      <td className="p-3 text-[#929BA3]">
                        {tp.tokenAddress.slice(0, 8)}...{tp.tokenAddress.slice(-6)}
                      </td>
                      <td className="p-3 uppercase text-[#929BA3]">{tp.chain}</td>
                      <td className="p-3 text-right">{tp.tradeCount}</td>
                      <td
                        className={`p-3 text-right font-semibold ${
                          pnlNum >= 0 ? "text-[#79B79A]" : "text-[#D87870]"
                        }`}
                      >
                        {pnlNum >= 0 ? `+$${pnlNum.toFixed(2)}` : `-$${Math.abs(pnlNum).toFixed(2)}`}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: By Lag Bucket */}
      {activeTab === "lag" && (
        <div className="border border-[#30373D] bg-[#101214] overflow-x-auto">
          <table className="w-full text-left text-[12px] font-mono border-collapse">
            <thead>
              <tr className="border-b border-[#30373D] text-[#929BA3] text-[11px] uppercase bg-[#171A1D]">
                <th className="p-3">LAG BUCKET</th>
                <th className="p-3 text-right">EXECUTIONS</th>
                <th className="p-3 text-right">AVG USER ROI</th>
                <th className="p-3 text-right">WIN RATE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30373D]/60 text-[#E8ECEF]">
              {byLagBucket.map((b) => {
                const isGolden = b.bucket === "0-1h";
                return (
                  <tr
                    key={b.bucket}
                    className={`transition-colors ${
                      isGolden
                        ? "bg-[#D7A84B]/10 hover:bg-[#D7A84B]/20"
                        : "hover:bg-[#1E2327]"
                    }`}
                  >
                    <td className="p-3 font-semibold flex items-center gap-1.5">
                      {isGolden && <span className="text-[#D7A84B]">★</span>}
                      <span className={isGolden ? "text-[#D7A84B]" : ""}>
                        {b.bucket}
                      </span>
                    </td>
                    <td className="p-3 text-right">{b.tradeCount}</td>
                    <td
                      className={`p-3 text-right font-semibold ${
                        b.avgUserRoiPct !== null
                          ? Number(b.avgUserRoiPct) >= 0
                            ? "text-[#79B79A]"
                            : "text-[#D87870]"
                          : "text-[#929BA3]"
                      }`}
                    >
                      {b.avgUserRoiPct !== null ? `${b.avgUserRoiPct}%` : "—"}
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {b.winRatePct !== null ? `${b.winRatePct}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
