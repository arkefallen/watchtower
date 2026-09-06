// src/components/wallets/SelfWalletCard.tsx
"use client";

import React from "react";
import Link from "next/link";
function formatAddress(addr: string): string {
  if (!addr) return "";
  return addr.length > 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;
}

interface SelfWalletCardProps {
  wallet: {
    address: string;
    chain: string;
    label?: string | null;
    ensName?: string | null;
    isSelf?: boolean;
    syncState?: {
      status: string;
      lastSyncedAt?: string | Date | null;
    } | null;
    _count?: {
      ownTrades?: number;
      movements?: number;
    } | null;
  };
  onToggleSelf?: (address: string, chain: string, isSelf: boolean) => void;
  onResync?: (address: string, chain: string) => void;
}

export function SelfWalletCard({ wallet, onToggleSelf, onResync }: SelfWalletCardProps) {
  const displayName = wallet.label || wallet.ensName || formatAddress(wallet.address);
  const tradeCount = wallet._count?.ownTrades ?? 0;
  const movementCount = wallet._count?.movements ?? 0;

  return (
    <div className="bg-[#171A1D] border border-[#30373D] border-l-4 border-l-[#D7A84B] p-4 flex flex-col justify-between gap-3 transition-colors hover:border-[#D7A84B]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#101214] text-[#D7A84B] border border-[#30373D] uppercase">
              SELF WALLET
            </span>
            <span className="text-[10px] font-mono text-[#929BA3] uppercase">
              {wallet.chain}
            </span>
          </div>
          <h4 className="text-[14px] font-semibold text-[#E8ECEF] mt-1 font-mono">
            {displayName}
          </h4>
          <p className="text-[11px] font-mono text-[#929BA3]">
            {wallet.address}
          </p>
        </div>

        <div className="text-right">
          <span
            className={`inline-block px-1.5 py-0.5 text-[9px] font-mono uppercase ${
              wallet.syncState?.status === "IDLE"
                ? "text-[#79B79A] bg-[#101214] border border-[#30373D]"
                : wallet.syncState?.status === "RUNNING"
                ? "text-[#D7A84B] bg-[#101214] border border-[#30373D] animate-pulse"
                : "text-[#929BA3] bg-[#101214] border border-[#30373D]"
            }`}
          >
            ● {wallet.syncState?.status || "NEVER_SYNCED"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 py-2 border-t border-b border-[#30373D]/60 text-[11px] font-mono">
        <div>
          <span className="text-[#929BA3]">LOGGED TRADES: </span>
          <span className="text-[#E8ECEF] font-semibold">{tradeCount}</span>
        </div>
        <div>
          <span className="text-[#929BA3]">MOVEMENTS: </span>
          <span className="text-[#E8ECEF] font-semibold">{movementCount}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <Link
          href={`/self?wallet=${wallet.address}&chain=${wallet.chain.toLowerCase()}`}
          className="text-[11px] font-mono text-[#D7A84B] hover:underline flex items-center gap-1"
        >
          ANALYZE EDGE →
        </Link>

        <div className="flex items-center gap-2">
          {onResync && (
            <button
              onClick={() => onResync(wallet.address, wallet.chain)}
              className="px-2 py-1 text-[10px] font-mono text-[#929BA3] hover:text-[#E8ECEF] bg-[#101214] border border-[#30373D] hover:border-[#929BA3]"
            >
              RESYNC
            </button>
          )}
          {onToggleSelf && (
            <button
              onClick={() => onToggleSelf(wallet.address, wallet.chain, false)}
              className="px-2 py-1 text-[10px] font-mono text-[#D87870] hover:text-white bg-[#101214] border border-[#30373D] hover:border-[#D87870]"
              title="Remove self flag and convert to normal watchlist wallet"
            >
              UNMARK SELF
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
