"use client";

import React from "react";
import { trpc } from "@/lib/trpc/client";
import type { ChainSlug } from "@/lib/chains/types";

interface DeepTraceButtonProps {
  address: string;
  chain: ChainSlug;
  branchAddress: string;
  onSuccess?: () => void;
}

export function DeepTraceButton({
  address,
  chain,
  branchAddress,
  onSuccess,
}: DeepTraceButtonProps) {
  const utils = trpc.useUtils();
  const deepTraceMutation = trpc.funding.deepTrace.useMutation({
    onSuccess: () => {
      // Invalidate the funding tree query so the UI updates with extended 6 hops
      utils.funding.tree.invalidate({ address, chain });
      onSuccess?.();
    },
  });

  const handleDeepTrace = (e: React.MouseEvent) => {
    e.stopPropagation();
    deepTraceMutation.mutate({
      address,
      chain,
      branchAddress,
    });
  };

  if (deepTraceMutation.isPending) {
    return (
      <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-[#1E2327] border border-[#D7A84B] text-[11px] font-mono text-[#D7A84B]">
        <span className="inline-block w-2.5 h-2.5 border-2 border-[#D7A84B] border-t-transparent animate-spin" />
        <span>Tracing branch to 6 hops...</span>
      </div>
    );
  }

  if (deepTraceMutation.isError) {
    return (
      <button
        type="button"
        onClick={handleDeepTrace}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#171A1D] border border-[#D87870] text-[11px] font-mono text-[#D87870] hover:bg-[#D87870]/10 transition-colors"
        title={deepTraceMutation.error.message}
      >
        <span>⚠️ Retry Deep Trace</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleDeepTrace}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#171A1D] border border-[#D7A84B] text-[11px] font-mono text-[#D7A84B] hover:bg-[#D7A84B] hover:text-[#101214] font-semibold transition-colors active:translate-y-[-1px]"
    >
      <span>+ Deep Trace (Extend to 6 Hops)</span>
    </button>
  );
}
