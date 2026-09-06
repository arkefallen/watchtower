"use client";

import React, { useState } from "react";
import type { ChainSlug } from "@/lib/settings-schema";

export interface StableTokenItem {
  address: string;
  symbol: string;
}

export interface StableTokensConfig {
  base: StableTokenItem[];
  bsc: StableTokenItem[];
  robinhood: StableTokenItem[];
}

interface StableListEditorProps {
  stableTokens: StableTokensConfig;
  onChange: (updated: StableTokensConfig) => void;
  disabled?: boolean;
}

const CHAINS: { slug: ChainSlug; label: string }[] = [
  { slug: "base", label: "Base" },
  { slug: "bsc", label: "BNB Smart Chain (BSC)" },
  { slug: "robinhood", label: "Robinhood Chain" },
];

export function StableListEditor({
  stableTokens,
  onChange,
  disabled = false,
}: StableListEditorProps) {
  const [selectedChain, setSelectedChain] = useState<ChainSlug>("base");
  const [newSymbol, setNewSymbol] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentList = stableTokens[selectedChain] ?? [];

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const symbol = newSymbol.trim().toUpperCase();
    const address = newAddress.trim().toLowerCase();

    if (!symbol) {
      setErrorMsg("Symbol is required (e.g. USDC).");
      return;
    }

    if (!/^0x[a-f0-9]{40}$/.test(address)) {
      setErrorMsg("Must be a valid 40-character hexadecimal EVM address starting with 0x.");
      return;
    }

    if (currentList.some((item) => item.address.toLowerCase() === address)) {
      setErrorMsg(`Address already configured for ${selectedChain.toUpperCase()}.`);
      return;
    }

    const updatedList = [...currentList, { symbol, address }];
    onChange({
      ...stableTokens,
      [selectedChain]: updatedList,
    });

    setNewSymbol("");
    setNewAddress("");
  };

  const handleRemove = (addressToRemove: string) => {
    const updatedList = currentList.filter(
      (item) => item.address.toLowerCase() !== addressToRemove.toLowerCase()
    );
    onChange({
      ...stableTokens,
      [selectedChain]: updatedList,
    });
  };

  return (
    <section className="flex flex-col gap-4" aria-labelledby="stablecoins-heading">
      <header className="border-b border-[#30373D] pb-2 flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h2 id="stablecoins-heading" className="text-[18px] font-bold text-[#E8ECEF] font-sans">
            Configured Stablecoins
          </h2>
          <p className="text-[12px] text-[#929BA3] font-sans mt-0.5">
            Assets treated as stable parking reserves and valued at 1:1 USD parity for A1 and flow detection
          </p>
        </div>
        <div className="flex items-center gap-1 bg-[#101214] p-1 border border-[#30373D]">
          {CHAINS.map(({ slug, label }) => (
            <button
              key={slug}
              type="button"
              disabled={disabled}
              onClick={() => {
                setSelectedChain(slug);
                setErrorMsg(null);
              }}
              className={`px-3 py-1 text-[11px] font-mono transition-colors rounded-none ${
                selectedChain === slug
                  ? "bg-[#D7A84B] text-[#101214] font-bold"
                  : "text-[#929BA3] hover:text-[#E8ECEF] hover:bg-[#171A1D]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active List for Selected Chain */}
        <div className="lg:col-span-2 bg-[#171A1D] border border-[#30373D] p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[#30373D] pb-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-[#D7A84B]">
              {selectedChain.toUpperCase()} Stablecoin Registry ({currentList.length})
            </span>
            <span className="text-[10px] text-[#929BA3] font-mono">
              Parity: $1.00 USD Fixed
            </span>
          </div>

          {currentList.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-[#30373D] text-[#929BA3] font-mono text-[12px]">
              No stablecoins configured for this chain. Add one using the form.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-[12px]">
                <thead>
                  <tr className="border-b border-[#30373D] text-[#929BA3] text-[10px] uppercase tracking-wider">
                    <th className="pb-2 font-normal">Symbol</th>
                    <th className="pb-2 font-normal">Contract Address</th>
                    <th className="pb-2 font-normal text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#30373D]/50">
                  {currentList.map((token) => (
                    <tr key={token.address} className="hover:bg-[#101214]/50 group">
                      <td className="py-2.5 font-bold text-[#E8ECEF]">
                        <span className="px-2 py-0.5 border border-[#30373D] bg-[#101214] text-[#D7A84B]">
                          {token.symbol}
                        </span>
                      </td>
                      <td className="py-2.5 text-[#929BA3] group-hover:text-[#E8ECEF] font-mono text-[12px] break-all">
                        {token.address}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => handleRemove(token.address)}
                          className="px-2 py-1 text-[10px] text-[#D87870] hover:bg-[#D87870]/10 border border-transparent hover:border-[#D87870] transition-colors rounded-none"
                          title={`Remove ${token.symbol}`}
                        >
                          ✕ REMOVE
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add New Stablecoin Card */}
        <div className="bg-[#171A1D] border border-[#30373D] p-4 flex flex-col gap-4">
          <div className="border-b border-[#30373D] pb-2">
            <h3 className="text-[12px] font-semibold uppercase text-[#E8ECEF] font-sans tracking-wider">
              Add Stablecoin ({selectedChain.toUpperCase()})
            </h3>
            <p className="text-[10px] text-[#929BA3] mt-0.5">
              Add a token contract to be treated as a stable asset on {selectedChain}.
            </p>
          </div>

          <form onSubmit={handleAdd} className="flex flex-col gap-3">
            <div>
              <label htmlFor="new-token-symbol" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
                Token Symbol *
              </label>
              <input
                id="new-token-symbol"
                type="text"
                disabled={disabled}
                placeholder="e.g. USDC, USDT, DAI"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                className="w-full bg-[#101214] border border-[#30373D] text-[#E8ECEF] font-mono text-[13px] px-3 py-1.5 focus:border-[#D7A84B] focus:outline-none rounded-none"
              />
            </div>

            <div>
              <label htmlFor="new-token-address" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
                Contract Address (0x...) *
              </label>
              <input
                id="new-token-address"
                type="text"
                disabled={disabled}
                placeholder="0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                className="w-full bg-[#101214] border border-[#30373D] text-[#E8ECEF] font-mono text-[12px] px-3 py-1.5 focus:border-[#D7A84B] focus:outline-none rounded-none break-all"
              />
            </div>

            {errorMsg && (
              <div className="p-2 border border-[#D87870] bg-[#D87870]/10 text-[#D87870] font-mono text-[11px]" role="alert">
                ⚠️ {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={disabled}
              className="mt-2 w-full py-2 bg-[#1E2327] hover:bg-[#D7A84B] text-[#E8ECEF] hover:text-[#101214] border border-[#30373D] hover:border-[#D7A84B] font-bold font-sans text-[11px] uppercase tracking-wider transition-colors rounded-none"
            >
              + Add to {selectedChain.toUpperCase()}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
