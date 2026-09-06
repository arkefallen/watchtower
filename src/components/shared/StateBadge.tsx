"use client";

import React from "react";

export type BadgeState =
  | "IDLE"
  | "ARMED"
  | "TRIGGERED"
  | "EXIT_RISK"
  | "CLUSTER_ARMED"
  | "SYNCED"
  | "RUNNING"
  | "NEVER_SYNCED"
  | "FAILED"
  | "QUEUED";

export interface AlertStateStyle {
  state: string;
  color: string;
  borderColor: string;
  bgColor: string;
  bgTint: string;
  borderWidth: number;
  label: string;
  isPulse?: boolean;
}

/**
 * Canonical mapping function used across wallet list, graph canvas, and detail headers.
 * Ensures consistent color, border, and escalation encoding across all surfaces (P4-T10).
 */
export function getAlertStateStyle(
  state: string | null | undefined,
  isClusterArmed?: boolean
): AlertStateStyle {
  if (isClusterArmed) {
    return {
      state: "CLUSTER_ARMED",
      color: "#D7A84B",
      borderColor: "#D7A84B",
      bgColor: "#D7A84B",
      bgTint: "rgba(215, 168, 75, 0.25)",
      borderWidth: 4,
      label: "CLUSTER ARMED",
      isPulse: true,
    };
  }

  const norm = (state ?? "IDLE").toUpperCase();
  switch (norm) {
    case "ARMED":
      return {
        state: "ARMED",
        color: "#D7A84B",
        borderColor: "#D7A84B",
        bgColor: "#D7A84B",
        bgTint: "rgba(215, 168, 75, 0.15)",
        borderWidth: 3.5,
        label: "ARMED",
        isPulse: false,
      };
    case "TRIGGERED":
      return {
        state: "TRIGGERED",
        color: "#D87870",
        borderColor: "#D87870",
        bgColor: "#D87870",
        bgTint: "rgba(216, 120, 112, 0.15)",
        borderWidth: 4,
        label: "TRIGGERED",
        isPulse: true,
      };
    case "EXIT_RISK":
      return {
        state: "EXIT_RISK",
        color: "#E59866",
        borderColor: "#E59866",
        bgColor: "#E59866",
        bgTint: "rgba(229, 152, 102, 0.15)",
        borderWidth: 3,
        label: "EXIT_RISK",
        isPulse: false,
      };
    case "CLUSTER_ARMED":
      return {
        state: "CLUSTER_ARMED",
        color: "#D7A84B",
        borderColor: "#D7A84B",
        bgColor: "#D7A84B",
        bgTint: "rgba(215, 168, 75, 0.25)",
        borderWidth: 4,
        label: "CLUSTER ARMED",
        isPulse: true,
      };
    case "IDLE":
    default:
      return {
        state: "IDLE",
        color: "#929BA3",
        borderColor: "#30373D",
        bgColor: "#30373D",
        bgTint: "transparent",
        borderWidth: 2,
        label: "IDLE",
        isPulse: false,
      };
  }
}

export interface StateBadgeProps {
  state: BadgeState | string;
  subText?: string;
  progress?: number;
  className?: string;
  isClusterArmed?: boolean;
}

export function StateBadge({
  state,
  subText,
  progress,
  className = "",
  isClusterArmed = false,
}: StateBadgeProps) {
  const normState = isClusterArmed ? "CLUSTER_ARMED" : state ? state.toUpperCase() : "IDLE";

  switch (normState) {
    case "CLUSTER_ARMED":
      return (
        <span
          data-testid="badge-cluster-armed"
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 border-2 border-[#D7A84B] bg-[#D7A84B]/20 font-mono text-[11px] font-bold text-[#D7A84B] tracking-wider shadow-[0_0_10px_rgba(215,168,75,0.3)] ${className}`}
        >
          <span className="h-2 w-2 rounded-none bg-[#D7A84B] shrink-0 animate-ping" />
          <span>CLUSTER ARMED {subText ? `(${subText})` : ""}</span>
        </span>
      );

    case "ARMED":
      return (
        <span
          data-testid="badge-armed"
          className={`inline-flex items-center gap-1.5 font-mono text-[12px] font-semibold text-[#D7A84B] ${className}`}
        >
          <span className="h-2 w-2 rounded-none bg-[#D7A84B] shrink-0" />
          <span>ARMED {subText ? `(${subText})` : ""}</span>
        </span>
      );

    case "TRIGGERED":
      return (
        <span
          data-testid="badge-triggered"
          className={`inline-flex items-center gap-1.5 font-mono text-[12px] font-semibold text-[#D87870] ${className}`}
        >
          <span className="h-2 w-2 rounded-none bg-[#D87870] shrink-0 animate-pulse" />
          <span>TRIGGERED {subText ? `(${subText})` : ""}</span>
        </span>
      );

    case "EXIT_RISK":
      return (
        <span
          data-testid="badge-exit-risk"
          className={`inline-flex items-center gap-1.5 font-mono text-[12px] font-semibold text-[#E59866] ${className}`}
        >
          <span className="h-2 w-2 rounded-none bg-[#E59866] shrink-0" />
          <span>EXIT_RISK {subText ? `(${subText})` : ""}</span>
        </span>
      );

    case "SYNCED":
      return (
        <span
          data-testid="badge-synced"
          className={`inline-flex items-center gap-1.5 font-mono text-[12px] text-[#79B79A] ${className}`}
        >
          <span className="h-2 w-2 rounded-none bg-[#79B79A] shrink-0" />
          <span>SYNCED</span>
        </span>
      );

    case "RUNNING":
      return (
        <div
          data-testid="badge-running"
          className={`flex flex-col gap-1 w-full max-w-[120px] ${className}`}
        >
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#D7A84B]">
            <span className="h-2 w-2 rounded-none bg-[#D7A84B] shrink-0 animate-pulse" />
            <span>
              RUNNING {typeof progress === "number" ? `${progress}%` : subText ? `(${subText})` : ""}
            </span>
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
        <span
          data-testid="badge-failed"
          className={`inline-flex items-center gap-1.5 font-mono text-[12px] text-[#D87870] ${className}`}
        >
          <span className="h-2 w-2 rounded-none bg-[#D87870] shrink-0" />
          <span>FAILED {subText ? `(${subText})` : ""}</span>
        </span>
      );

    case "QUEUED":
      return (
        <span
          data-testid="badge-queued"
          className={`inline-flex items-center gap-1.5 font-mono text-[12px] text-[#929BA3] ${className}`}
        >
          <span className="h-2 w-2 rounded-none bg-[#929BA3] shrink-0" />
          <span>QUEUED</span>
        </span>
      );

    case "NEVER_SYNCED":
      return (
        <span
          data-testid="badge-never-synced"
          className={`inline-flex items-center gap-1.5 font-mono text-[12px] text-[#929BA3] ${className}`}
        >
          <span className="h-2 w-2 rounded-none bg-[#30373D] shrink-0" />
          <span>NEVER SYNCED</span>
        </span>
      );

    case "IDLE":
    default:
      return (
        <span
          data-testid="badge-idle"
          className={`inline-flex items-center gap-1.5 font-mono text-[12px] text-[#929BA3] ${className}`}
        >
          <span className="h-2 w-2 rounded-none bg-[#30373D] shrink-0" />
          <span>IDLE</span>
        </span>
      );
  }
}
