"use client";

import React from "react";
import type { AlertThresholds, GradedDefinition } from "@/lib/settings-schema";

interface ThresholdFormProps {
  thresholds: AlertThresholds;
  gradedDefinition: GradedDefinition;
  onChangeThresholds: (patch: Partial<AlertThresholds>) => void;
  onChangeGradedDefinition: (val: GradedDefinition) => void;
  disabled?: boolean;
}

export function ThresholdForm({
  thresholds,
  gradedDefinition,
  onChangeThresholds,
  onChangeGradedDefinition,
  disabled = false,
}: ThresholdFormProps) {
  const handleNumberChange = (key: keyof AlertThresholds, value: string) => {
    const num = Number(value);
    if (!Number.isNaN(num)) {
      onChangeThresholds({ [key]: num });
    }
  };

  return (
    <section className="flex flex-col gap-4" aria-labelledby="alert-rules-heading">
      <header className="border-b border-[#30373D] pb-2 flex items-center justify-between">
        <div>
          <h2 id="alert-rules-heading" className="text-[18px] font-bold text-[#E8ECEF] font-sans">
            Alert Thresholds &amp; Rules
          </h2>
          <p className="text-[12px] text-[#929BA3] font-sans mt-0.5">
            Configurable trigger, arming, and context parameters for all 15 state machine rules (A1–C4)
          </p>
        </div>
        <span className="font-mono text-[11px] text-[#D7A84B] px-2 py-0.5 border border-[#30373D] bg-[#171A1D]">
          15 ACTIVE RULES
        </span>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* A1 Card */}
        <div className="bg-[#171A1D] border border-[#30373D] p-3 flex flex-col gap-3 relative group transition-colors hover:border-[#D7A84B]/40">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#30373D] group-hover:bg-[#D7A84B] transition-colors" />
          <div className="flex justify-between items-start pl-2">
            <div>
              <h3 className="text-[12px] font-semibold text-[#E8ECEF] font-sans">
                A1: Stablecoin Arming
              </h3>
              <p className="text-[10px] text-[#929BA3]">Large incoming stable balance</p>
            </div>
            <span className="font-mono text-[10px] text-[#929BA3] px-1.5 py-0.5 border border-[#30373D] bg-[#101214]">
              CORE
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 pl-2">
            <div>
              <label htmlFor="a1-floor" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
                Floor USD
              </label>
              <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
                <span className="px-2 text-[#929BA3] font-mono text-[12px]">$</span>
                <input
                  id="a1-floor"
                  type="number"
                  min="0"
                  step="100"
                  disabled={disabled}
                  value={thresholds.a1MinStableInflowUsd}
                  onChange={(e) => handleNumberChange("a1MinStableInflowUsd", e.target.value)}
                  className="w-full text-right bg-transparent border-none text-[#E8ECEF] font-mono text-[13px] px-2 py-1.5 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label htmlFor="a1-mult" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
                Median Multiple
              </label>
              <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
                <input
                  id="a1-mult"
                  type="number"
                  min="0"
                  step="0.5"
                  disabled={disabled}
                  value={thresholds.a1MedianMultiple}
                  onChange={(e) => handleNumberChange("a1MedianMultiple", e.target.value)}
                  className="w-full text-right bg-transparent border-none text-[#E8ECEF] font-mono text-[13px] px-2 py-1.5 focus:outline-none"
                />
                <span className="px-2 text-[#929BA3] font-mono text-[12px]">x</span>
              </div>
            </div>
          </div>
          <div className="pl-2 flex items-center justify-between text-[11px] text-[#929BA3] font-mono border-t border-[#30373D]/50 pt-2">
            <span>Window:</span>
            <span className="text-[#E8ECEF]">{thresholds.a1WindowHours}h lookback</span>
          </div>
        </div>

        {/* A2 Card (Gas Arming, Decision D-4) */}
        <div className="bg-[#171A1D] border border-[#30373D] p-3 flex flex-col gap-3 relative group transition-colors hover:border-[#D7A84B]/40">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#30373D] group-hover:bg-[#D7A84B] transition-colors" />
          <div className="flex justify-between items-start pl-2">
            <div>
              <h3 className="text-[12px] font-semibold text-[#E8ECEF] font-sans">
                A2: Gas Arming
              </h3>
              <p className="text-[10px] text-[#929BA3]">Native gas inflow baseline</p>
            </div>
            <span className="font-mono text-[10px] text-[#D7A84B] px-1.5 py-0.5 border border-[#30373D] bg-[#101214]">
              D-4
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 pl-2">
            <div>
              <label htmlFor="a2-floor" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
                Floor USD
              </label>
              <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
                <span className="px-2 text-[#929BA3] font-mono text-[12px]">$</span>
                <input
                  id="a2-floor"
                  type="number"
                  min="0"
                  step="10"
                  disabled={disabled}
                  value={thresholds.a2MinNativeInflowUsd}
                  onChange={(e) => handleNumberChange("a2MinNativeInflowUsd", e.target.value)}
                  className="w-full text-right bg-transparent border-none text-[#E8ECEF] font-mono text-[13px] px-2 py-1.5 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label htmlFor="a2-mult" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
                Median Multiple
              </label>
              <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
                <input
                  id="a2-mult"
                  type="number"
                  min="0"
                  step="0.5"
                  disabled={disabled}
                  value={thresholds.a2MedianMultiple}
                  onChange={(e) => handleNumberChange("a2MedianMultiple", e.target.value)}
                  className="w-full text-right bg-transparent border-none text-[#E8ECEF] font-mono text-[13px] px-2 py-1.5 focus:outline-none"
                />
                <span className="px-2 text-[#929BA3] font-mono text-[12px]">x</span>
              </div>
            </div>
          </div>
          <div className="pl-2 mt-auto pt-2 border-t border-[#30373D]/50">
            <p className="font-mono text-[10px] text-[#929BA3] leading-tight border-l-2 border-[#D7A84B] pl-2">
              Cold-start rule: floor-only ($100) binds until wallet has ≥ 7 qualifying daily flow days.
            </p>
          </div>
        </div>

        {/* A3 Card (CEX Withdrawal) */}
        <div className="bg-[#171A1D] border border-[#30373D] p-3 flex flex-col gap-3 relative group transition-colors hover:border-[#D7A84B]/40">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#30373D] group-hover:bg-[#D7A84B] transition-colors" />
          <div className="flex justify-between items-start pl-2">
            <div>
              <h3 className="text-[12px] font-semibold text-[#E8ECEF] font-sans">
                A3: CEX Withdrawal
              </h3>
              <p className="text-[10px] text-[#929BA3]">Direct exchange funding</p>
            </div>
            <span className="font-mono text-[10px] text-[#929BA3] px-1.5 py-0.5 border border-[#30373D] bg-[#101214]">
              CORE
            </span>
          </div>
          <div className="pl-2">
            <label htmlFor="a3-floor" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
              Min Withdrawal USD
            </label>
            <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
              <span className="px-2 text-[#929BA3] font-mono text-[12px]">$</span>
              <input
                id="a3-floor"
                type="number"
                min="0"
                step="100"
                disabled={disabled}
                value={thresholds.a3MinCexWithdrawalUsd}
                onChange={(e) => handleNumberChange("a3MinCexWithdrawalUsd", e.target.value)}
                className="w-full text-right bg-transparent border-none text-[#E8ECEF] font-mono text-[13px] px-2 py-1.5 focus:outline-none"
              />
            </div>
          </div>
          <div className="pl-2 mt-auto text-[10px] font-mono text-[#929BA3]">
            Identified via known CEX cluster hot/sweep wallets.
          </div>
        </div>

        {/* A4 Card (Dormancy Wake) */}
        <div className="bg-[#171A1D] border border-[#30373D] p-3 flex flex-col gap-3 relative group transition-colors hover:border-[#D7A84B]/40">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#30373D] group-hover:bg-[#D7A84B] transition-colors" />
          <div className="flex justify-between items-start pl-2">
            <div>
              <h3 className="text-[12px] font-semibold text-[#E8ECEF] font-sans">
                A4: Dormancy Wake
              </h3>
              <p className="text-[10px] text-[#929BA3]">Long inactivity reactivation</p>
            </div>
            <span className="font-mono text-[10px] text-[#929BA3] px-1.5 py-0.5 border border-[#30373D] bg-[#101214]">
              CORE
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 pl-2">
            <div>
              <label htmlFor="a4-days" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
                Inactivity
              </label>
              <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
                <input
                  id="a4-days"
                  type="number"
                  min="1"
                  step="1"
                  disabled={disabled}
                  value={thresholds.a4DormancyDays}
                  onChange={(e) => handleNumberChange("a4DormancyDays", e.target.value)}
                  className="w-full text-right bg-transparent border-none text-[#E8ECEF] font-mono text-[13px] px-2 py-1.5 focus:outline-none"
                />
                <span className="px-2 text-[#929BA3] font-mono text-[12px]">d</span>
              </div>
            </div>
            <div>
              <label htmlFor="a4-funding" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
                Min Funding USD
              </label>
              <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
                <span className="px-2 text-[#929BA3] font-mono text-[12px]">$</span>
                <input
                  id="a4-funding"
                  type="number"
                  min="0"
                  step="50"
                  disabled={disabled}
                  value={thresholds.a4MinFundingUsd}
                  onChange={(e) => handleNumberChange("a4MinFundingUsd", e.target.value)}
                  className="w-full text-right bg-transparent border-none text-[#E8ECEF] font-mono text-[13px] px-2 py-1.5 focus:outline-none"
                />
              </div>
            </div>
          </div>
          <div className="pl-2 mt-auto text-[10px] font-mono text-[#929BA3]">
            Triggers when idle wallet receives fresh funding.
          </div>
        </div>

        {/* A5 Card (Cluster Arming) */}
        <div className="bg-[#171A1D] border border-[#30373D] p-3 flex flex-col gap-3 relative group transition-colors hover:border-[#D7A84B]/40">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#30373D] group-hover:bg-[#D7A84B] transition-colors" />
          <div className="flex justify-between items-start pl-2">
            <div>
              <h3 className="text-[12px] font-semibold text-[#E8ECEF] font-sans">
                A5: Cluster Arming
              </h3>
              <p className="text-[10px] text-[#929BA3]">Coordinated cluster inflow</p>
            </div>
            <span className="font-mono text-[10px] text-[#D7A84B] px-1.5 py-0.5 border border-[#30373D] bg-[#101214]">
              ESCALATED
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 pl-2">
            <div>
              <label htmlFor="a5-window" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
                Time Window
              </label>
              <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
                <input
                  id="a5-window"
                  type="number"
                  min="1"
                  step="1"
                  disabled={disabled}
                  value={thresholds.a5WindowHours}
                  onChange={(e) => handleNumberChange("a5WindowHours", e.target.value)}
                  className="w-full text-right bg-transparent border-none text-[#E8ECEF] font-mono text-[13px] px-2 py-1.5 focus:outline-none"
                />
                <span className="px-2 text-[#929BA3] font-mono text-[12px]">h</span>
              </div>
            </div>
            <div>
              <label htmlFor="a5-wallets" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
                Min Wallets
              </label>
              <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
                <input
                  id="a5-wallets"
                  type="number"
                  min="2"
                  step="1"
                  disabled={disabled}
                  value={thresholds.a5MinWallets}
                  onChange={(e) => handleNumberChange("a5MinWallets", e.target.value)}
                  className="w-full text-right bg-transparent border-none text-[#E8ECEF] font-mono text-[13px] px-2 py-1.5 focus:outline-none"
                />
              </div>
            </div>
          </div>
          <div className="pl-2 mt-auto text-[10px] font-mono text-[#929BA3]">
            ≥2 wallets funded from common source within window.
          </div>
        </div>

        {/* A6 Card (Sweeper Arming) */}
        <div className="bg-[#171A1D] border border-[#30373D] p-3 flex flex-col gap-3 relative group transition-colors hover:border-[#D7A84B]/40">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#30373D] group-hover:bg-[#D7A84B] transition-colors" />
          <div className="flex justify-between items-start pl-2">
            <div>
              <h3 className="text-[12px] font-semibold text-[#E8ECEF] font-sans">
                A6: Sweeper Arming
              </h3>
              <p className="text-[10px] text-[#929BA3]">Inflow from sweepers</p>
            </div>
            <span className="font-mono text-[10px] text-[#929BA3] px-1.5 py-0.5 border border-[#30373D] bg-[#101214]">
              CORE
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 pl-2">
            <div>
              <label htmlFor="a6-window" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
                Time Window
              </label>
              <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
                <input
                  id="a6-window"
                  type="number"
                  min="1"
                  step="1"
                  disabled={disabled}
                  value={thresholds.a6WindowHours}
                  onChange={(e) => handleNumberChange("a6WindowHours", e.target.value)}
                  className="w-full text-right bg-transparent border-none text-[#E8ECEF] font-mono text-[13px] px-2 py-1.5 focus:outline-none"
                />
                <span className="px-2 text-[#929BA3] font-mono text-[12px]">h</span>
              </div>
            </div>
            <div>
              <label htmlFor="a6-sources" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
                Min Sources
              </label>
              <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
                <input
                  id="a6-sources"
                  type="number"
                  min="1"
                  step="1"
                  disabled={disabled}
                  value={thresholds.a6MinSweepSources}
                  onChange={(e) => handleNumberChange("a6MinSweepSources", e.target.value)}
                  className="w-full text-right bg-transparent border-none text-[#E8ECEF] font-mono text-[13px] px-2 py-1.5 focus:outline-none"
                />
              </div>
            </div>
          </div>
          <div className="pl-2 mt-auto text-[10px] font-mono text-[#929BA3]">
            Aggregates funds across multiple distinct sweepers.
          </div>
        </div>

        {/* T1 Card (Armed Entry) */}
        <div className="bg-[#171A1D] border border-[#30373D] p-3 flex flex-col gap-3 relative group transition-colors hover:border-[#D7A84B]/40">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#30373D] group-hover:bg-[#D7A84B] transition-colors" />
          <div className="flex justify-between items-start pl-2">
            <div>
              <h3 className="text-[12px] font-semibold text-[#E8ECEF] font-sans">
                T1: Armed Entry
              </h3>
              <p className="text-[10px] text-[#929BA3]">Armed wallet buys fresh token</p>
            </div>
            <span className="font-mono text-[10px] text-[#D87870] px-1.5 py-0.5 border border-[#30373D] bg-[#101214]">
              TRIGGER
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 pl-2">
            <div>
              <label htmlFor="t1-age" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
                Max Token Age
              </label>
              <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
                <input
                  id="t1-age"
                  type="number"
                  min="1"
                  step="1"
                  disabled={disabled}
                  value={thresholds.t1MaxTokenAgeDays}
                  onChange={(e) => handleNumberChange("t1MaxTokenAgeDays", e.target.value)}
                  className="w-full text-right bg-transparent border-none text-[#E8ECEF] font-mono text-[13px] px-2 py-1.5 focus:outline-none"
                />
                <span className="px-2 text-[#929BA3] font-mono text-[12px]">d</span>
              </div>
            </div>
            <div>
              <label htmlFor="t1-pos" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
                Min Position USD
              </label>
              <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
                <span className="px-2 text-[#929BA3] font-mono text-[12px]">$</span>
                <input
                  id="t1-pos"
                  type="number"
                  min="0"
                  step="50"
                  disabled={disabled}
                  value={thresholds.t1MinPositionUsd}
                  onChange={(e) => handleNumberChange("t1MinPositionUsd", e.target.value)}
                  className="w-full text-right bg-transparent border-none text-[#E8ECEF] font-mono text-[13px] px-2 py-1.5 focus:outline-none"
                />
              </div>
            </div>
          </div>
          <div className="pl-2 mt-auto text-[10px] font-mono text-[#929BA3]">
            Fires when an ARMED wallet initiates entry.
          </div>
        </div>

        {/* T2 Card (Independent Co-Entry, Decision D-5) */}
        <div className="bg-[#171A1D] border border-[#30373D] p-3 flex flex-col gap-3 relative group md:col-span-2 xl:col-span-2 transition-colors hover:border-[#D7A84B]/40">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#30373D] group-hover:bg-[#D7A84B] transition-colors" />
          <div className="flex justify-between items-start pl-2">
            <div>
              <h3 className="text-[12px] font-semibold text-[#E8ECEF] font-sans">
                T2: Independent Co-Entry &amp; Graded Definition
              </h3>
              <p className="text-[10px] text-[#929BA3]">Unconnected wallets entering same token (Decision D-5)</p>
            </div>
            <span className="font-mono text-[10px] text-[#D87870] px-1.5 py-0.5 border border-[#30373D] bg-[#101214]">
              TRIGGER
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pl-2 items-end">
            <div>
              <label htmlFor="t2-window" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
                Time Window
              </label>
              <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
                <input
                  id="t2-window"
                  type="number"
                  min="1"
                  step="1"
                  disabled={disabled}
                  value={thresholds.t2WindowHours}
                  onChange={(e) => handleNumberChange("t2WindowHours", e.target.value)}
                  className="w-full text-right bg-transparent border-none text-[#E8ECEF] font-mono text-[13px] px-2 py-1.5 focus:outline-none"
                />
                <span className="px-2 text-[#929BA3] font-mono text-[12px]">h</span>
              </div>
            </div>
            <div>
              <label htmlFor="t2-wallets" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
                Min Wallets
              </label>
              <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
                <input
                  id="t2-wallets"
                  type="number"
                  min="2"
                  step="1"
                  disabled={disabled}
                  value={thresholds.t2MinWallets}
                  onChange={(e) => handleNumberChange("t2MinWallets", e.target.value)}
                  className="w-full text-right bg-transparent border-none text-[#E8ECEF] font-mono text-[13px] px-2 py-1.5 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label htmlFor="graded-def" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
                Graded Definition (D-5)
              </label>
              <select
                id="graded-def"
                disabled={disabled}
                value={gradedDefinition}
                onChange={(e) => onChangeGradedDefinition(e.target.value as GradedDefinition)}
                className="w-full bg-[#101214] border border-[#30373D] text-[#E8ECEF] font-mono text-[12px] px-2 py-2 focus:border-[#D7A84B] focus:outline-none rounded-none cursor-pointer"
              >
                <option value="ANY_TAG_OR_COMPUTED">ANY_TAG_OR_COMPUTED (Default)</option>
                <option value="EDGE_TAG_ONLY">EDGE_TAG_ONLY (Strict)</option>
              </select>
            </div>
          </div>
          <div className="pl-2 mt-auto text-[10px] font-mono text-[#929BA3]">
            Default accepts edge/style/size tag or computed auto-grade; EDGE_TAG_ONLY requires manual edge tag.
          </div>
        </div>

        {/* T3 Card (Fresh-Launch) */}
        <div className="bg-[#171A1D] border border-[#30373D] p-3 flex flex-col gap-3 relative group transition-colors hover:border-[#D7A84B]/40">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#30373D] group-hover:bg-[#D7A84B] transition-colors" />
          <div className="flex justify-between items-start pl-2">
            <div>
              <h3 className="text-[12px] font-semibold text-[#E8ECEF] font-sans">
                T3: Fresh-Launch
              </h3>
              <p className="text-[10px] text-[#929BA3]">Fast entry after deployment</p>
            </div>
            <span className="font-mono text-[10px] text-[#D87870] px-1.5 py-0.5 border border-[#30373D] bg-[#101214]">
              TRIGGER
            </span>
          </div>
          <div className="pl-2">
            <label htmlFor="t3-age" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
              Max Token Age
            </label>
            <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
              <input
                id="t3-age"
                type="number"
                min="1"
                step="5"
                disabled={disabled}
                value={thresholds.t3MaxTokenAgeMinutes}
                onChange={(e) => handleNumberChange("t3MaxTokenAgeMinutes", e.target.value)}
                className="w-full text-right bg-transparent border-none text-[#E8ECEF] font-mono text-[13px] px-2 py-1.5 focus:outline-none"
              />
              <span className="px-2 text-[#929BA3] font-mono text-[12px]">min</span>
            </div>
          </div>
          <div className="pl-2 mt-auto text-[10px] font-mono text-[#929BA3]">
            Measured from pool initialization or deploy transaction.
          </div>
        </div>

        {/* T4 Card (Add-On-Retrace) */}
        <div className="bg-[#171A1D] border border-[#30373D] p-3 flex flex-col gap-3 relative group transition-colors hover:border-[#D7A84B]/40">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#30373D] group-hover:bg-[#D7A84B] transition-colors" />
          <div className="flex justify-between items-start pl-2">
            <div>
              <h3 className="text-[12px] font-semibold text-[#E8ECEF] font-sans">
                T4: Add-On-Retrace
              </h3>
              <p className="text-[10px] text-[#929BA3]">Accumulation during dip</p>
            </div>
            <span className="font-mono text-[10px] text-[#D87870] px-1.5 py-0.5 border border-[#30373D] bg-[#101214]">
              TRIGGER
            </span>
          </div>
          <div className="pl-2">
            <label htmlFor="t4-drawdown" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
              Min Drawdown
            </label>
            <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
              <input
                id="t4-drawdown"
                type="number"
                min="0"
                max="100"
                step="5"
                disabled={disabled}
                value={thresholds.t4MinDrawdownPct}
                onChange={(e) => handleNumberChange("t4MinDrawdownPct", e.target.value)}
                className="w-full text-right bg-transparent border-none text-[#E8ECEF] font-mono text-[13px] px-2 py-1.5 focus:outline-none"
              />
              <span className="px-2 text-[#929BA3] font-mono text-[12px]">%</span>
            </div>
          </div>
          <div className="pl-2 mt-auto text-[10px] font-mono text-[#929BA3]">
            Wallet increases position size after price retracement.
          </div>
        </div>

        {/* T5 Card (Cluster Co-Entry) */}
        <div className="bg-[#171A1D] border border-[#30373D] p-3 flex flex-col gap-3 relative group transition-colors hover:border-[#D7A84B]/40">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#30373D] group-hover:bg-[#D7A84B] transition-colors" />
          <div className="flex justify-between items-start pl-2">
            <div>
              <h3 className="text-[12px] font-semibold text-[#E8ECEF] font-sans">
                T5: Cluster Co-Entry
              </h3>
              <p className="text-[10px] text-[#929BA3]">Cluster members entering together</p>
            </div>
            <span className="font-mono text-[10px] text-[#D87870] px-1.5 py-0.5 border border-[#30373D] bg-[#101214]">
              TRIGGER
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 pl-2">
            <div>
              <label htmlFor="t5-window" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
                Window
              </label>
              <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
                <input
                  id="t5-window"
                  type="number"
                  min="1"
                  step="1"
                  disabled={disabled}
                  value={thresholds.t5WindowHours}
                  onChange={(e) => handleNumberChange("t5WindowHours", e.target.value)}
                  className="w-full text-right bg-transparent border-none text-[#E8ECEF] font-mono text-[13px] px-2 py-1.5 focus:outline-none"
                />
                <span className="px-2 text-[#929BA3] font-mono text-[12px]">h</span>
              </div>
            </div>
            <div>
              <label htmlFor="t5-wallets" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
                Min Wallets
              </label>
              <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
                <input
                  id="t5-wallets"
                  type="number"
                  min="2"
                  step="1"
                  disabled={disabled}
                  value={thresholds.t5MinWallets}
                  onChange={(e) => handleNumberChange("t5MinWallets", e.target.value)}
                  className="w-full text-right bg-transparent border-none text-[#E8ECEF] font-mono text-[13px] px-2 py-1.5 focus:outline-none"
                />
              </div>
            </div>
          </div>
          <div className="pl-2 mt-auto text-[10px] font-mono text-[#929BA3]">
            Coordinated entry among wallets with verified link.
          </div>
        </div>

        {/* C1 Card (Distribution Prep) */}
        <div className="bg-[#171A1D] border border-[#30373D] p-3 flex flex-col gap-3 relative group transition-colors hover:border-[#D7A84B]/40">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#30373D] group-hover:bg-[#D7A84B] transition-colors" />
          <div className="flex justify-between items-start pl-2">
            <div>
              <h3 className="text-[12px] font-semibold text-[#E8ECEF] font-sans">
                C1: Distribution Prep
              </h3>
              <p className="text-[10px] text-[#929BA3]">Transfer to CEX or router</p>
            </div>
            <span className="font-mono text-[10px] text-[#E59866] px-1.5 py-0.5 border border-[#30373D] bg-[#101214]">
              CONTEXT
            </span>
          </div>
          <div className="pl-2">
            <label htmlFor="c1-deposit" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
              Min Deposit USD
            </label>
            <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
              <span className="px-2 text-[#929BA3] font-mono text-[12px]">$</span>
              <input
                id="c1-deposit"
                type="number"
                min="0"
                step="100"
                disabled={disabled}
                value={thresholds.c1MinDepositUsd}
                onChange={(e) => handleNumberChange("c1MinDepositUsd", e.target.value)}
                className="w-full text-right bg-transparent border-none text-[#E8ECEF] font-mono text-[13px] px-2 py-1.5 focus:outline-none"
              />
            </div>
          </div>
          <div className="pl-2 mt-auto text-[10px] font-mono text-[#929BA3]">
            Detects off-ramping or pre-dump liquidity routing.
          </div>
        </div>

        {/* C2 Card (Co-Distribution) */}
        <div className="bg-[#171A1D] border border-[#30373D] p-3 flex flex-col gap-3 relative group transition-colors hover:border-[#D7A84B]/40">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#30373D] group-hover:bg-[#D7A84B] transition-colors" />
          <div className="flex justify-between items-start pl-2">
            <div>
              <h3 className="text-[12px] font-semibold text-[#E8ECEF] font-sans">
                C2: Co-Distribution
              </h3>
              <p className="text-[10px] text-[#929BA3]">Multiple wallets selling</p>
            </div>
            <span className="font-mono text-[10px] text-[#E59866] px-1.5 py-0.5 border border-[#30373D] bg-[#101214]">
              CONTEXT
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 pl-2">
            <div>
              <label htmlFor="c2-window" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
                Window
              </label>
              <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
                <input
                  id="c2-window"
                  type="number"
                  min="1"
                  step="1"
                  disabled={disabled}
                  value={thresholds.c2WindowHours}
                  onChange={(e) => handleNumberChange("c2WindowHours", e.target.value)}
                  className="w-full text-right bg-transparent border-none text-[#E8ECEF] font-mono text-[13px] px-2 py-1.5 focus:outline-none"
                />
                <span className="px-2 text-[#929BA3] font-mono text-[12px]">h</span>
              </div>
            </div>
            <div>
              <label htmlFor="c2-wallets" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
                Min Wallets
              </label>
              <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
                <input
                  id="c2-wallets"
                  type="number"
                  min="2"
                  step="1"
                  disabled={disabled}
                  value={thresholds.c2MinWallets}
                  onChange={(e) => handleNumberChange("c2MinWallets", e.target.value)}
                  className="w-full text-right bg-transparent border-none text-[#E8ECEF] font-mono text-[13px] px-2 py-1.5 focus:outline-none"
                />
              </div>
            </div>
          </div>
          <div className="pl-2 mt-auto text-[10px] font-mono text-[#929BA3]">
            Coordinated selling across tracked wallets.
          </div>
        </div>

        {/* C3 Card (Moon Discipline, Decision D-7) */}
        <div className="bg-[#171A1D] border border-[#30373D] p-3 flex flex-col gap-3 relative group transition-colors hover:border-[#D7A84B]/40">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#30373D] group-hover:bg-[#D7A84B] transition-colors" />
          <div className="flex justify-between items-start pl-2">
            <div>
              <h3 className="text-[12px] font-semibold text-[#E8ECEF] font-sans">
                C3: Moon Discipline
              </h3>
              <p className="text-[10px] text-[#929BA3]">High-multiple profit taking</p>
            </div>
            <span className="font-mono text-[10px] text-[#D7A84B] px-1.5 py-0.5 border border-[#30373D] bg-[#101214]">
              D-7
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 pl-2">
            <div>
              <label htmlFor="c3-mult" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
                Return Target
              </label>
              <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
                <input
                  id="c3-mult"
                  type="number"
                  min="1"
                  step="1"
                  disabled={disabled}
                  value={thresholds.c3MinMultiple}
                  onChange={(e) => handleNumberChange("c3MinMultiple", e.target.value)}
                  className="w-full text-right bg-transparent border-none text-[#E8ECEF] font-mono text-[13px] px-2 py-1.5 focus:outline-none"
                />
                <span className="px-2 text-[#929BA3] font-mono text-[12px]">x</span>
              </div>
            </div>
            <div>
              <label htmlFor="c3-age" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
                Min Age
              </label>
              <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
                <input
                  id="c3-age"
                  type="number"
                  min="1"
                  step="1"
                  disabled={disabled}
                  value={thresholds.c3MinAgeDays}
                  onChange={(e) => handleNumberChange("c3MinAgeDays", e.target.value)}
                  className="w-full text-right bg-transparent border-none text-[#E8ECEF] font-mono text-[13px] px-2 py-1.5 focus:outline-none"
                />
                <span className="px-2 text-[#929BA3] font-mono text-[12px]">d</span>
              </div>
            </div>
          </div>
          <div className="pl-2 mt-auto border-t border-[#30373D]/50 pt-2 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label htmlFor="c3-self-only" className="font-mono text-[10px] text-[#E8ECEF] uppercase tracking-wider cursor-pointer">
                c3SelfOnly Scope
              </label>
              <input
                id="c3-self-only"
                type="checkbox"
                disabled={disabled}
                checked={thresholds.c3SelfOnly}
                onChange={(e) => onChangeThresholds({ c3SelfOnly: e.target.checked })}
                className="w-4 h-4 bg-[#101214] border border-[#30373D] accent-[#D7A84B] rounded-none cursor-pointer"
              />
            </div>
            <p className="font-mono text-[9px] text-[#929BA3] leading-snug">
              When false, monitors all tracked wallets with prominent styling on isSelf trades; when true, restricts to self-registered positions only.
            </p>
          </div>
        </div>

        {/* C4 Card (Campaign Spent) */}
        <div className="bg-[#171A1D] border border-[#30373D] p-3 flex flex-col gap-3 relative group transition-colors hover:border-[#D7A84B]/40">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#30373D] group-hover:bg-[#D7A84B] transition-colors" />
          <div className="flex justify-between items-start pl-2">
            <div>
              <h3 className="text-[12px] font-semibold text-[#E8ECEF] font-sans">
                C4: Campaign Spent
              </h3>
              <p className="text-[10px] text-[#929BA3]">Exhausted token holdings</p>
            </div>
            <span className="font-mono text-[10px] text-[#E59866] px-1.5 py-0.5 border border-[#30373D] bg-[#101214]">
              CONTEXT
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 pl-2">
            <div>
              <label htmlFor="c4-drop" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
                Balance Drop
              </label>
              <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
                <input
                  id="c4-drop"
                  type="number"
                  min="0"
                  max="100"
                  step="5"
                  disabled={disabled}
                  value={thresholds.c4DropPct}
                  onChange={(e) => handleNumberChange("c4DropPct", e.target.value)}
                  className="w-full text-right bg-transparent border-none text-[#E8ECEF] font-mono text-[13px] px-2 py-1.5 focus:outline-none"
                />
                <span className="px-2 text-[#929BA3] font-mono text-[12px]">%</span>
              </div>
            </div>
            <div>
              <label htmlFor="c4-window" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
                Window
              </label>
              <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
                <input
                  id="c4-window"
                  type="number"
                  min="1"
                  step="1"
                  disabled={disabled}
                  value={thresholds.c4WindowHours}
                  onChange={(e) => handleNumberChange("c4WindowHours", e.target.value)}
                  className="w-full text-right bg-transparent border-none text-[#E8ECEF] font-mono text-[13px] px-2 py-1.5 focus:outline-none"
                />
                <span className="px-2 text-[#929BA3] font-mono text-[12px]">h</span>
              </div>
            </div>
          </div>
          <div className="pl-2 mt-auto text-[10px] font-mono text-[#929BA3]">
            Triggers when tracked wallet balance decreases by ≥ 70%.
          </div>
        </div>

        {/* De-arm Conditions Card */}
        <div className="bg-[#171A1D] border border-[#30373D] p-3 flex flex-col gap-3 relative group transition-colors hover:border-[#D7A84B]/40">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#30373D] group-hover:bg-[#D7A84B] transition-colors" />
          <div className="flex justify-between items-start pl-2">
            <div>
              <h3 className="text-[12px] font-semibold text-[#E8ECEF] font-sans">
                System De-Arm
              </h3>
              <p className="text-[10px] text-[#929BA3]">Reversion to IDLE state</p>
            </div>
            <span className="font-mono text-[10px] text-[#79B79A] px-1.5 py-0.5 border border-[#30373D] bg-[#101214]">
              SYSTEM
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 pl-2">
            <div>
              <label htmlFor="dearm-baseline" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
                Baseline Thresh.
              </label>
              <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
                <input
                  id="dearm-baseline"
                  type="number"
                  min="0"
                  step="5"
                  disabled={disabled}
                  value={thresholds.deArmBaselinePct}
                  onChange={(e) => handleNumberChange("deArmBaselinePct", e.target.value)}
                  className="w-full text-right bg-transparent border-none text-[#E8ECEF] font-mono text-[13px] px-2 py-1.5 focus:outline-none"
                />
                <span className="px-2 text-[#929BA3] font-mono text-[12px]">%</span>
              </div>
            </div>
            <div>
              <label htmlFor="dearm-days" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
                Consecutive
              </label>
              <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
                <input
                  id="dearm-days"
                  type="number"
                  min="1"
                  step="1"
                  disabled={disabled}
                  value={thresholds.deArmConsecutiveDays}
                  onChange={(e) => handleNumberChange("deArmConsecutiveDays", e.target.value)}
                  className="w-full text-right bg-transparent border-none text-[#E8ECEF] font-mono text-[13px] px-2 py-1.5 focus:outline-none"
                />
                <span className="px-2 text-[#929BA3] font-mono text-[12px]">d</span>
              </div>
            </div>
          </div>
          <div className="pl-2 mt-auto text-[10px] font-mono text-[#929BA3]">
            Wallets without qualifying movement de-arm after consecutive period.
          </div>
        </div>
      </div>
    </section>
  );
}
