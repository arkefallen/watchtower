"use client";

import React, { useState } from "react";

export interface PrimaryWalletEvidence {
  fundingCount: number;
  internalFundingCount?: number;
  isRepeatedFunder: boolean;
  profitSinkRatio?: string | null;
  isProfitSink?: boolean;
  isLargestOutflowDestination?: boolean;
  totalUsdFunded?: string | null;
}

export interface PrimaryWalletBadgeProps {
  primaryLabel: "PRIMARY_WALLET" | "REPEATED_FUNDER_CANDIDATE" | "PROFIT_SINK_CANDIDATE" | null;
  evidence: PrimaryWalletEvidence;
}

export function PrimaryWalletBadge({ primaryLabel, evidence }: PrimaryWalletBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!primaryLabel) return null;

  const count = evidence.fundingCount ?? 0;
  const ratioStr = evidence.profitSinkRatio ?? "0.0";
  const ratioNum = parseFloat(ratioStr) || 0;
  const condAPass = count >= 2;
  const condBPass = ratioNum >= 20.0;

  const getBadgeContent = () => {
    switch (primaryLabel) {
      case "PRIMARY_WALLET":
        return {
          text: "⚠️ PRIMARY WALLET",
          bg: "bg-[#D7A84B] text-[#101214] font-bold",
          border: "border-[#D7A84B]",
        };
      case "REPEATED_FUNDER_CANDIDATE":
        return {
          text: "⚠️ REPEATED FUNDER",
          bg: "bg-[#4A3A1A] text-[#D7A84B] font-semibold",
          border: "border-[#D7A84B]/60",
        };
      case "PROFIT_SINK_CANDIDATE":
        return {
          text: "⚠️ PROFIT SINK",
          bg: "bg-[#4A3A1A] text-[#D7A84B] font-semibold",
          border: "border-[#D7A84B]/60",
        };
      default:
        return {
          text: "PRIMARY CANDIDATE",
          bg: "bg-[#1E2327] text-[#D7A84B]",
          border: "border-[#30373D]",
        };
    }
  };

  const badge = getBadgeContent();

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border cursor-help ${badge.bg} ${badge.border}`}
      >
        {badge.text}
      </span>

      {/* Hover Tooltip Detailing Condition A and Condition B */}
      {showTooltip && (
        <div className="absolute left-0 top-full mt-1 w-72 p-3 bg-[#101214] border border-[#D7A84B] shadow-2xl z-50 text-[11px] font-mono text-[#E8ECEF]">
          <div className="text-[10px] font-bold text-[#D7A84B] uppercase tracking-wider mb-2 font-['Geist'] pb-1 border-b border-[#30373D]">
            Primary Wallet Classification (§10.6)
          </div>

          <div className="space-y-2">
            {/* Condition A */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[#929BA3] font-semibold">Condition A (Inbound):</div>
                <div className="text-[10px] text-[#929BA3]">
                  Count ≥ 2 inbound fundings
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-bold ${
                    condAPass ? "bg-[#79B79A]/20 text-[#79B79A]" : "bg-[#D87870]/20 text-[#D87870]"
                  }`}
                >
                  {condAPass ? "PASS" : "FAIL"} ({count} txs)
                </span>
              </div>
            </div>

            {/* Condition B */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[#929BA3] font-semibold">Condition B (Outflow Return):</div>
                <div className="text-[10px] text-[#929BA3]">
                  Outflow return ratio ≥ 20.0%
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-bold ${
                    condBPass ? "bg-[#79B79A]/20 text-[#79B79A]" : "bg-[#D87870]/20 text-[#D87870]"
                  }`}
                >
                  {condBPass ? "PASS" : "FAIL"} ({ratioNum.toFixed(1)}%)
                </span>
              </div>
            </div>

            {evidence.isLargestOutflowDestination && (
              <div className="pt-1 border-t border-[#30373D] text-[10px] text-[#79B79A]">
                ✓ Identified as largest outflow destination for target wallet
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
