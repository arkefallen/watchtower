"use client";

import React from "react";
import type { WalletGradeResult } from "@/server/services/wallet/grade";

interface GradeCardProps {
  grade: WalletGradeResult | null | undefined;
  isLoading?: boolean;
  onRecompute?: () => void;
  isRecomputing?: boolean;
}

export function GradeCard({ grade, isLoading, onRecompute, isRecomputing }: GradeCardProps) {
  if (isLoading) {
    return (
      <div className="bg-[#171A1D] border border-[#30373D] p-4 text-xs">
        <div className="text-[#929BA3] font-mono animate-pulse">Loading wallet auto-grade...</div>
      </div>
    );
  }

  const isAvailable = grade?.available ?? false;

  return (
    <div className="bg-[#171A1D] border border-[#30373D] p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#30373D] pb-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#E8ECEF]">
            Auto-Grade Assessment
          </span>
          {grade?.gradeLabel && (
            <span className="font-mono text-xs px-2 py-0.5 bg-[#1E2327] border border-[#30373D] text-[#D7A84B] font-medium">
              {grade.gradeLabel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isAvailable ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#79B79A]">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#79B79A]" />
              GRADE ACTIVE
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#D7A84B]">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#D7A84B]" />
              UNAVAILABLE (SAMPLE &lt; 3)
            </span>
          )}

          {onRecompute && (
            <button
              type="button"
              onClick={onRecompute}
              disabled={isRecomputing}
              className="text-[11px] font-mono uppercase px-2 py-1 bg-[#1E2327] hover:bg-[#252C32] border border-[#30373D] text-[#E8ECEF] disabled:opacity-50"
            >
              {isRecomputing ? "Grading..." : "Recompute"}
            </button>
          )}
        </div>
      </div>

      {/* Grid of Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Win Rate */}
        <div className="bg-[#101214] border border-[#30373D] p-3">
          <div className="text-[11px] font-mono text-[#929BA3] uppercase mb-1">Win Rate</div>
          <div className="font-mono text-lg font-semibold">
            {isAvailable && grade?.winRatePct !== null && grade?.winRatePct !== undefined ? (
              <span className={grade.winRatePct >= 50 ? "text-[#79B79A]" : "text-[#D87870]"}>
                {grade.winRatePct.toFixed(1)}%
              </span>
            ) : (
              <span className="text-[#929BA3]">—</span>
            )}
          </div>
          <div className="text-[10px] font-mono text-[#929BA3] mt-1">
            {isAvailable ? `${grade?.profitablePositionsCount ?? 0} / ${grade?.sampleSize ?? 0} profitable` : "Closed trades only"}
          </div>
        </div>

        {/* Realized PnL */}
        <div className="bg-[#101214] border border-[#30373D] p-3">
          <div className="text-[11px] font-mono text-[#929BA3] uppercase mb-1">Realized PnL</div>
          <div className="font-mono text-lg font-semibold">
            {isAvailable && grade?.realizedPnlUsd !== null && grade?.realizedPnlUsd !== undefined ? (
              <span className={Number(grade.realizedPnlUsd) >= 0 ? "text-[#79B79A]" : "text-[#D87870]"}>
                {Number(grade.realizedPnlUsd) >= 0 ? "+" : ""}${Number(grade.realizedPnlUsd).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            ) : (
              <span className="text-[#929BA3]">—</span>
            )}
          </div>
          <div className="text-[10px] font-mono text-[#929BA3] mt-1">
            {isAvailable ? "Closed positions sum" : "Open positions excluded"}
          </div>
        </div>

        {/* Entry-Timing Ratio */}
        <div className="bg-[#101214] border border-[#30373D] p-3">
          <div className="text-[11px] font-mono text-[#929BA3] uppercase mb-1">Entry-Timing Ratio</div>
          <div className="font-mono text-lg font-semibold">
            {isAvailable && grade?.entryTimingRatio !== null && grade?.entryTimingRatio !== undefined ? (
              <span className="text-[#D7A84B]">
                {grade.entryTimingRatio.toFixed(3)}
              </span>
            ) : (
              <span className="text-[#929BA3]">—</span>
            )}
          </div>
          <div className="text-[10px] font-mono text-[#929BA3] mt-1">
            {isAvailable ? `Entry MC ÷ Peak MC` : "Lower = earlier entry"}
          </div>
        </div>

        {/* Sample Size / Status */}
        <div className="bg-[#101214] border border-[#30373D] p-3">
          <div className="text-[11px] font-mono text-[#929BA3] uppercase mb-1">Sample Size</div>
          <div className="font-mono text-lg font-semibold text-[#E8ECEF]">
            {grade?.sampleSize ?? 0}
            <span className="text-xs font-normal text-[#929BA3] ml-1">closed</span>
          </div>
          <div className="text-[10px] font-mono text-[#929BA3] mt-1">
            {isAvailable ? "Qualified for grading" : "Requires ≥ 3 closed"}
          </div>
        </div>
      </div>

      {!isAvailable && (
        <div className="mt-4 p-2.5 bg-[#101214] border border-[#D7A84B]/40 text-[#D7A84B] text-[11px] font-mono flex items-center gap-2">
          <span className="text-sm font-bold">!</span>
          <span>
            Performance metrics unavailable: wallet has only {grade?.sampleSize ?? 0} closed position(s). Minimum threshold is 3 to prevent misleading statistical extrapolation.
          </span>
        </div>
      )}
    </div>
  );
}
