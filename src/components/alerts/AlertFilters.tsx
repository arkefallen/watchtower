"use client";

import React from "react";
import { ALERT_RULES_METADATA } from "@/lib/rules/evidence";

export type StateFilterTab = "ALL" | "ARMED" | "TRIGGERED" | "EXIT_RISK";

export interface AlertFiltersProps {
  stateFilter: StateFilterTab;
  onStateFilterChange: (state: StateFilterTab) => void;
  categoryFilter: string;
  onCategoryFilterChange: (cat: string) => void;
  search: string;
  onSearchChange: (val: string) => void;
  unreadOnly: boolean;
  onUnreadOnlyChange: (unread: boolean) => void;
}

export function AlertFilters({
  stateFilter,
  onStateFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  search,
  onSearchChange,
  unreadOnly,
  onUnreadOnlyChange,
}: AlertFiltersProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-3 bg-[#171A1D] border border-[#30373D] rounded-none">
      {/* State Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Alert State Filter">
        <button
          type="button"
          role="tab"
          aria-selected={stateFilter === "ALL"}
          onClick={() => onStateFilterChange("ALL")}
          className={`h-8 px-3.5 font-mono text-[11px] font-semibold uppercase tracking-wider rounded-none transition-colors border ${
            stateFilter === "ALL"
              ? "bg-[#1E2327] border-[#E8ECEF] text-[#E8ECEF]"
              : "bg-[#121416] border-[#30373D] text-[#929BA3] hover:text-[#E8ECEF] hover:bg-[#1E2327]"
          }`}
        >
          ALL
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={stateFilter === "ARMED"}
          onClick={() => onStateFilterChange("ARMED")}
          className={`h-8 px-3.5 font-mono text-[11px] font-semibold uppercase tracking-wider rounded-none transition-colors border flex items-center gap-1.5 ${
            stateFilter === "ARMED"
              ? "bg-[#D7A84B]/20 border-[#D7A84B] text-[#D7A84B]"
              : "bg-[#121416] border-[#30373D] text-[#929BA3] hover:text-[#D7A84B] hover:border-[#D7A84B]/50"
          }`}
        >
          <span className="w-1.5 h-1.5 bg-[#D7A84B] rounded-none" />
          ARMED
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={stateFilter === "TRIGGERED"}
          onClick={() => onStateFilterChange("TRIGGERED")}
          className={`h-8 px-3.5 font-mono text-[11px] font-semibold uppercase tracking-wider rounded-none transition-colors border flex items-center gap-1.5 ${
            stateFilter === "TRIGGERED"
              ? "bg-[#D87870]/20 border-[#D87870] text-[#D87870]"
              : "bg-[#121416] border-[#30373D] text-[#929BA3] hover:text-[#D87870] hover:border-[#D87870]/50"
          }`}
        >
          <span className="w-1.5 h-1.5 bg-[#D87870] rounded-none animate-pulse" />
          TRIGGERED
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={stateFilter === "EXIT_RISK"}
          onClick={() => onStateFilterChange("EXIT_RISK")}
          className={`h-8 px-3.5 font-mono text-[11px] font-semibold uppercase tracking-wider rounded-none transition-colors border flex items-center gap-1.5 ${
            stateFilter === "EXIT_RISK"
              ? "bg-[#E59866]/20 border-[#E59866] text-[#E59866]"
              : "bg-[#121416] border-[#30373D] text-[#929BA3] hover:text-[#E59866] hover:border-[#E59866]/50"
          }`}
        >
          <span className="w-1.5 h-1.5 bg-[#E59866] rounded-none" />
          EXIT_RISK
        </button>
      </div>

      {/* Secondary Controls: Category, Search, and Unread Only */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Rule Category Select */}
        <div className="relative">
          <label htmlFor="category-select" className="sr-only">
            Filter by Rule Category
          </label>
          <select
            id="category-select"
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
            className="h-8 bg-[#121416] border border-[#30373D] text-[#E8ECEF] font-mono text-[11px] px-2.5 pr-7 rounded-none focus:outline-none focus:border-[#D7A84B] cursor-pointer appearance-none uppercase"
          >
            <option value="ALL">ALL RULES</option>
            <optgroup label="CATEGORIES">
              <option value="CAT_ARMING">ARMING (A1–A6)</option>
              <option value="CAT_TRIGGER">TRIGGERS (T1–T5)</option>
              <option value="CAT_EXIT_RISK">EXIT RISK (C1–C4)</option>
            </optgroup>
            <optgroup label="INDIVIDUAL RULES">
              {Object.values(ALERT_RULES_METADATA).map((rule) => (
                <option key={rule.id} value={rule.id}>
                  {rule.id} — {rule.name.toUpperCase()}
                </option>
              ))}
            </optgroup>
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#929BA3] text-[10px]">
            ▼
          </span>
        </div>

        {/* Search input */}
        <div className="relative w-56 md:w-64">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#929BA3] text-[16px] pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search wallet, ENS, token..."
            className="w-full h-8 bg-[#121416] border border-[#30373D] text-[#E8ECEF] pl-8 pr-7 font-mono text-[11px] rounded-none focus:outline-none focus:border-[#D7A84B] placeholder:text-[#929BA3]/60"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#929BA3] hover:text-[#E8ECEF] text-[14px]"
            >
              ✕
            </button>
          )}
        </div>

        {/* Unread Only Toggle */}
        <button
          type="button"
          onClick={() => onUnreadOnlyChange(!unreadOnly)}
          aria-pressed={unreadOnly}
          className={`h-8 px-3 font-mono text-[11px] uppercase tracking-wider rounded-none transition-colors border flex items-center gap-2 ${
            unreadOnly
              ? "bg-[#D7A84B]/20 border-[#D7A84B] text-[#D7A84B] font-semibold"
              : "bg-[#121416] border-[#30373D] text-[#929BA3] hover:text-[#E8ECEF]"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-none border ${
              unreadOnly ? "bg-[#D7A84B] border-[#D7A84B]" : "border-[#929BA3] bg-transparent"
            }`}
          />
          <span>UNREAD ONLY</span>
        </button>
      </div>
    </div>
  );
}
