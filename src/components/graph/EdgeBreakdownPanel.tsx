"use client";

import React from "react";
import { formatFullUsd, formatCompactUsd } from "@/lib/format/usd";
import type { GraphEdgePayload } from "@/server/services/interaction/graph-query";
import { trpc } from "@/lib/trpc/client";

export interface EdgeBreakdownPanelProps {
  edge: GraphEdgePayload | null;
  onClose: () => void;
}

export function EdgeBreakdownPanel({ edge, onClose }: EdgeBreakdownPanelProps) {
  if (!edge) return null;

  const [chainA, addrA] = edge.source.split(":");
  const [chainB, addrB] = edge.target.split(":");

  const { data: edgeDetail, isLoading } = trpc.graph.edgeBreakdown.useQuery(
    {
      addressA: addrA,
      chainA: chainA as any,
      addressB: addrB,
      chainB: chainB as any,
    },
    { enabled: !!edge }
  );

  return (
    <aside
      aria-label="Edge breakdown"
      className="absolute bottom-6 left-6 z-30 w-[460px] max-w-[calc(100vw-32px)] max-h-[420px] bg-[#0D1117]/95 backdrop-blur-md border border-[#30373D] rounded-xl p-4 flex flex-col shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200 select-none font-mono"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#30373D]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#D7A84B] uppercase tracking-wider">
              EDGE BREAKDOWN
            </span>
            <span className="text-[10px] text-[#929BA3] bg-[#171A1D] px-1.5 py-0.5 border border-[#30373D] rounded">
              {edge.chain}
            </span>
          </div>
          <div className="text-[12px] text-[#E8ECEF] mt-1">
            {addrA.slice(0, 6)}...{addrA.slice(-4)} ↔ {addrB.slice(0, 6)}...{addrB.slice(-4)}
          </div>
        </div>
        <button
          onClick={onClose}
          className="h-6 w-6 flex items-center justify-center text-[#929BA3] hover:text-[#E8ECEF] hover:bg-[#171A1D] border border-transparent hover:border-[#30373D] rounded text-[12px] transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-3 gap-2 py-3 border-b border-[#30373D] text-[11px]">
        <div>
          <div className="text-[#929BA3]">TOTAL VOLUME</div>
          <div className="text-[#E8ECEF] font-semibold text-[13px]">{formatFullUsd(edge.totalUsd)}</div>
        </div>
        <div>
          <div className="text-[#929BA3]">TRANSFERS</div>
          <div className="text-[#E8ECEF] font-semibold text-[13px]">{edge.txCount} txs</div>
        </div>
        <div>
          <div className="text-[#929BA3]">DIRECTION SPLIT</div>
          <div className="text-[#E8ECEF] text-[10px]">
            A→B: {formatCompactUsd(edge.usdAToB)} ({edge.countAToB})<br />
            B→A: {formatCompactUsd(edge.usdBToA)} ({edge.countBToA})
          </div>
        </div>
      </div>

      {/* Per-Token List */}
      <div className="flex-1 overflow-y-auto mt-2 space-y-2 pr-1">
        <div className="text-[10px] text-[#929BA3] uppercase tracking-wider">
          Tokens Transferred ({edgeDetail?.tokens?.length ?? edge.distinctTokenCount})
        </div>

        {isLoading ? (
          <div className="py-6 text-center text-[11px] text-[#929BA3]">
            Loading token details...
          </div>
        ) : (
          edgeDetail?.tokens?.map((t) => (
            <div
              key={t.id.toString()}
              className="bg-[#171A1D]/80 border border-[#30373D] rounded-lg p-2.5 text-[11px] space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#E8ECEF]">
                  {t.tokenSymbol ?? (t.tokenAddress ? "TOKEN" : "NATIVE")}
                </span>
                <span className="text-[#D7A84B] font-semibold">
                  {formatFullUsd(Number(t.totalUsd))}
                </span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-[#929BA3]">
                <span>{t.txCount} transfer{t.txCount > 1 ? "s" : ""}</span>
                <span>
                  A→B: {formatCompactUsd(Number(t.usdAToB))} · B→A: {formatCompactUsd(Number(t.usdBToA))}
                </span>
              </div>

              {/* Sample Txs */}
              {Array.isArray(t.sampleTxsJson) && (t.sampleTxsJson as any[]).length > 0 && (
                <div className="pt-1 border-t border-[#30373D]/60 flex items-center gap-1.5 flex-wrap text-[10px]">
                  <span className="text-[#929BA3]">Txs:</span>
                  {(t.sampleTxsJson as any[]).slice(0, 3).map((tx: any) => (
                    <a
                      key={tx.hash}
                      href={`https://basescan.org/tx/${tx.hash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#929BA3] hover:text-[#D7A84B] underline decoration-dotted"
                    >
                      {tx.hash.slice(0, 8)}...↗
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
