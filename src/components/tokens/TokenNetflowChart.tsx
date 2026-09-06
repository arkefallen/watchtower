"use client";

import React from "react";
import type { TokenNetflowSummary } from "@/server/services/token/lookup";

interface TokenNetflowChartProps {
  netflow: TokenNetflowSummary;
  symbol?: string | null;
}

export function TokenNetflowChart({ netflow, symbol = "Token" }: TokenNetflowChartProps) {
  const { window24h, window7d, window30d, history } = netflow;

  const maxAbsoluteNet = Math.max(
    ...history.map((h) => Math.max(h.buyUsd, h.sellUsd)),
    1000
  );

  return (
    <div className="bg-[#171A1D] border border-[#30373D] p-5">
      <div className="flex items-center justify-between border-b border-[#30373D] pb-3 mb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#E8ECEF] font-['Geist'] block">
            Tracked-Wallet Netflow Analytics
          </span>
          <span className="text-[10px] font-mono text-[#929BA3]">
            Aggregate buy vs sell volume across all monitored wallets
          </span>
        </div>
      </div>

      {/* 3 Window KPI Cards: 24h / 7d / 30d */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5 font-mono text-xs">
        {/* 24h */}
        <div className="bg-[#101214] border border-[#30373D] p-3">
          <div className="text-[10px] text-[#929BA3] uppercase mb-1">24-Hour Netflow</div>
          <div className="text-base font-bold">
            <span className={window24h.netUsd >= 0 ? "text-[#79B79A]" : "text-[#D87870]"}>
              {window24h.netUsd >= 0 ? "+" : ""}${window24h.netUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="text-[10px] text-[#929BA3] mt-1 flex justify-between">
            <span>Buy: ${window24h.buyUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
            <span>Sell: ${window24h.sellUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
          </div>
        </div>

        {/* 7d */}
        <div className="bg-[#101214] border border-[#30373D] p-3">
          <div className="text-[10px] text-[#929BA3] uppercase mb-1">7-Day Netflow</div>
          <div className="text-base font-bold">
            <span className={window7d.netUsd >= 0 ? "text-[#79B79A]" : "text-[#D87870]"}>
              {window7d.netUsd >= 0 ? "+" : ""}${window7d.netUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="text-[10px] text-[#929BA3] mt-1 flex justify-between">
            <span>Buy: ${window7d.buyUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
            <span>Sell: ${window7d.sellUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
          </div>
        </div>

        {/* 30d */}
        <div className="bg-[#101214] border border-[#30373D] p-3">
          <div className="text-[10px] text-[#929BA3] uppercase mb-1">30-Day Netflow</div>
          <div className="text-base font-bold">
            <span className={window30d.netUsd >= 0 ? "text-[#79B79A]" : "text-[#D87870]"}>
              {window30d.netUsd >= 0 ? "+" : ""}${window30d.netUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="text-[10px] text-[#929BA3] mt-1 flex justify-between">
            <span>Buy: ${window30d.buyUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
            <span>Sell: ${window30d.sellUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
          </div>
        </div>
      </div>

      {/* Daily Visual Flow Chart / Breakdown */}
      {history.length > 0 ? (
        <div className="space-y-2">
          <div className="text-[11px] font-mono text-[#929BA3] uppercase mb-2">
            Historical Daily Inflow / Outflow
          </div>
          <div className="space-y-1.5 font-mono text-[11px]">
            {history.slice(-10).map((row) => {
              const buyWidth = Math.min(100, Math.round((row.buyUsd / maxAbsoluteNet) * 100));
              const sellWidth = Math.min(100, Math.round((row.sellUsd / maxAbsoluteNet) * 100));

              return (
                <div
                  key={row.date}
                  className="bg-[#101214] border border-[#30373D] p-2 flex items-center justify-between gap-3"
                >
                  <span className="w-24 text-[#929BA3]">{row.date}</span>

                  <div className="flex-1 flex items-center gap-2">
                    {/* Buy Bar */}
                    <div className="flex-1 bg-[#171A1D] h-2 flex justify-end">
                      <div
                        className="bg-[#79B79A] h-full"
                        style={{ width: `${buyWidth}%` }}
                        title={`Buy: $${row.buyUsd}`}
                      />
                    </div>
                    {/* Sell Bar */}
                    <div className="flex-1 bg-[#171A1D] h-2">
                      <div
                        className="bg-[#D87870] h-full"
                        style={{ width: `${sellWidth}%` }}
                        title={`Sell: $${row.sellUsd}`}
                      />
                    </div>
                  </div>

                  <span
                    className={`w-24 text-right font-semibold ${
                      row.netUsd >= 0 ? "text-[#79B79A]" : "text-[#D87870]"
                    }`}
                  >
                    {row.netUsd >= 0 ? "+" : ""}${row.netUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-4 bg-[#101214] border border-[#30373D] text-center text-xs font-mono text-[#929BA3]">
          No movement events recorded for {symbol} across monitored wallets.
        </div>
      )}
    </div>
  );
}
