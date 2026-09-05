"use client";

import React from "react";
import Link from "next/link";
import { formatFullUsd } from "@/lib/format/usd";
import { StateBadge } from "@/components/shared/StateBadge";
import { IndependenceVerdict } from "./IndependenceVerdict";
import type { GraphNodePayload } from "@/server/services/interaction/graph-query";

export interface NodeSidePanelProps {
  node: GraphNodePayload | null;
  onClose: () => void;
}

export function NodeSidePanel({ node, onClose }: NodeSidePanelProps) {
  if (!node) return null;

  const displayName = node.ensName ?? `${node.address.slice(0, 6)}...${node.address.slice(-4)}`;

  return (
    <aside
      aria-label="Wallet inspection"
      className="absolute top-4 right-4 z-30 w-[340px] max-w-[calc(100%-32px)] max-h-[calc(100%-32px)] bg-[#0D1117]/95 backdrop-blur-md border border-[#30373D] rounded-xl p-4 flex flex-col shadow-2xl overflow-y-auto animate-in fade-in slide-in-from-right-4 duration-200 select-none font-mono"
    >
      {/* Header */}
      <div className="flex items-start justify-between pb-3 border-b border-[#30373D]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-[#E8ECEF]">
              {displayName}
            </span>
            <span className="text-[10px] text-[#929BA3] bg-[#171A1D] px-1.5 py-0.5 border border-[#30373D] rounded">
              {node.chain}
            </span>
          </div>
          <div className="text-[11px] text-[#929BA3] break-all mt-0.5 select-all">
            {node.address}
          </div>
        </div>
        <button
          onClick={onClose}
          className="h-6 w-6 flex items-center justify-center text-[#929BA3] hover:text-[#E8ECEF] hover:bg-[#171A1D] border border-transparent hover:border-[#30373D] rounded text-[12px] transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Tags & Badges */}
      <div className="py-3 border-b border-[#30373D] flex flex-wrap items-center gap-2 text-[11px]">
        <StateBadge state={node.alertState} />
        {node.sizeTag && (
          <span className="px-1.5 py-0.5 bg-[#171A1D] border border-[#30373D] rounded text-[#E8ECEF]">
            SIZE: {node.sizeTag}
          </span>
        )}
        {node.clusterName && (
          <span
            className="px-2 py-0.5 border rounded text-[#101214] font-semibold text-[10.5px]"
            style={{
              backgroundColor: node.clusterColor ?? "#D7A84B",
              borderColor: node.clusterColor ?? "#D7A84B",
            }}
          >
            {node.clusterName}
          </span>
        )}
      </div>

      {/* Metrics */}
      <div className="py-3 border-b border-[#30373D] grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <div className="text-[#929BA3] text-[10px]">STABLE BALANCE</div>
          <div className="text-[#E8ECEF] font-semibold text-[12px]">
            {formatFullUsd(node.stableBalanceUsd)}
          </div>
        </div>
        <div>
          <div className="text-[#929BA3] text-[10px]">NODE TYPE</div>
          <div className="text-[#E8ECEF] text-[12px]">
            {node.isSecondary ? node.secondaryType ?? "SECONDARY" : "TRACKED WALLET"}
          </div>
        </div>
      </div>

      {/* Independence Verdict Section */}
      <div className="py-3 border-b border-[#30373D]">
        <IndependenceVerdict address={node.address} chain={node.chain} />
      </div>

      {/* Action to Wallet Detail */}
      <div className="pt-3">
        <Link
          href={`/wallets/${node.chain.toLowerCase()}/${node.address}`}
          className="block w-full text-center py-2 bg-[#171A1D] border border-[#30373D] hover:border-[#D7A84B] hover:text-[#D7A84B] text-[#E8ECEF] text-[11px] font-semibold rounded-lg transition-colors"
        >
          Open Wallet Profile →
        </Link>
      </div>
    </aside>
  );
}
