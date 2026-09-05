"use client";

import React, { useState } from "react";

export interface AddressChipProps {
  address: string;
  ensName?: string | null;
  chain?: string;
  clusterColor?: string | null;
  truncate?: boolean;
  showCopy?: boolean;
  showExplorer?: boolean;
  className?: string;
}

function truncateAddress(addr: string): string {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function getExplorerUrl(address: string, chain: string = "base"): string {
  const norm = chain.toLowerCase();
  switch (norm) {
    case "bsc":
      return `https://bscscan.com/address/${address}`;
    case "robinhood":
      return `https://robinscan.io/address/${address}`;
    case "base":
    default:
      return `https://basescan.org/address/${address}`;
  }
}

export function AddressChip({
  address,
  ensName,
  chain = "base",
  clusterColor,
  truncate = true,
  showCopy = true,
  showExplorer = true,
  className = "",
}: AddressChipProps) {
  const [copied, setCopied] = useState(false);

  const displayAddr = truncate ? truncateAddress(address) : address;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = address;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className={`inline-flex items-center gap-2 font-mono text-[13px] ${className}`}>
      {clusterColor && (
        <span
          className="w-2 h-2 rounded-none shrink-0"
          style={{ backgroundColor: clusterColor }}
          title="Cluster Indicator"
        />
      )}
      <div className="flex flex-col">
        {ensName && (
          <span className="font-sans font-semibold text-[#E8ECEF] text-[13px] leading-tight">
            {ensName}
          </span>
        )}
        <div className="inline-flex items-center gap-1.5 text-[#929BA3] hover:text-[#D7A84B] transition-colors group">
          {showExplorer ? (
            <a
              href={getExplorerUrl(address, chain)}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline font-mono"
              title={`View on explorer (${address})`}
            >
              {displayAddr}
            </a>
          ) : (
            <span className="font-mono">{displayAddr}</span>
          )}

          {showCopy && (
            <button
              type="button"
              onClick={handleCopy}
              className="relative p-0.5 text-[#929BA3] hover:text-[#E8ECEF] transition-colors focus:outline-none"
              title="Copy address"
              aria-label="Copy address"
            >
              {copied ? (
                <span className="px-1 py-0.2 text-[10px] font-mono font-bold bg-[#D7A84B] text-[#101214]">
                  COPIED
                </span>
              ) : (
                <svg
                  className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
