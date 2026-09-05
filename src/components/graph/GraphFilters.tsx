"use client";

import React from "react";

export interface GraphFiltersState {
  chain?: "BASE" | "BSC" | "ROBINHOOD";
  timeRange: "24H" | "7D" | "30D" | "ALL";
  minUsd: number;
  token?: string;
  direction?: "A_TO_B" | "B_TO_A" | "BOTH";
  sizeMode: "tag" | "balance";
  includeFunders: boolean;
  includePrimaryWallets: boolean;
}

export interface GraphFiltersProps {
  filters: GraphFiltersState;
  onChange: (updated: Partial<GraphFiltersState>) => void;
  onFitView: () => void;
  onExportPng: () => void;
}

export function GraphFilters({
  filters,
  onChange,
  onFitView,
  onExportPng,
}: GraphFiltersProps) {
  return (
    <div className="flex items-center flex-nowrap gap-1.5 bg-[#12161D]/90 backdrop-blur-md border border-[#30373D] rounded-xl px-2 py-1 shadow-lg text-[11px] font-mono select-none overflow-x-auto">
      {/* Time Range Selector */}
      <div className="flex items-center bg-[#171A1D] border border-[#30373D] rounded-lg p-0.5 shrink-0 h-7">
        {(["24H", "7D", "30D", "ALL"] as const).map((r) => (
          <button
            key={r}
            onClick={() => onChange({ timeRange: r })}
            className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all ${
              filters.timeRange === r
                ? "bg-[#D7A84B] text-[#0D1117] shadow-sm font-bold"
                : "text-[#929BA3] hover:text-[#E8ECEF] hover:bg-[#1E2327]"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Min USD Filter */}
      <div className="flex items-center gap-1 bg-[#171A1D] border border-[#30373D] rounded-lg px-2 shrink-0 h-7">
        <span className="text-[#929BA3] text-[10px]">Min</span>
        <span className="text-[#D7A84B] text-[10px]">$</span>
        <input
          type="number"
          min="0"
          step="50"
          value={filters.minUsd}
          onChange={(e) => onChange({ minUsd: Number(e.target.value) || 0 })}
          className="w-12 bg-transparent text-[#E8ECEF] text-[10.5px] font-mono focus:outline-none"
        />
      </div>

      {/* Token Search Filter */}
      <div className="flex items-center gap-1 bg-[#171A1D] border border-[#30373D] rounded-lg px-2 shrink-0 h-7">
        <span className="text-[#929BA3] text-[10px]">Token:</span>
        <input
          type="text"
          placeholder="All (PEPE, ETH...)"
          value={filters.token ?? ""}
          onChange={(e) => onChange({ token: e.target.value.trim() || undefined })}
          className="w-20 lg:w-24 bg-transparent text-[#E8ECEF] text-[10.5px] font-mono placeholder:text-[#42474C] focus:outline-none"
        />
        {filters.token && (
          <button
            onClick={() => onChange({ token: undefined })}
            className="text-[#929BA3] hover:text-[#E8ECEF] text-[10px]"
          >
            ✕
          </button>
        )}
      </div>

      {/* Node Size Mode Toggle */}
      <div className="flex items-center bg-[#171A1D] border border-[#30373D] rounded-lg p-0.5 shrink-0 h-7">
        <button
          onClick={() => onChange({ sizeMode: "tag" })}
          className={`px-2 py-0.5 text-[9px] uppercase font-semibold rounded-md transition-all ${
            filters.sizeMode === "tag"
              ? "bg-[#1E2327] text-[#D7A84B] border border-[#30373D]"
              : "text-[#929BA3] hover:text-[#E8ECEF]"
          }`}
        >
          Size Tag
        </button>
        <button
          onClick={() => onChange({ sizeMode: "balance" })}
          className={`px-2 py-0.5 text-[9px] uppercase font-semibold rounded-md transition-all ${
            filters.sizeMode === "balance"
              ? "bg-[#1E2327] text-[#D7A84B] border border-[#30373D]"
              : "text-[#929BA3] hover:text-[#E8ECEF]"
          }`}
        >
          Balance
        </button>
      </div>

      {/* Secondary Funders Toggle */}
      <label className="flex items-center gap-1.5 px-2 bg-[#171A1D] border border-[#30373D] rounded-lg cursor-pointer text-[10px] text-[#929BA3] hover:text-[#E8ECEF] transition-colors shrink-0 h-7">
        <input
          type="checkbox"
          checked={filters.includeFunders}
          onChange={(e) => onChange({ includeFunders: e.target.checked })}
          className="rounded border-[#30373D] bg-[#101214] text-[#D7A84B] focus:ring-0 w-3 h-3"
        />
        <span>Funders</span>
      </label>

      {/* Divider */}
      <div className="h-4 w-px bg-[#30373D] shrink-0" />

      {/* Action Buttons: Fit View & Export PNG */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onFitView}
          className="px-2 py-1 bg-[#171A1D] hover:bg-[#1E2327] border border-[#30373D] hover:border-[#D7A84B] text-[#E8ECEF] text-[10px] font-semibold rounded-lg transition-colors flex items-center gap-1 h-7"
          title="Fit graph into view"
        >
          <span>⛶</span>
          <span>Fit View</span>
        </button>
        <button
          onClick={onExportPng}
          className="px-2 py-1 bg-[#D7A84B]/15 hover:bg-[#D7A84B] hover:text-[#0D1117] border border-[#D7A84B] text-[#D7A84B] font-semibold text-[10px] rounded-lg transition-colors flex items-center gap-1 shadow-sm h-7"
          title="Export high-resolution PNG"
        >
          <span>📷</span>
          <span>Export PNG</span>
        </button>
      </div>
    </div>
  );
}
