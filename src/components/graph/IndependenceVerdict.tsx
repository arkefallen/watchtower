"use client";

import React from "react";
import { trpc } from "@/lib/trpc/client";
import { INDEPENDENT_VERBATIM } from "@/server/services/independence/statements";

export interface IndependenceVerdictProps {
  address: string;
  chain: "BASE" | "BSC" | "ROBINHOOD";
}

export function IndependenceVerdict({ address, chain }: IndependenceVerdictProps) {
  const { data: verdict, isLoading } = trpc.graph.independence.useQuery(
    { address, chain },
    { enabled: !!address }
  );

  return (
    <div className="space-y-2 font-mono text-[11px]">
      <div className="flex items-center justify-between text-[10px] text-[#929BA3] uppercase tracking-wider pb-1 border-b border-[#30373D]">
        <span>INDEPENDENCE VERDICT (FR-3.6)</span>
        {verdict && (
          <span
            className={`font-semibold px-1 py-0.2 border ${
              verdict.isIndependentOfAll
                ? "text-[#79B79A] border-[#79B79A] bg-[#79B79A]/10"
                : "text-[#D7A84B] border-[#D7A84B] bg-[#D7A84B]/10"
            }`}
          >
            {verdict.isIndependentOfAll ? "INDEPENDENT" : "CONNECTED"}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="py-2 text-[#929BA3] text-[10px]">
          Computing independence verdict...
        </div>
      ) : verdict?.isIndependentOfAll ? (
        <div className="p-2.5 bg-[#101214] border border-[#79B79A]/30 text-[#79B79A] text-[10.5px] leading-relaxed">
          {INDEPENDENT_VERBATIM}
        </div>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {verdict?.statements.map((stmt, idx) => (
            <div
              key={idx}
              className="p-2 bg-[#101214] border border-[#30373D] text-[#E8ECEF] text-[10px] leading-relaxed flex items-start gap-1.5"
            >
              <span className="text-[#D7A84B] shrink-0 mt-0.5">●</span>
              <span>{stmt}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
