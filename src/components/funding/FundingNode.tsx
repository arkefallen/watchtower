"use client";

import React from "react";
import { CHAIN_REGISTRY } from "@/lib/chains/registry";
import type { ChainSlug } from "@/lib/chains/types";
import { PrimaryWalletBadge } from "./PrimaryWalletBadge";
import { DeepTraceButton } from "./DeepTraceButton";

export type TraceStopReason =
  | "TERMINAL_ENTITY"
  | "DEPTH_LIMIT"
  | "NO_INBOUND"
  | "SELF_REFERENCE"
  | "BUDGET_EXHAUSTED"
  | "NOT_STOPPED";

export interface TreeNodeData {
  address: string;
  chain: ChainSlug;
  depth: number;
  label: string | null;
  entityKind: string | null;
  entityName: string | null;
  isTerminalEntity: boolean;
  isTracked: boolean;
  totalUsdFunded: string;
  fundingCount: number;
  internalFundingCount: number;
  firstFundedAt: Date | string | null;
  lastFundedAt: Date | string | null;
  stopReason: TraceStopReason;
  isRepeatedFunder: boolean;
  fundedFirstGas: boolean;
  isProfitSink: boolean;
  profitSinkRatio: string | null;
  isLargestOutflowDestination: boolean;
  isPrimaryWallet: boolean;
  primaryLabel: "PRIMARY_WALLET" | "REPEATED_FUNDER_CANDIDATE" | "PROFIT_SINK_CANDIDATE" | null;
  canDeepTrace: boolean;
  children?: TreeNodeData[];
}

interface FundingNodeProps {
  node: TreeNodeData;
  rootAddress: string;
  chain: ChainSlug;
  isRoot?: boolean;
  onSelectNode?: (node: TreeNodeData) => void;
}

function formatUsd(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "—";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "—";
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortenAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function FundingNode({
  node,
  rootAddress,
  chain,
  isRoot = false,
  onSelectNode,
}: FundingNodeProps) {
  const explorerBase = CHAIN_REGISTRY[node.chain ?? chain]?.explorerBaseUrl ?? "https://basescan.org";
  const isInternalOnly = node.internalFundingCount > 0 && node.fundingCount === 0;

  return (
    <div
      onClick={() => onSelectNode?.(node)}
      className={`p-3 border transition-colors cursor-pointer ${
        isRoot
          ? "bg-[#101214] border-[#D7A84B]"
          : node.isTerminalEntity
          ? "bg-[#171A1D] border-[#79B79A]/70 hover:border-[#79B79A]"
          : node.isPrimaryWallet
          ? "bg-[#171A1D] border-[#D7A84B]/70 hover:border-[#D7A84B]"
          : "bg-[#171A1D] border-[#30373D] hover:border-[#929BA3]"
      }`}
    >
      {/* Top row: Badges, Depth, Status */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Root indicator */}
          {isRoot && (
            <span className="px-1.5 py-0.5 bg-[#D7A84B] text-[#101214] text-[9px] font-mono font-bold uppercase">
              TARGET ROOT
            </span>
          )}

          {/* Terminal Entity leaf badge */}
          {node.isTerminalEntity && (
            <span className="px-2 py-0.5 border border-[#79B79A] text-[#79B79A] text-[9px] font-mono font-bold uppercase tracking-wider bg-[#79B79A]/10">
              [TERMINAL ENTITY: {node.entityKind ?? "CEX"}]
            </span>
          )}

          {/* Primary Wallet warning badge with tooltip */}
          {node.primaryLabel && (
            <PrimaryWalletBadge
              primaryLabel={node.primaryLabel}
              evidence={{
                fundingCount: node.fundingCount,
                internalFundingCount: node.internalFundingCount,
                isRepeatedFunder: node.isRepeatedFunder,
                profitSinkRatio: node.profitSinkRatio,
                isProfitSink: node.isProfitSink,
                isLargestOutflowDestination: node.isLargestOutflowDestination,
                totalUsdFunded: node.totalUsdFunded,
              }}
            />
          )}

          {/* Internal-tx-only funder badge */}
          {isInternalOnly && (
            <span className="px-1.5 py-0.5 border border-[#D7A84B] text-[#D7A84B] text-[9px] font-mono font-bold uppercase bg-[#4A3A1A]/40">
              [INTERNAL TX ONLY]
            </span>
          )}

          {/* First gas funder badge */}
          {node.fundedFirstGas && !isRoot && (
            <span className="px-1.5 py-0.5 bg-[#1E2327] border border-[#30373D] text-[9px] font-mono text-[#929BA3]">
              ⛽ FIRST GAS
            </span>
          )}
        </div>

        {/* Depth Tag & Stop Reason */}
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#929BA3]">
          <span>Hop {node.depth}</span>
          {node.stopReason === "TERMINAL_ENTITY" && (
            <span className="text-[#79B79A]">● Terminal CEX/Entity</span>
          )}
          {node.stopReason === "DEPTH_LIMIT" && (
            <span className="text-[#D7A84B]">● Depth 3/3 Reached</span>
          )}
          {node.stopReason === "NO_INBOUND" && (
            <span className="text-[#929BA3]/70">● Genesis / No Inbound</span>
          )}
        </div>
      </div>

      {/* Center: Address, Entity Name, and Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            {node.entityName ? (
              <span className="text-[13px] font-bold text-[#E8ECEF] font-['Geist']">
                {node.entityName}
              </span>
            ) : node.label ? (
              <span className="text-[13px] font-bold text-[#D7A84B] font-['Geist']">
                {node.label}
              </span>
            ) : null}

            <span className="font-mono text-[12px] text-[#929BA3]">
              {shortenAddress(node.address)}
            </span>

            <a
              href={`${explorerBase}/address/${node.address}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[#929BA3] hover:text-[#D7A84B] font-mono text-[11px] underline"
            >
              ↗
            </a>
          </div>

          <div className="text-[11px] font-mono text-[#929BA3] mt-0.5">
            Funded: <span className="text-[#79B79A] font-semibold">{formatUsd(node.totalUsdFunded)}</span>
            {" • "}
            <span>{node.fundingCount + node.internalFundingCount} transfers</span>
            {node.internalFundingCount > 0 && (
              <span> ({node.internalFundingCount} internal)</span>
            )}
          </div>
        </div>

        {/* Right action / Deep trace if depth limited */}
        {node.stopReason === "DEPTH_LIMIT" && node.canDeepTrace && (
          <div className="mt-2 sm:mt-0">
            <DeepTraceButton
              address={rootAddress}
              chain={chain}
              branchAddress={node.address}
            />
          </div>
        )}
      </div>
    </div>
  );
}
