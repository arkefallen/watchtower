"use client";

import React, { useMemo } from "react";
import { CHAIN_REGISTRY } from "@/lib/chains/registry";
import type { ChainSlug } from "@/lib/chains/types";

export interface ParkingEventItem {
  walletAddress: string;
  chain: string;
  tokenAddress: string;
  tokenSymbol: string;
  direction: "IN" | "OUT";
  amountRaw: string;
  amountUsd: string | null;
  timestamp: string | Date;
  txHash: string;
  counterpartyAddress: string | null;
  counterpartyEntityName: string | null;
}

export interface ParkingTimelineProps {
  chain: ChainSlug;
  address: string;
  parkingData?: {
    perChain?: Array<{
      chain: string;
      parkedUsd: string;
      byToken: Array<{
        tokenAddress: string;
        symbol: string;
        balanceRaw: string;
        balanceUsd: string | null;
      }>;
    }>;
    totalParkedUsd?: string;
    timeline?: ParkingEventItem[];
    peakUsd?: string | null;
    peakAt?: string | Date | null;
  } | null;
  isLoading?: boolean;
}

function formatUsd(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "—";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "—";
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortenAddress(addr: string | null): string {
  if (!addr) return "—";
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function ParkingTimeline({ chain, address, parkingData, isLoading }: ParkingTimelineProps) {
  const explorerBase = CHAIN_REGISTRY[chain]?.explorerBaseUrl ?? "https://basescan.org";

  const {
    perChain = [],
    totalParkedUsd = "0",
    timeline = [],
    peakUsd = null,
    peakAt = null,
  } = parkingData ?? {};

  // Sort timeline chronologically descending for timeline display (latest first)
  const sortedTimeline = useMemo(() => {
    return [...timeline].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    });
  }, [timeline]);

  return (
    <div className="bg-[#171A1D] border border-[#30373D] p-4 text-[#E8ECEF]">
      {/* Header & Balance Summary */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#30373D] mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold tracking-wider text-[#D7A84B] uppercase font-['Geist']">
              Stablecoin Parking Timeline
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#101214] border border-[#30373D] text-[#929BA3]">
              USDC / USDT FLOWS
            </span>
          </div>
          <div className="text-[11px] text-[#929BA3] mt-0.5 font-mono">
            Tracks dry-powder rotation, bridge staging, and CEX fund repatriation.
          </div>
        </div>

        {/* Top metric chips */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-[#101214] border border-[#30373D] px-3 py-1.5 flex flex-col">
            <span className="text-[9px] uppercase font-mono text-[#929BA3] tracking-wider">
              Total Parked Stables
            </span>
            <span className="font-mono text-[14px] font-semibold text-[#79B79A]">
              {formatUsd(totalParkedUsd)}
            </span>
          </div>

          <div className="bg-[#101214] border border-[#30373D] px-3 py-1.5 flex flex-col">
            <span className="text-[9px] uppercase font-mono text-[#929BA3] tracking-wider">
              Peak Parked USD
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[14px] font-semibold text-[#D7A84B]">
                {formatUsd(peakUsd)}
              </span>
              {peakAt && (
                <span className="text-[10px] font-mono text-[#929BA3]">
                  ({new Date(peakAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })})
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Per-Chain Balances Pill Bar */}
      {perChain.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] font-mono">
          <span className="text-[#929BA3] text-[10px] uppercase tracking-wider font-['Geist'] mr-1">
            Chain Breakdown:
          </span>
          {perChain.map((pc) => (
            <div
              key={pc.chain}
              className="flex items-center gap-1.5 px-2 py-0.5 bg-[#101214] border border-[#30373D]"
            >
              <span className="uppercase text-[#929BA3] font-semibold">{pc.chain}:</span>
              <span className="text-[#E8ECEF]">{formatUsd(pc.parkedUsd)}</span>
              {pc.byToken.map((bt) => (
                <span key={bt.tokenAddress} className="text-[#929BA3] text-[10px]">
                  ({bt.symbol}: {formatUsd(bt.balanceUsd)})
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Timeline Feed */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-[#929BA3] uppercase tracking-wider font-['Geist'] mb-2 flex items-center justify-between">
          <span>Flow History ({sortedTimeline.length} events)</span>
          <span className="font-mono text-[10px] normal-case text-[#929BA3]/70">
            Chronological order (newest first)
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-[12px] font-mono text-[#929BA3]">
            Loading stablecoin parking timeline...
          </div>
        ) : sortedTimeline.length === 0 ? (
          <div className="p-8 text-center text-[12px] font-mono border border-dashed border-[#30373D] text-[#929BA3]">
            No stablecoin (USDC/USDT) parking transfers recorded for this wallet.
          </div>
        ) : (
          <div className="divide-y divide-[#30373D]/60 border border-[#30373D] bg-[#101214]">
            {sortedTimeline.map((item, idx) => {
              const isInflow = item.direction === "IN";
              const dateFormatted = new Date(item.timestamp).toLocaleString("en-US", {
                timeZone: "Asia/Jakarta",
                month: "short",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              });

              return (
                <div
                  key={`${item.txHash}-${idx}`}
                  className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#1E2327]/60 transition-colors"
                >
                  {/* Left: Direction badge & Timestamp & Chain */}
                  <div className="flex items-center gap-2.5">
                    {/* Flow Direction Badge */}
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 border ${
                        isInflow
                          ? "border-[#79B79A] text-[#79B79A] bg-[#79B79A]/10"
                          : "border-[#D87870] text-[#D87870] bg-[#D87870]/10"
                      }`}
                    >
                      {isInflow ? "[INFLOW]" : "[OUTFLOW]"}
                    </span>

                    <span className="font-mono text-[12px] text-[#929BA3]">
                      {dateFormatted}
                    </span>

                    <span className="text-[10px] font-mono uppercase px-1 bg-[#1E2327] border border-[#30373D] text-[#929BA3]">
                      {item.chain}
                    </span>
                  </div>

                  {/* Middle: Token & USD amount */}
                  <div className="flex items-center gap-3 font-mono">
                    <span className="text-[12px] font-semibold text-[#E8ECEF]">
                      {item.tokenSymbol}
                    </span>
                    <span
                      className={`text-[13px] font-semibold ${
                        isInflow ? "text-[#79B79A]" : "text-[#D87870]"
                      }`}
                    >
                      {isInflow ? "+" : "-"}
                      {formatUsd(item.amountUsd)}
                    </span>
                  </div>

                  {/* Right: Counterparty Tag & Explorer Link */}
                  <div className="flex items-center gap-2.5 text-[11px] font-mono">
                    {item.counterpartyEntityName ? (
                      <span className="px-2 py-0.5 bg-[#1E2327] border border-[#D7A84B]/40 text-[#D7A84B] font-medium truncate max-w-[180px]">
                        🏷️ {item.counterpartyEntityName}
                      </span>
                    ) : item.counterpartyAddress ? (
                      <span className="text-[#929BA3]" title={item.counterpartyAddress}>
                        {shortenAddress(item.counterpartyAddress)}
                      </span>
                    ) : (
                      <span className="text-[#929BA3]/60">—</span>
                    )}

                    <a
                      href={`${explorerBase}/tx/${item.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#929BA3] hover:text-[#D7A84B] underline transition-colors"
                      title="View on block explorer"
                    >
                      Tx ↗
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
