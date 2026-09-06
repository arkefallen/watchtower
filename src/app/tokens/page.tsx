"use client";

import React from "react";
import { TokenLookupForm } from "@/components/tokens/TokenLookupForm";

export default function TokensIndexPage() {
  return (
    <main className="max-w-[1440px] mx-auto p-4 md:p-6 space-y-6">
      {/* Top Header */}
      <div className="bg-[#171A1D] border border-[#30373D] p-5">
        <div className="flex items-center gap-2 text-[11px] font-mono text-[#D7A84B] uppercase tracking-wider mb-1">
          <span>●</span>
          <span>Module 7 — Token Intelligence</span>
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-[#E8ECEF] font-['Geist']">
          Token Lookup &amp; Holder Forensics
        </h1>
        <p className="text-xs text-[#929BA3] mt-1 font-mono max-w-2xl">
          Inspect any EVM contract address across Base, BSC, or Robinhood Chain. Instantly cross-reference against your tracked watchlist to reveal smart-money holders, entry market caps, netflow history, cluster insider warnings, and paid-promoter red flags.
        </p>
      </div>

      {/* Query Form */}
      <TokenLookupForm initialChain="base" />

      {/* Quick Navigation Guide */}
      <div className="bg-[#171A1D] border border-[#30373D] p-5 font-mono text-xs">
        <div className="text-[11px] uppercase tracking-wider text-[#E8ECEF] font-semibold mb-3">
          Local DB SLA &amp; Forensic Coverage (FR-7.1, FR-7.2)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[#929BA3]">
          <div className="bg-[#101214] border border-[#30373D] p-3">
            <div className="text-[#D7A84B] font-bold mb-1">01. TRACKED HOLDERS</div>
            <p className="text-[11px]">
              Surfaces all watchlist holders with entry market caps, current holding vs distributed status, and automated performance grades.
            </p>
          </div>
          <div className="bg-[#101214] border border-[#30373D] p-3">
            <div className="text-[#D7A84B] font-bold mb-1">02. RED-FLAG HEURISTICS</div>
            <p className="text-[11px]">
              Instantly detects paid promoters (wallets funded directly by deployer), explorer top-10 supply concentration, and fresh contracts (&lt; 7d).
            </p>
          </div>
          <div className="bg-[#101214] border border-[#30373D] p-3">
            <div className="text-[#D7A84B] font-bold mb-1">03. ZERO NETWORK BLOCKING</div>
            <p className="text-[11px]">
              All queries execute against local PostgreSQL indices (&lt; 3s SLA). Metadata refreshes are dispatched as asynchronous BullMQ background jobs.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
