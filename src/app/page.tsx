import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#101214] text-[#E8ECEF] p-6 max-w-[1440px] mx-auto w-full flex flex-col gap-6">
      {/* Top Header */}
      <div className="border-b border-[#30373D] pb-5">
        <div className="font-mono text-[12px] text-[#929BA3] uppercase tracking-wider mb-2 flex items-center gap-2">
          <span>WATCHTOWER</span>
          <span className="text-[#30373D]">/</span>
          <span className="text-[#D7A84B]">OBSERVATORY DASHBOARD</span>
        </div>
        <h1 className="font-sans text-[32px] font-bold text-[#E8ECEF] uppercase tracking-tight">
          ONCHAIN INTELLIGENCE
        </h1>
        <p className="font-sans text-[14px] text-[#929BA3] mt-1">
          Local, privacy-first EVM surveillance and recursive funding analysis console
        </p>
      </div>

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/wallets"
          className="bg-[#171A1D] border border-[#30373D] hover:border-[#D7A84B] p-5 flex flex-col justify-between group transition-colors"
        >
          <div>
            <div className="flex items-center justify-between text-[#D7A84B] mb-3">
              <span className="material-symbols-outlined text-[24px]">account_balance_wallet</span>
              <span className="font-mono text-[10px] uppercase border border-[#30373D] px-1.5 py-0.5 text-[#E8ECEF]">
                REGISTRY
              </span>
            </div>
            <h2 className="font-sans text-[18px] font-bold text-[#E8ECEF] uppercase group-hover:text-[#D7A84B] transition-colors">
              Wallets Watchlist
            </h2>
            <p className="font-mono text-[12px] text-[#929BA3] mt-2">
              Dense multi-chain watchlist table with behavioral labeling, parked stables, and alert states.
            </p>
          </div>
          <div className="mt-4 font-mono text-[11px] text-[#D7A84B] flex items-center gap-1">
            <span>Explore Registry</span>
            <span>→</span>
          </div>
        </Link>

        <Link
          href="/wallets/new"
          className="bg-[#171A1D] border border-[#30373D] hover:border-[#D7A84B] p-5 flex flex-col justify-between group transition-colors"
        >
          <div>
            <div className="flex items-center justify-between text-[#D7A84B] mb-3">
              <span className="material-symbols-outlined text-[24px]">input</span>
              <span className="font-mono text-[10px] uppercase border border-[#30373D] px-1.5 py-0.5 text-[#E8ECEF]">
                INTAKE
              </span>
            </div>
            <h2 className="font-sans text-[18px] font-bold text-[#E8ECEF] uppercase group-hover:text-[#D7A84B] transition-colors">
              Import &amp; Intake
            </h2>
            <p className="font-mono text-[12px] text-[#929BA3] mt-2">
              Single-address registration with live ENS v2 Universal Resolver, or batch CSV parser with syntax checking.
            </p>
          </div>
          <div className="mt-4 font-mono text-[11px] text-[#D7A84B] flex items-center gap-1">
            <span>Register Wallets</span>
            <span>→</span>
          </div>
        </Link>

        <Link
          href="/clusters"
          className="bg-[#171A1D] border border-[#30373D] hover:border-[#D7A84B] p-5 flex flex-col justify-between group transition-colors"
        >
          <div>
            <div className="flex items-center justify-between text-[#D7A84B] mb-3">
              <span className="material-symbols-outlined text-[24px]">hub</span>
              <span className="font-mono text-[10px] uppercase border border-[#30373D] px-1.5 py-0.5 text-[#E8ECEF]">
                CLUSTERS
              </span>
            </div>
            <h2 className="font-sans text-[18px] font-bold text-[#E8ECEF] uppercase group-hover:text-[#D7A84B] transition-colors">
              Shared Funder Hubs
            </h2>
            <p className="font-mono text-[12px] text-[#929BA3] mt-2">
              Sybil cluster directories detected via shared funding roots with aggregated stable balances and rotation analysis.
            </p>
          </div>
          <div className="mt-4 font-mono text-[11px] text-[#D7A84B] flex items-center gap-1">
            <span>View Clusters</span>
            <span>→</span>
          </div>
        </Link>

        <Link
          href="/health"
          className="bg-[#171A1D] border border-[#30373D] hover:border-[#D7A84B] p-5 flex flex-col justify-between group transition-colors"
        >
          <div>
            <div className="flex items-center justify-between text-[#79B79A] mb-3">
              <span className="material-symbols-outlined text-[24px]">health_and_safety</span>
              <span className="font-mono text-[10px] uppercase border border-[#30373D] px-1.5 py-0.5 text-[#79B79A]">
                HEALTH
              </span>
            </div>
            <h2 className="font-sans text-[18px] font-bold text-[#E8ECEF] uppercase group-hover:text-[#D7A84B] transition-colors">
              System Telemetry
            </h2>
            <p className="font-mono text-[12px] text-[#929BA3] mt-2">
              Database, Redis, BullMQ workers, provider rate limits, and daily API quotas across Base, BSC, and Robinhood.
            </p>
          </div>
          <div className="mt-4 font-mono text-[11px] text-[#79B79A] flex items-center gap-1">
            <span>Check Health</span>
            <span>→</span>
          </div>
        </Link>
      </div>

      {/* Seed Scenario Quick Action Callout */}
      <div className="bg-[#171A1D] border border-[#30373D] p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="text-[14px] font-bold text-[#E8ECEF] uppercase font-['Geist'] flex items-center gap-2">
            <span className="w-2 h-2 rounded-none bg-[#D7A84B]" />
            <span>Phase 1 Verification Scenario Available</span>
          </div>
          <p className="font-mono text-[12px] text-[#929BA3] mt-1">
            Want to populate your database with the approved 10-wallet test scenario (Binance CEX terminal funder, shared clusters, internal txs)?
          </p>
        </div>
        <Link
          href="/wallets/new"
          className="px-4 py-2 bg-[#D7A84B] text-[#101214] font-bold text-[11px] uppercase tracking-wider font-['Geist'] hover:brightness-110 shrink-0"
        >
          Go To Import Console →
        </Link>
      </div>
    </main>
  );
}
