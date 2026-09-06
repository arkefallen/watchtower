"use client";

import React from "react";
import Link from "next/link";
import type { TokenRedFlagsResult } from "@/server/services/token/red-flags";
import type { ClusterPresenceWarning } from "@/server/services/token/lookup";
import type { ChainSlug } from "@/lib/chains/types";

interface RedFlagListProps {
  redFlags: TokenRedFlagsResult | null;
  clusterWarnings: ClusterPresenceWarning[];
  chain: ChainSlug;
  explorerBaseUrl?: string;
}

function shortenHash(hash: string): string {
  if (!hash || hash.length < 14) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function RedFlagList({
  redFlags,
  clusterWarnings,
  chain,
  explorerBaseUrl = "https://basescan.org",
}: RedFlagListProps) {
  const hasPromoter = redFlags?.hasPromoterWarning ?? false;
  const promoterCount = redFlags?.promoterWarnings?.length ?? 0;
  const top10Share = redFlags?.top10SharePct;
  const holderDataUnavailable = redFlags?.holderDataUnavailable ?? true;
  const tokenAgeDays = redFlags?.tokenAgeDays;

  return (
    <div className="space-y-4">
      {/* 1. Paid-Promoter Warnings (FR-7.1, FR-7.2) */}
      {hasPromoter ? (
        <div className="bg-[#171A1D] border-2 border-[#D7A84B] p-4 text-xs font-mono">
          <div className="flex items-center gap-2 text-[#D7A84B] font-bold uppercase tracking-wider mb-2">
            <span className="text-sm">⚠</span>
            <span>Paid-Promoter Warning ({promoterCount} Detected)</span>
          </div>
          <p className="text-[#E8ECEF] mb-3 leading-relaxed">
            One or more tracked wallets received this token directly from the deployer address. High probability of paid promotion or team/insider allocation.
          </p>

          <div className="space-y-2 border-t border-[#30373D] pt-2.5">
            {redFlags?.promoterWarnings.map((warning, idx) => (
              <div
                key={`${warning.walletAddress}_${warning.txHash}_${idx}`}
                className="bg-[#101214] border border-[#30373D] p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <span className="text-[#929BA3] text-[10px] uppercase block">Funded Wallet</span>
                  <Link
                    href={`/wallets/${chain}/${warning.walletAddress}`}
                    className="text-[#D7A84B] hover:underline font-semibold"
                  >
                    {shortenAddress(warning.walletAddress)}
                  </Link>
                </div>

                <div className="sm:text-right">
                  <span className="text-[#929BA3] text-[10px] uppercase block">Transfer Tx</span>
                  <a
                    href={`${explorerBaseUrl}/tx/${warning.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#E8ECEF] hover:text-[#D7A84B] flex items-center gap-1"
                  >
                    <span>{shortenHash(warning.txHash)}</span>
                    <span className="text-[10px] text-[#D7A84B]">↗</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-[#171A1D] border border-[#30373D] p-3 text-xs font-mono flex items-center justify-between">
          <span className="text-[#929BA3]">Paid-Promoter Check</span>
          <span className="text-[#79B79A] font-semibold flex items-center gap-1">
            <span>✓</span>
            <span>No direct deployer transfers to tracked wallets</span>
          </span>
        </div>
      )}

      {/* 2. Cluster Presence Warnings (FR-7.1) */}
      {clusterWarnings.length > 0 && (
        <div className="bg-[#171A1D] border border-[#D7A84B]/60 p-4 text-xs font-mono">
          <div className="flex items-center gap-2 text-[#D7A84B] font-bold uppercase tracking-wider mb-2">
            <span>●</span>
            <span>Cluster Presence Alert ({clusterWarnings.length} Clusters)</span>
          </div>
          <p className="text-[#929BA3] text-[11px] mb-3">
            Multiple tracked wallets originating from the same funding cluster hold active positions in this token.
          </p>

          <div className="space-y-2">
            {clusterWarnings.map((cw) => (
              <div
                key={cw.clusterId}
                className="bg-[#101214] border border-[#30373D] p-2.5 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: cw.colorHex || "#D7A84B" }}
                  />
                  <Link
                    href={`/clusters/${cw.clusterId}`}
                    className="text-[#E8ECEF] hover:text-[#D7A84B] font-semibold"
                  >
                    {cw.clusterName}
                  </Link>
                </div>
                <span className="text-[#D7A84B] font-semibold">
                  {cw.walletCount} member wallets holding
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Explorer Supply Concentration & Token Age (FR-7.2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
        {/* Top 10 Holder Concentration */}
        <div className="bg-[#171A1D] border border-[#30373D] p-3">
          <div className="text-[10px] uppercase text-[#929BA3] mb-1">
            Top 10 Supply Concentration
          </div>
          <div className="text-base font-bold">
            {!holderDataUnavailable && top10Share !== null && top10Share !== undefined ? (
              <span className={top10Share > 50 ? "text-[#D87870]" : "text-[#E8ECEF]"}>
                {top10Share.toFixed(1)}%
              </span>
            ) : (
              <span className="text-[#929BA3] text-xs px-2 py-0.5 bg-[#101214] border border-[#30373D]">
                UNAVAILABLE
              </span>
            )}
          </div>
          <div className="text-[10px] text-[#929BA3] mt-1">
            {!holderDataUnavailable ? "From explorer holder list" : "Explorer did not return holder distribution"}
          </div>
        </div>

        {/* Token Age */}
        <div className="bg-[#171A1D] border border-[#30373D] p-3">
          <div className="text-[10px] uppercase text-[#929BA3] mb-1">
            Token Contract Age
          </div>
          <div className="text-base font-bold text-[#E8ECEF]">
            {tokenAgeDays !== null && tokenAgeDays !== undefined ? (
              <span>
                {tokenAgeDays} <span className="text-xs font-normal text-[#929BA3]">days old</span>
              </span>
            ) : (
              <span className="text-[#929BA3] text-xs px-2 py-0.5 bg-[#101214] border border-[#30373D]">
                UNKNOWN
              </span>
            )}
          </div>
          <div className="text-[10px] text-[#929BA3] mt-1">
            {tokenAgeDays !== null && tokenAgeDays !== undefined && tokenAgeDays < 7 ? (
              <span className="text-[#D7A84B]">Fresh contract (&lt; 7d)</span>
            ) : (
              "Derived from deployment block"
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
