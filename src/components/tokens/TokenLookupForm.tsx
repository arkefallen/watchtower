"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChainSlug } from "@/lib/chains/types";

interface TokenLookupFormProps {
  initialChain?: ChainSlug;
  initialAddress?: string;
}

export function TokenLookupForm({ initialChain = "base", initialAddress = "" }: TokenLookupFormProps) {
  const router = useRouter();
  const [chain, setChain] = useState<ChainSlug>(initialChain);
  const [address, setAddress] = useState(initialAddress);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const clean = address.trim().toLowerCase();
    if (!clean) {
      setError("Token contract address is required");
      return;
    }

    if (!/^0x[a-f0-9]{40}$/i.test(clean)) {
      setError("Please enter a valid 42-character EVM contract address (0x...)");
      return;
    }

    router.push(`/tokens/${chain}/${clean}`);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[#171A1D] border border-[#30373D] p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-[#E8ECEF] mb-3 font-['Geist'] flex items-center justify-between">
        <span>Token Intelligence Query</span>
        <span className="text-[11px] font-mono text-[#929BA3]">Local DB &lt; 3s SLA</span>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        {/* Chain selector */}
        <div className="w-full md:w-48">
          <label className="block text-[10px] uppercase font-mono text-[#929BA3] mb-1">
            Network Chain
          </label>
          <select
            value={chain}
            onChange={(e) => setChain(e.target.value as ChainSlug)}
            className="w-full bg-[#101214] border border-[#30373D] text-[#E8ECEF] px-3 py-2 text-xs font-mono focus:border-[#D7A84B] focus:outline-none"
          >
            <option value="base">Base (EVM)</option>
            <option value="bsc">BNB Chain (BSC)</option>
            <option value="robinhood">Robinhood Chain</option>
          </select>
        </div>

        {/* Token address */}
        <div className="flex-1">
          <label className="block text-[10px] uppercase font-mono text-[#929BA3] mb-1">
            Contract Address
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              if (error) setError(null);
            }}
            placeholder="0x..."
            className="w-full bg-[#101214] border border-[#30373D] text-[#E8ECEF] px-3 py-2 text-xs font-mono focus:border-[#D7A84B] focus:outline-none placeholder:text-[#929BA3]/50"
          />
        </div>

        {/* Submit */}
        <div className="flex items-end">
          <button
            type="submit"
            className="w-full md:w-auto px-6 py-2 bg-[#D7A84B] text-[#101214] hover:bg-[#f5c363] font-bold uppercase tracking-wider text-xs transition-colors font-['Geist']"
          >
            Lookup Token
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 text-xs font-mono text-[#D87870] flex items-center gap-1.5">
          <span>●</span>
          <span>{error}</span>
        </div>
      )}
    </form>
  );
}
