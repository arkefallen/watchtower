"use client";

import React from "react";
import { formatWalletLabel, type WalletLabelTags } from "@/lib/format/wallet-label";

export interface LabelPreviewProps {
  edge?: string | null;
  style?: string | null;
  size?: string | null;
  customLabel?: string | null;
  className?: string;
}

export function LabelPreview({
  edge,
  style,
  size,
  customLabel,
  className = "",
}: LabelPreviewProps) {
  const formatted = formatWalletLabel({ edge, style, size });

  if (!formatted && !customLabel) {
    return <span className={`text-[#929BA3] font-mono text-[12px] ${className}`}>—</span>;
  }

  return (
    <div className={`inline-flex flex-col gap-0.5 ${className}`}>
      {customLabel && (
        <span className="font-sans text-[12px] font-semibold text-[#E8ECEF]">
          {customLabel}
        </span>
      )}
      {formatted && (
        <span className="inline-flex items-center px-1.5 py-0.5 border border-[#30373D] bg-[#171A1D] text-[#929BA3] font-mono text-[11px] uppercase tracking-wider rounded-none">
          {formatted}
        </span>
      )}
    </div>
  );
}
