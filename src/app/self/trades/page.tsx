// src/app/self/trades/page.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { TradeLogForm } from "@/components/self/TradeLogForm";

export default function ManualTradesPage() {
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const tradesQuery = trpc.self.trades.useQuery(
    { source: "MANUAL", limit: 50 },
    { refetchOnWindowFocus: false }
  );

  return (
    <main className="min-h-screen bg-[#101214] text-[#E8ECEF] flex flex-col p-6 max-w-[1440px] mx-auto w-full gap-6">
      {/* Breadcrumbs & Header */}
      <div>
        <div className="font-mono text-[12px] text-[#929BA3] uppercase mb-2 flex items-center gap-2">
          <Link href="/self" className="hover:text-[#E8ECEF]">
            SELF-TRACKING
          </Link>
          <span className="text-[#30373D]">/</span>
          <span className="text-[#D7A84B]">LOG TRADE</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-sans text-[28px] font-bold text-[#E8ECEF] uppercase tracking-tight">
              TRADE LOG & THESIS FORM
            </h1>
            <p className="font-sans text-[14px] text-[#929BA3] mt-1">
              Record manual trade decisions with strict narrative enforcement (FR-6.3)
            </p>
          </div>
          <Link
            href="/self"
            className="px-4 py-2 border border-[#30373D] text-[#E8ECEF] font-mono text-[12px] uppercase hover:bg-[#1E2327] transition-colors"
          >
            ← BACK TO DASHBOARD
          </Link>
        </div>
      </div>

      {/* Form Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <TradeLogForm
            onSuccess={() => {
              tradesQuery.refetch();
              setRefetchTrigger((t) => t + 1);
            }}
          />
        </div>

        {/* Informational Side Rail */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-[#171A1D] border border-[#30373D] p-4 space-y-3">
            <h4 className="text-[12px] font-mono font-semibold uppercase text-[#D7A84B]">
              OPERATING RULES (FR-6.3)
            </h4>
            <ul className="text-[12px] font-sans text-[#929BA3] space-y-2 list-disc list-inside">
              <li>
                <strong className="text-[#E8ECEF]">Mandatory Thesis:</strong> Every manual trade requires a non-empty thesis describing the catalyst and narrative judged.
              </li>
              <li>
                <strong className="text-[#E8ECEF]">Pinned Attribution:</strong> Selecting a followed wallet locks attribution. The automated signal linker will never overwrite pinned links.
              </li>
              <li>
                <strong className="text-[#E8ECEF]">Unified Analytics:</strong> Manual trades participate identically in Win Rate, PnL breakdowns, and Edge Decay curves.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Recent Manual Trades Table */}
      <section className="space-y-3 pt-4">
        <h3 className="text-[14px] font-mono font-semibold uppercase text-[#E8ECEF] flex items-center gap-2">
          <span className="inline-block w-2 h-2 bg-[#D7A84B]"></span>
          RECENT MANUAL EXECUTIONS ({tradesQuery.data?.rows.length ?? 0})
        </h3>

        <div className="border border-[#30373D] bg-[#171A1D] overflow-x-auto">
          <table className="w-full text-left text-[12px] font-mono border-collapse">
            <thead>
              <tr className="border-b border-[#30373D] bg-[#101214] text-[#929BA3] text-[11px] uppercase">
                <th className="p-3">ENTRY AT (UTC)</th>
                <th className="p-3">SIDE</th>
                <th className="p-3">TOKEN</th>
                <th className="p-3 text-right">AMOUNT USD</th>
                <th className="p-3">FOLLOWED WALLET</th>
                <th className="p-3">LAG</th>
                <th className="p-3">THESIS PREVIEW</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30373D]/60 text-[#E8ECEF]">
              {tradesQuery.isLoading ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-[#929BA3]">
                    Loading manual trades...
                  </td>
                </tr>
              ) : tradesQuery.data?.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-[#929BA3]">
                    No manual trades recorded yet. Use the form above to log your first trade.
                  </td>
                </tr>
              ) : (
                tradesQuery.data?.rows.map((t) => (
                  <tr key={t.id} className="hover:bg-[#1E2327]">
                    <td className="p-3 text-[#929BA3]">
                      {new Date(t.entryAt).toISOString().replace("T", " ").slice(0, 16)}
                    </td>
                    <td className="p-3 font-bold">
                      <span
                        className={
                          t.side === "BUY" ? "text-[#79B79A]" : "text-[#D87870]"
                        }
                      >
                        {t.side}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="font-semibold text-[#D7A84B]">
                        {t.tokenSymbol || "TOKEN"}
                      </span>
                      <span className="text-[#929BA3] text-[10px] ml-1">
                        ({t.tokenAddress.slice(0, 6)}...{t.tokenAddress.slice(-4)})
                      </span>
                    </td>
                    <td className="p-3 text-right font-semibold">
                      ${Number(t.amountUsd).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3">
                      {t.followedWalletAddress ? (
                        <div className="flex items-center gap-1.5">
                          {t.isLinkPinned && (
                            <span title="Pinned by user">📌</span>
                          )}
                          <span>
                            {t.followedWalletLabel ||
                              `${t.followedWalletAddress.slice(0, 6)}...${t.followedWalletAddress.slice(-4)}`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[#929BA3]">— (Auto-link)</span>
                      )}
                    </td>
                    <td className="p-3">
                      {t.lagMinutes !== null ? `${t.lagMinutes}m` : "—"}
                    </td>
                    <td className="p-3 max-w-[300px] truncate text-[#929BA3]" title={t.thesis || ""}>
                      {t.thesis || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
