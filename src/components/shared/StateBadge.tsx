"use client";

import React from "react";

export type BadgeState = "IDLE" | "ARMED" | "TRIGGERED" | "SYNCED" | "RUNNING" | "NEVER_SYNCED" | "FAILED" | "QUEUED";

export interface StateBadgeProps {
  state: BadgeState | string;
  subText?: string;
  progress?: number;
  className?: string;
}

export function StateBadge({ state, subText, progress, className = "" }: StateBadgeProps) {
  const normState = state ? state.toUpperCase() : "IDLE";

  switch (normState) {
    case "ARMED":
      return (
        <span className={`inline-flex items-center gap-1.5 font-mono text-[12px] font-semibold text-[#D7A84B] ${className}`}>
          <span className="h-2 w-2 rounded-none bg-[#D7A84B] shrink-0" />
          <span>ARMED {subText ? `(${subText})` : ""}</span>
        </span>
      );

    case "TRIGGERED":
      return (
        <span className={`inline-flex items-center gap-1.5 font-mono text-[12px] font-semibold text-[#D87870] ${className}`}>
          <span className="h-2 w-2 rounded-none bg-[#D87870] shrink-0 animate-pulse" />
          <span>TRIGGERED {subText ? `(${subText})` : ""}</span>
        </span>
      );

    case "SYNCED":
      return (
        <span className={`inline-flex items-center gap-1.5 font-mono text-[12px] text-[#79B79A] ${className}`}>
          <span className="h-2 w-2 rounded-none bg-[#79B79A] shrink-0" />
          <span>SYNCED</span>
        </span>
      );

    case "RUNNING":
      return (
        <div className={`flex flex-col gap-1 w-full max-w-[120px] ${className}`}>
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#D7A84B]">
            <span className="h-2 w-2 rounded-none bg-[#D7A84B] shrink-0 animate-pulse" />
            <span>RUNNING {typeof progress === "number" ? `${progress}%` : subText ? `(${subText})` : ""}</span>
          </span>
          <div className="h-1 w-full bg-[#171A1D] border border-[#30373D]">
            <div
              className="h-full bg-[#D7A84B] transition-all duration-300"
              style={{ width: `${Math.min(Math.max(progress ?? 50, 0), 100)}%` }}
            />
          </div>
        </div>
      );

    case "FAILED":
      return (
        <span className={`inline-flex items-center gap-1.5 font-mono text-[12px] text-[#D87870] ${className}`}>
          <span className="h-2 w-2 rounded-none bg-[#D87870] shrink-0" />
          <span>FAILED {subText ? `(${subText})` : ""}</span>
        </span>
      );

    case "QUEUED":
      return (
        <span className={`inline-flex items-center gap-1.5 font-mono text-[12px] text-[#929BA3] ${className}`}>
          <span className="h-2 w-2 rounded-none bg-[#929BA3] shrink-0" />
          <span>QUEUED</span>
        </span>
      );

    case "NEVER_SYNCED":
      return (
        <span className={`inline-flex items-center gap-1.5 font-mono text-[12px] text-[#929BA3] ${className}`}>
          <span className="h-2 w-2 rounded-none bg-[#30373D] shrink-0" />
          <span>NEVER SYNCED</span>
        </span>
      );

    case "IDLE":
    default:
      return (
        <span className={`inline-flex items-center gap-1.5 font-mono text-[12px] text-[#929BA3] ${className}`}>
          <span className="h-2 w-2 rounded-none bg-[#30373D] shrink-0" />
          <span>IDLE</span>
        </span>
      );
  }
}
