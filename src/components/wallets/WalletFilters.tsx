"use client";

import React from "react";

export type TimeFormat = "local" | "utc" | "block";

export interface WalletFilterState {
  search: string;
  chain: string;
  tag: string;
  clusterId: string;
  alertState: string;
  timeFormat: TimeFormat;
}

export interface WalletFiltersProps {
  filters: WalletFilterState;
  onFilterChange: (filters: WalletFilterState) => void;
  clusterOptions?: Array<{ id: string; name?: string | null }>;
  totalCount?: number;
  filteredCount?: number;
  className?: string;
}

export function WalletFilters({
  filters,
  onFilterChange,
  clusterOptions = [],
  totalCount,
  filteredCount,
  className = "",
}: WalletFiltersProps) {
  const updateField = <K extends keyof WalletFilterState>(field: K, val: WalletFilterState[K]) => {
    onFilterChange({
      ...filters,
      [field]: val,
    });
  };

  const clearAll = () => {
    onFilterChange({
      search: "",
      chain: "",
      tag: "",
      clusterId: "",
      alertState: "",
      timeFormat: filters.timeFormat,
    });
  };

  const hasActiveFilters = Boolean(
    filters.search || filters.chain || filters.tag || filters.clusterId || filters.alertState
  );

  return (
    <div className={`bg-[#171A1D] border border-[#30373D] p-3 flex flex-col gap-3 ${className}`}>
      {/* Search & Selects Bar */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#929BA3]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => updateField("search", e.target.value)}
            placeholder="Search 0x address, ENS name, or label..."
            className="w-full h-8 bg-[#101214] border border-[#30373D] text-[#E8ECEF] font-mono text-[13px] pl-9 pr-3 rounded-none focus:outline-none focus:border-[#D7A84B] placeholder-[#929BA3]"
          />
        </div>

        {/* Chain dropdown */}
        <select
          value={filters.chain}
          onChange={(e) => updateField("chain", e.target.value)}
          className="h-8 bg-[#101214] border border-[#30373D] text-[#E8ECEF] font-sans text-[12px] uppercase px-3 rounded-none focus:outline-none focus:border-[#D7A84B]"
        >
          <option value="">All Chains (Base, BSC, Robinhood)</option>
          <option value="base">Base</option>
          <option value="bsc">BSC</option>
          <option value="robinhood">Robinhood</option>
        </select>

        {/* Tag filter */}
        <select
          value={filters.tag}
          onChange={(e) => updateField("tag", e.target.value)}
          className="h-8 bg-[#101214] border border-[#30373D] text-[#E8ECEF] font-sans text-[12px] uppercase px-3 rounded-none focus:outline-none focus:border-[#D7A84B]"
        >
          <option value="">Edge / Style / Size</option>
          <option value="SMART">Edge: SMART</option>
          <option value="BOT">Edge: BOT</option>
          <option value="EARLY">Edge: EARLY</option>
          <option value="INSIDER">Edge: INSIDER</option>
          <option value="SNIPER">Style: SNIPER</option>
          <option value="SWING">Style: SWING</option>
          <option value="RIDER">Style: RIDER</option>
          <option value="WHALE">Size: WHALE (W)</option>
          <option value="DOLPHIN">Size: DOLPHIN (M)</option>
          <option value="SHRIMP">Size: SHRIMP (S)</option>
        </select>

        {/* Cluster dropdown */}
        <select
          value={filters.clusterId}
          onChange={(e) => updateField("clusterId", e.target.value)}
          className="h-8 bg-[#101214] border border-[#30373D] text-[#E8ECEF] font-sans text-[12px] uppercase px-3 rounded-none focus:outline-none focus:border-[#D7A84B]"
        >
          <option value="">All Clusters</option>
          {clusterOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name ? c.name : `Cluster #${c.id.slice(0, 4)}`}
            </option>
          ))}
        </select>

        {/* Alert state dropdown */}
        <select
          value={filters.alertState}
          onChange={(e) => updateField("alertState", e.target.value)}
          className="h-8 bg-[#101214] border border-[#30373D] text-[#E8ECEF] font-sans text-[12px] uppercase px-3 rounded-none focus:outline-none focus:border-[#D7A84B]"
        >
          <option value="">All Alert States</option>
          <option value="IDLE">IDLE</option>
          <option value="ARMED">ARMED</option>
          <option value="TRIGGERED">TRIGGERED</option>
        </select>
      </div>

      {/* Active Filters Row & Timezone Toggle */}
      <div className="flex flex-wrap items-center justify-between border-t border-[#30373D] pt-3 gap-2">
        {/* Active Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {hasActiveFilters && (
            <span className="font-mono text-[11px] text-[#929BA3] uppercase mr-1">
              Active:
            </span>
          )}

          {filters.search && (
            <div className="flex items-center gap-1.5 bg-[#101214] border border-[#30373D] px-2 py-0.5 font-mono text-[11px] text-[#E8ECEF]">
              <span>Search: {filters.search}</span>
              <button
                type="button"
                onClick={() => updateField("search", "")}
                className="text-[#929BA3] hover:text-[#D7A84B]"
              >
                ✕
              </button>
            </div>
          )}

          {filters.chain && (
            <div className="flex items-center gap-1.5 bg-[#101214] border border-[#30373D] px-2 py-0.5 font-mono text-[11px] text-[#E8ECEF] uppercase">
              <span>Chain: {filters.chain}</span>
              <button
                type="button"
                onClick={() => updateField("chain", "")}
                className="text-[#929BA3] hover:text-[#D7A84B]"
              >
                ✕
              </button>
            </div>
          )}

          {filters.tag && (
            <div className="flex items-center gap-1.5 bg-[#101214] border border-[#30373D] px-2 py-0.5 font-mono text-[11px] text-[#E8ECEF] uppercase">
              <span>Tag: {filters.tag}</span>
              <button
                type="button"
                onClick={() => updateField("tag", "")}
                className="text-[#929BA3] hover:text-[#D7A84B]"
              >
                ✕
              </button>
            </div>
          )}

          {filters.clusterId && (
            <div className="flex items-center gap-1.5 bg-[#101214] border border-[#30373D] px-2 py-0.5 font-mono text-[11px] text-[#E8ECEF]">
              <span>Cluster: #{filters.clusterId.slice(0, 4)}</span>
              <button
                type="button"
                onClick={() => updateField("clusterId", "")}
                className="text-[#929BA3] hover:text-[#D7A84B]"
              >
                ✕
              </button>
            </div>
          )}

          {filters.alertState && (
            <div className="flex items-center gap-1.5 bg-[#101214] border border-[#30373D] px-2 py-0.5 font-mono text-[11px] text-[#D7A84B] uppercase">
              <span>Alert: {filters.alertState}</span>
              <button
                type="button"
                onClick={() => updateField("alertState", "")}
                className="text-[#929BA3] hover:text-[#D7A84B]"
              >
                ✕
              </button>
            </div>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="font-sans text-[11px] font-semibold text-[#929BA3] hover:text-[#D7A84B] uppercase ml-1 underline cursor-pointer"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Right side: Count & Time Toggle */}
        <div className="flex items-center gap-4 ml-auto">
          {typeof filteredCount === "number" && (
            <span className="font-mono text-[11px] text-[#929BA3] uppercase">
              Showing {filteredCount} {typeof totalCount === "number" ? `of ${totalCount}` : ""} wallets
            </span>
          )}

          {/* Time mode toggle */}
          <div className="flex bg-[#101214] border border-[#30373D]">
            <button
              type="button"
              onClick={() => updateField("timeFormat", "local")}
              className={`px-3 py-1 font-mono text-[11px] uppercase transition-colors ${
                filters.timeFormat === "local"
                  ? "bg-[#1E2327] text-[#E8ECEF] font-bold"
                  : "text-[#929BA3] hover:text-[#E8ECEF]"
              }`}
            >
              Local (Asia/Jakarta)
            </button>
            <button
              type="button"
              onClick={() => updateField("timeFormat", "utc")}
              className={`px-3 py-1 font-mono text-[11px] uppercase border-l border-[#30373D] transition-colors ${
                filters.timeFormat === "utc"
                  ? "bg-[#1E2327] text-[#E8ECEF] font-bold"
                  : "text-[#929BA3] hover:text-[#E8ECEF]"
              }`}
            >
              UTC
            </button>
            <button
              type="button"
              onClick={() => updateField("timeFormat", "block")}
              className={`px-3 py-1 font-mono text-[11px] uppercase border-l border-[#30373D] transition-colors ${
                filters.timeFormat === "block"
                  ? "bg-[#1E2327] text-[#E8ECEF] font-bold"
                  : "text-[#929BA3] hover:text-[#E8ECEF]"
              }`}
            >
              Block
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
