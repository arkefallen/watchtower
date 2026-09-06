"use client";

import React from "react";
import Link from "next/link";
import { getAlertStateStyle } from "@/components/shared/StateBadge";

export interface ClusterChipData {
  id: string;
  name?: string | null;
  color?: string | null;
  colorHex?: string | null;
  isArmed?: boolean;
}

export interface ClusterChipProps {
  cluster: ClusterChipData;
  showArmedBadge?: boolean;
  clickable?: boolean;
  className?: string;
}

/**
 * ClusterChip with escalated cluster-ARMED treatment (P4-T10, A5 escalation).
 * When cluster.isArmed is true, renders an escalated amber badge distinct from a single wallet's ARMED state.
 */
export function ClusterChip({
  cluster,
  showArmedBadge = true,
  clickable = true,
  className = "",
}: ClusterChipProps) {
  const clusterColor = cluster.color ?? cluster.colorHex ?? "#D7A84B";
  const clusterName = cluster.name || `#${cluster.id.slice(0, 4)}`;
  const isArmed = !!cluster.isArmed;
  const stateStyle = getAlertStateStyle(undefined, isArmed);

  const content = (
    <div
      data-testid="cluster-chip"
      data-armed={isArmed ? "true" : "false"}
      className={`inline-flex items-center gap-1.5 font-mono text-[11px] px-2 py-0.5 transition-all ${
        isArmed
          ? "border-2 border-[#D7A84B] bg-[#D7A84B]/15 text-[#D7A84B] font-bold shadow-[0_0_8px_rgba(215,168,75,0.25)]"
          : "border border-[#30373D] bg-[#171A1D] text-[#E8ECEF] hover:border-[#4A5568]"
      } ${className}`}
    >
      <span
        className={`w-2 h-2 rounded-none shrink-0 ${isArmed ? "animate-pulse" : ""}`}
        style={{ backgroundColor: isArmed ? "#D7A84B" : clusterColor }}
      />
      <span className="truncate max-w-[120px]">{clusterName}</span>

      {isArmed && showArmedBadge && (
        <span
          data-testid="cluster-armed-escalated"
          className="ml-1 px-1 py-0.2 bg-[#D7A84B] text-[#101214] text-[9px] font-black tracking-wider uppercase"
        >
          ARMED
        </span>
      )}
    </div>
  );

  if (clickable) {
    return (
      <Link href={`/clusters/${cluster.id}`} className="inline-block">
        {content}
      </Link>
    );
  }

  return content;
}
