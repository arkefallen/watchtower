// src/components/self/TradeLogForm.tsx
"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc/client";

interface TradeLogFormProps {
  onSuccess?: () => void;
  prefillFollowedWallet?: string;
  prefillTokenAddress?: string;
}

export function TradeLogForm({
  onSuccess,
  prefillFollowedWallet,
  prefillTokenAddress,
}: TradeLogFormProps) {
  const [ownWalletAddress, setOwnWalletAddress] = useState("");
  const [ownChain, setOwnChain] = useState<"base" | "bsc" | "robinhood">("base");
  const [tokenAddress, setTokenAddress] = useState(prefillTokenAddress || "");
  const [tokenChain, setTokenChain] = useState<"base" | "bsc" | "robinhood">("base");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [amountUsd, setAmountUsd] = useState("");
  const [entryAt, setEntryAt] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16);
  });
  const [followedWalletAddress, setFollowedWalletAddress] = useState(
    prefillFollowedWallet || ""
  );
  const [thesis, setThesis] = useState("");
  const [thesisError, setThesisError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load registered self wallets
  const selfWalletsQuery = trpc.self.wallets.useQuery();
  // Load candidate followed wallets for auto-complete
  const watchlistQuery = trpc.wallet.list.useQuery({ take: 100 });

  const addTradeMutation = trpc.self.addTrade.useMutation();

  // Set default own wallet if available and not selected
  React.useEffect(() => {
    if (!ownWalletAddress && selfWalletsQuery.data && selfWalletsQuery.data.length > 0) {
      setOwnWalletAddress(selfWalletsQuery.data[0].address);
      setOwnChain(selfWalletsQuery.data[0].chain as any);
    }
  }, [selfWalletsQuery.data, ownWalletAddress]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setThesisError(null);
    setGeneralError(null);

    // Validate thesis server-side simulation & local check
    if (!thesis || thesis.trim().length === 0) {
      setThesisError("Thesis is required for manual trades");
      return;
    }

    if (!ownWalletAddress) {
      setGeneralError("Please register or select an own wallet first");
      return;
    }

    if (!tokenAddress || !tokenAddress.startsWith("0x") || tokenAddress.length !== 42) {
      setGeneralError("Please provide a valid 42-character token address (0x...)");
      return;
    }

    if (!amountUsd || isNaN(Number(amountUsd)) || Number(amountUsd) <= 0) {
      setGeneralError("Please provide a valid positive USD amount");
      return;
    }

    setIsSubmitting(true);
    try {
      await addTradeMutation.mutateAsync({
        ownWalletAddress,
        ownChain,
        tokenAddress,
        tokenChain,
        side,
        amountUsd,
        entryAt: new Date(entryAt),
        followedWalletAddress: followedWalletAddress.trim() || undefined,
        followedWalletChain: followedWalletAddress.trim() ? ownChain : undefined,
        thesis: thesis.trim(),
        source: "MANUAL",
      });

      // Clear form
      setThesis("");
      setAmountUsd("");
      setFollowedWalletAddress("");
      if (onSuccess) onSuccess();
    } catch (err: any) {
      if (err?.message?.includes("Thesis")) {
        setThesisError(err.message);
      } else {
        setGeneralError(err.message || "Failed to record manual trade");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPinned = Boolean(followedWalletAddress && followedWalletAddress.trim().length > 0);

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#171A1D] border border-[#30373D] p-5 space-y-4 max-w-[800px]"
    >
      <div className="flex items-center justify-between border-b border-[#30373D] pb-3">
        <div>
          <h3 className="text-[14px] font-mono font-semibold uppercase text-[#E8ECEF] flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-[#D7A84B]"></span>
            LOG MANUAL TRADE
          </h3>
          <p className="text-[12px] font-mono text-[#929BA3] mt-0.5">
            Narrative-enforced execution recording (FR-6.3)
          </p>
        </div>
        {isPinned && (
          <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-[#101214] text-[#D7A84B] border border-[#D7A84B]">
            📌 LINK WILL BE PINNED
          </span>
        )}
      </div>

      {generalError && (
        <div className="p-3 bg-[#101214] border border-[#D87870] text-[#D87870] text-[12px] font-mono">
          [ERROR] {generalError}
        </div>
      )}

      {/* Row 1: Own Wallet & Chain */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="block text-[11px] font-mono uppercase text-[#929BA3] mb-1">
            OWN WALLET (isSelf) *
          </label>
          {selfWalletsQuery.data && selfWalletsQuery.data.length > 0 ? (
            <select
              value={ownWalletAddress}
              onChange={(e) => {
                setOwnWalletAddress(e.target.value);
                const selected = selfWalletsQuery.data.find(
                  (w) => w.address === e.target.value
                );
                if (selected) setOwnChain(selected.chain as any);
              }}
              className="w-full bg-[#101214] border border-[#30373D] text-[#E8ECEF] text-[12px] font-mono p-2 focus:border-[#D7A84B] focus:outline-none"
            >
              {selfWalletsQuery.data.map((w) => (
                <option key={`${w.chain}-${w.address}`} value={w.address}>
                  {w.label ? `${w.label} (${w.address.slice(0, 8)}...)` : w.address} [{w.chain.toUpperCase()}]
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              placeholder="0x... (register a self wallet first)"
              value={ownWalletAddress}
              onChange={(e) => setOwnWalletAddress(e.target.value)}
              className="w-full bg-[#101214] border border-[#30373D] text-[#E8ECEF] text-[12px] font-mono p-2 focus:border-[#D7A84B] focus:outline-none"
            />
          )}
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-[#929BA3] mb-1">
            CHAIN *
          </label>
          <select
            value={ownChain}
            onChange={(e) => {
              const c = e.target.value as "base" | "bsc" | "robinhood";
              setOwnChain(c);
              setTokenChain(c);
            }}
            className="w-full bg-[#101214] border border-[#30373D] text-[#E8ECEF] text-[12px] font-mono p-2 focus:border-[#D7A84B] focus:outline-none"
          >
            <option value="base">Base</option>
            <option value="bsc">BSC</option>
            <option value="robinhood">Robinhood</option>
          </select>
        </div>
      </div>

      {/* Row 2: Token Address & Side */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-3">
          <label className="block text-[11px] font-mono uppercase text-[#929BA3] mb-1">
            TOKEN ADDRESS *
          </label>
          <input
            type="text"
            placeholder="0x..."
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            className="w-full bg-[#101214] border border-[#30373D] text-[#E8ECEF] text-[12px] font-mono p-2 focus:border-[#D7A84B] focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-[#929BA3] mb-1">
            SIDE *
          </label>
          <div className="grid grid-cols-2 border border-[#30373D] bg-[#101214]">
            <button
              type="button"
              onClick={() => setSide("BUY")}
              className={`p-2 text-[11px] font-mono font-bold uppercase transition-colors ${
                side === "BUY"
                  ? "bg-[#D7A84B] text-[#101214]"
                  : "text-[#929BA3] hover:text-[#E8ECEF]"
              }`}
            >
              BUY
            </button>
            <button
              type="button"
              onClick={() => setSide("SELL")}
              className={`p-2 text-[11px] font-mono font-bold uppercase transition-colors ${
                side === "SELL"
                  ? "bg-[#D87870] text-[#101214]"
                  : "text-[#929BA3] hover:text-[#E8ECEF]"
              }`}
            >
              SELL
            </button>
          </div>
        </div>
      </div>

      {/* Row 3: Amount USD & Entry Timestamp */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-mono uppercase text-[#929BA3] mb-1">
            AMOUNT (USD) *
          </label>
          <div className="relative">
            <span className="absolute left-2.5 top-2 text-[12px] font-mono text-[#929BA3]">
              $
            </span>
            <input
              type="number"
              step="any"
              placeholder="1000.00"
              value={amountUsd}
              onChange={(e) => setAmountUsd(e.target.value)}
              className="w-full bg-[#101214] border border-[#30373D] text-[#E8ECEF] text-[12px] font-mono p-2 pl-6 focus:border-[#D7A84B] focus:outline-none"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-mono uppercase text-[#929BA3] mb-1">
            ENTRY TIMESTAMP (UTC) *
          </label>
          <input
            type="datetime-local"
            value={entryAt}
            onChange={(e) => setEntryAt(e.target.value)}
            className="w-full bg-[#101214] border border-[#30373D] text-[#E8ECEF] text-[12px] font-mono p-2 focus:border-[#D7A84B] focus:outline-none"
            required
          />
        </div>
      </div>

      {/* Row 4: Optional Followed Wallet Link */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[11px] font-mono uppercase text-[#929BA3]">
            FOLLOWED SMART WALLET (OPTIONAL)
          </label>
          {isPinned && (
            <span className="text-[10px] font-mono text-[#D7A84B]">
              Pinning link overrides automatic matching
            </span>
          )}
        </div>
        <input
          type="text"
          placeholder="0x... (leave empty to auto-link to nearest graded entry)"
          value={followedWalletAddress}
          onChange={(e) => setFollowedWalletAddress(e.target.value)}
          className="w-full bg-[#101214] border border-[#30373D] text-[#E8ECEF] text-[12px] font-mono p-2 focus:border-[#D7A84B] focus:outline-none"
        />
      </div>

      {/* Row 5: Mandatory Thesis (FR-6.3) */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[11px] font-mono uppercase text-[#D7A84B] font-semibold">
            NARRATIVE THESIS (REQUIRED) *
          </label>
          <span className="text-[10px] font-mono text-[#929BA3]">
            &quot;What narrative I judged&quot;
          </span>
        </div>
        <textarea
          rows={3}
          placeholder="Document the exact thesis, catalyst, or rationale behind this trade..."
          value={thesis}
          onChange={(e) => {
            setThesis(e.target.value);
            if (thesisError) setThesisError(null);
          }}
          className={`w-full bg-[#101214] border text-[#E8ECEF] text-[12px] font-sans p-2 focus:outline-none ${
            thesisError ? "border-[#D87870]" : "border-[#30373D] focus:border-[#D7A84B]"
          }`}
          required
        />
        {thesisError && (
          <p className="text-[11px] font-mono text-[#D87870] mt-1 flex items-center gap-1">
            <span>⚠</span> {thesisError}
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2.5 bg-[#D7A84B] text-[#101214] font-mono text-[12px] font-bold uppercase hover:brightness-110 active:translate-y-[1px] transition-all disabled:opacity-50"
        >
          {isSubmitting ? "RECORDING..." : "RECORD TRADE [ENTER]"}
        </button>
      </div>
    </form>
  );
}
