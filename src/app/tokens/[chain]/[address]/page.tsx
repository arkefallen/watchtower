"use client";

import React, { use, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import type { ChainSlug } from "@/lib/chains/types";
import { CHAIN_REGISTRY } from "@/lib/chains/registry";
import { HolderTable } from "@/components/tokens/HolderTable";
import { RedFlagList } from "@/components/tokens/RedFlagList";
import { TokenNetflowChart } from "@/components/tokens/TokenNetflowChart";
import { TokenLookupForm } from "@/components/tokens/TokenLookupForm";

interface PageProps {
  params: Promise<{
    chain: string;
    address: string;
  }>;
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function TokenDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const chain = (resolvedParams.chain as string).toLowerCase() as ChainSlug;
  const address = resolvedParams.address.toLowerCase();

  const [copied, setCopied] = useState(false);
  const [refreshSuccessMsg, setRefreshSuccessMsg] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.token.lookup.useQuery(
    { address, chain },
    {
      refetchOnWindowFocus: false,
    }
  );

  const refreshMutation = trpc.token.refresh.useMutation({
    onSuccess: (res) => {
      setRefreshSuccessMsg(`Job enqueued (${res.jobId.slice(-8)})`);
      setTimeout(() => setRefreshSuccessMsg(null), 3000);
      utils.token.lookup.invalidate({ address, chain });
    },
  });

  const explorerBase = CHAIN_REGISTRY[chain]?.explorerBaseUrl ?? "https://basescan.org";

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <main className="max-w-[1440px] mx-auto p-4 md:p-6 space-y-6">
        <div className="bg-[#171A1D] border border-[#30373D] p-6">
          <div className="font-mono text-xs text-[#D7A84B] animate-pulse">
            Querying local database for token {shortenAddress(address)} on {chain.toUpperCase()}...
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-[1440px] mx-auto p-4 md:p-6 space-y-6">
        <div className="bg-[#171A1D] border border-[#D87870] p-6 font-mono text-xs text-[#D87870]">
          Error querying token intelligence: {error.message}
        </div>
      </main>
    );
  }

  const isKnown = data?.isKnown ?? false;
  const token = data?.token;
  const holders = data?.holders ?? [];
  const netflow = data?.netflow ?? {
    window24h: { buyUsd: 0, sellUsd: 0, netUsd: 0, buyCount: 0, sellCount: 0 },
    window7d: { buyUsd: 0, sellUsd: 0, netUsd: 0, buyCount: 0, sellCount: 0 },
    window30d: { buyUsd: 0, sellUsd: 0, netUsd: 0, buyCount: 0, sellCount: 0 },
    history: [],
  };
  const clusterWarnings = data?.clusterWarnings ?? [];
  const redFlags = data?.redFlags ?? null;
  const supply = data?.supplyConcentration ?? {
    trackedWalletsCount: 0,
    totalTrackedHoldingsUsd: 0,
    trackedSupplySharePct: null,
    top10ExplorerSharePct: null,
  };

  return (
    <main className="max-w-[1440px] mx-auto p-4 md:p-6 space-y-6">
      {/* Quick Lookup Bar */}
      <TokenLookupForm initialChain={chain} initialAddress={address} />

      {/* Top Token Summary Card */}
      <section className="bg-[#171A1D] border border-[#30373D] p-5">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-[#30373D] pb-4 mb-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl md:text-2xl font-bold text-[#E8ECEF] font-['Geist']">
                {token?.symbol ? `$${token.symbol}` : "Unknown Token"}
              </h1>
              {token?.name && (
                <span className="text-sm font-normal text-[#929BA3]">
                  ({token.name})
                </span>
              )}
              <span className="px-2 py-0.5 border border-[#30373D] bg-[#101214] font-mono text-[11px] text-[#E8ECEF] uppercase font-semibold">
                {chain}
              </span>
              {isKnown ? (
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#79B79A]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#79B79A]" />
                  INDEXED IN DB
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#D7A84B]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D7A84B]" />
                  UNOBSERVED TOKEN
                </span>
              )}
            </div>

            {/* Address Chip */}
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-[#929BA3]">
              <div
                onClick={handleCopy}
                className="flex items-center gap-2 bg-[#101214] px-2.5 py-1 border border-[#30373D] hover:border-[#D7A84B] cursor-pointer transition-colors"
                title="Click to copy full contract address"
              >
                <span>{address}</span>
                <span className="text-[10px] text-[#D7A84B] font-bold">
                  {copied ? "COPIED!" : "COPY"}
                </span>
              </div>

              <a
                href={`${explorerBase}/token/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 bg-[#101214] border border-[#30373D] hover:text-[#D7A84B] transition-colors flex items-center gap-1"
              >
                <span>Explorer</span>
                <span className="text-[10px] text-[#D7A84B]">↗</span>
              </a>
            </div>
          </div>

          {/* Action & SLA Area */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="text-right font-mono text-[11px] text-[#929BA3]">
              <div>Rendered in {data?.renderDurationMs ?? 0}ms</div>
              <div className="text-[#79B79A]">✓ Local DB (&lt; 3s SLA)</div>
            </div>

            <button
              type="button"
              onClick={() => refreshMutation.mutate({ address, chain })}
              disabled={refreshMutation.isPending}
              className="px-4 py-2 border border-[#30373D] bg-[#101214] hover:border-[#D7A84B] text-[#E8ECEF] hover:text-[#D7A84B] text-xs font-bold uppercase tracking-wider transition-colors font-['Geist'] flex items-center gap-2 disabled:opacity-50"
            >
              <span>{refreshMutation.isPending ? "Enqueuing..." : "↻ Refresh Metadata"}</span>
            </button>

            {refreshSuccessMsg && (
              <span className="text-xs font-mono text-[#79B79A] font-semibold">
                ✓ {refreshSuccessMsg}
              </span>
            )}
          </div>
        </div>

        {/* Token Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 font-mono text-xs">
          {/* Price */}
          <div className="bg-[#101214] border border-[#30373D] p-3">
            <div className="text-[10px] uppercase text-[#929BA3] mb-1">Latest Price</div>
            <div className="text-sm font-bold text-[#E8ECEF]">
              {token?.latestPriceUsd
                ? `$${Number(token.latestPriceUsd) < 0.01 ? Number(token.latestPriceUsd).toPrecision(4) : Number(token.latestPriceUsd).toFixed(2)}`
                : "—"}
            </div>
          </div>

          {/* Market Cap */}
          <div className="bg-[#101214] border border-[#30373D] p-3">
            <div className="text-[10px] uppercase text-[#929BA3] mb-1">Market Cap</div>
            <div className="text-sm font-bold text-[#E8ECEF]">
              {token?.latestMarketCap
                ? `$${Number(token.latestMarketCap).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
                : "—"}
            </div>
          </div>

          {/* Tracked Supply % */}
          <div className="bg-[#101214] border border-[#30373D] p-3">
            <div className="text-[10px] uppercase text-[#929BA3] mb-1">Tracked Supply %</div>
            <div className="text-sm font-bold text-[#D7A84B]">
              {supply.trackedSupplySharePct !== null ? `${supply.trackedSupplySharePct}%` : "—"}
            </div>
          </div>

          {/* Tracked Holdings USD */}
          <div className="bg-[#101214] border border-[#30373D] p-3">
            <div className="text-[10px] uppercase text-[#929BA3] mb-1">Tracked Holdings</div>
            <div className="text-sm font-bold text-[#79B79A]">
              ${supply.totalTrackedHoldingsUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          {/* Deployer */}
          <div className="bg-[#101214] border border-[#30373D] p-3">
            <div className="text-[10px] uppercase text-[#929BA3] mb-1">Deployer Address</div>
            <div className="text-xs font-semibold text-[#E8ECEF] truncate">
              {token?.deployerAddress ? shortenAddress(token.deployerAddress) : "Unknown"}
            </div>
          </div>

          {/* Token Age */}
          <div className="bg-[#101214] border border-[#30373D] p-3">
            <div className="text-[10px] uppercase text-[#929BA3] mb-1">Contract Age</div>
            <div className="text-xs font-semibold text-[#E8ECEF]">
              {token?.tokenAgeDays !== null && token?.tokenAgeDays !== undefined
                ? `${token.tokenAgeDays}d old`
                : "Unknown"}
            </div>
          </div>
        </div>
      </section>

      {/* Unknown Token Defined Empty State (DoD) */}
      {!isKnown && (
        <section className="bg-[#171A1D] border border-[#D7A84B] p-6 text-center font-mono space-y-3">
          <div className="text-sm text-[#D7A84B] font-bold uppercase tracking-wider">
            Token Not Yet Observed in Local History
          </div>
          <p className="text-xs text-[#929BA3] max-w-xl mx-auto leading-relaxed">
            Address <span className="text-[#E8ECEF]">{address}</span> has not been transacted by any tracked wallets in the local database. Click &apos;Refresh Metadata&apos; to dispatch discovery via BullMQ, or paste a contract held by your monitored watchlist.
          </p>
        </section>
      )}

      {/* Red Flags & Forensics Rail (FR-7.2, FR-7.1) */}
      <section aria-label="Token Red Flags and Warnings">
        <RedFlagList
          redFlags={redFlags}
          clusterWarnings={clusterWarnings}
          chain={chain}
          explorerBaseUrl={explorerBase}
        />
      </section>

      {/* Tracked Holders Table (FR-7.1) */}
      <section aria-label="Tracked Wallet Holders">
        <HolderTable holders={holders} chain={chain} />
      </section>

      {/* Netflow Analytics (FR-7.1) */}
      <section aria-label="Tracked Netflow Analytics">
        <TokenNetflowChart netflow={netflow} symbol={token?.symbol} />
      </section>
    </main>
  );
}
