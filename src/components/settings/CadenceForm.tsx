"use client";

import React from "react";
import type { SettingsSnapshot } from "@/lib/settings-schema";

interface CadenceFormProps {
  settings: Pick<
    SettingsSnapshot,
    | "radarCadenceMinutes"
    | "syncCadenceMinutes"
    | "quota"
    | "minEdgeUsd"
    | "maxTraceDepth"
    | "profitSinkRatioPct"
  >;
  onChange: (patch: {
    radarCadenceMinutes?: number;
    syncCadenceMinutes?: number;
    quota?: { etherscanDailyLimit?: number; reservedForInteractivePct?: number };
    minEdgeUsd?: number;
    maxTraceDepth?: number;
    profitSinkRatioPct?: number;
  }) => void;
  disabled?: boolean;
}

export function CadenceForm({
  settings,
  onChange,
  disabled = false,
}: CadenceFormProps) {
  return (
    <section className="flex flex-col gap-4" aria-labelledby="cadence-system-heading">
      <header className="border-b border-[#30373D] pb-2">
        <h2 id="cadence-system-heading" className="text-[18px] font-bold text-[#E8ECEF] font-sans">
          Cadence &amp; System
        </h2>
        <p className="text-[12px] text-[#929BA3] font-sans mt-0.5">
          Execution frequency, quota allocation, and recursive graph bounds
        </p>
      </header>

      <div className="bg-[#171A1D] border border-[#30373D] p-5 flex flex-col gap-6 h-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Radar Cadence */}
          <div>
            <label htmlFor="radar-cadence" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1.5 block">
              Radar Sweep Cadence
            </label>
            <div className="flex items-center border border-[#30373D] bg-[#101214] max-w-[180px] focus-within:border-[#D7A84B]">
              <input
                id="radar-cadence"
                type="number"
                min="1"
                step="1"
                disabled={disabled}
                value={settings.radarCadenceMinutes}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val > 0) onChange({ radarCadenceMinutes: val });
                }}
                className="w-full text-right bg-transparent border-none text-[16px] py-1.5 px-3 font-mono text-[#E8ECEF] focus:outline-none"
              />
              <span className="px-3 text-[#929BA3] font-mono text-[13px] border-l border-[#30373D] bg-[#171A1D]">
                m
              </span>
            </div>
            <p className="font-sans text-[11px] text-[#929BA3] mt-1.5 leading-normal">
              Interval between movement evaluations. Changing this re-registers the repeatable evaluation job.
            </p>
          </div>

          {/* Quota Reserve */}
          <div>
            <label htmlFor="quota-reserve" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1.5 block">
              RPC Quota Reserve
            </label>
            <div className="flex items-center border border-[#30373D] bg-[#101214] max-w-[180px] focus-within:border-[#D7A84B]">
              <input
                id="quota-reserve"
                type="number"
                min="0"
                max="100"
                step="1"
                disabled={disabled}
                value={settings.quota.reservedForInteractivePct}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val >= 0 && val <= 100) {
                    onChange({
                      quota: {
                        ...settings.quota,
                        reservedForInteractivePct: val,
                      },
                    });
                  }
                }}
                className="w-full text-right bg-transparent border-none text-[16px] py-1.5 px-3 font-mono text-[#E8ECEF] focus:outline-none"
              />
              <span className="px-3 text-[#929BA3] font-mono text-[13px] border-l border-[#30373D] bg-[#171A1D]">
                %
              </span>
            </div>
            <p className="font-sans text-[11px] text-[#929BA3] mt-1.5 leading-normal">
              Failsafe reserve capacity held back from background sync to guarantee UI responsiveness.
            </p>
          </div>
        </div>

        <div className="border-t border-[#30373D]/50 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Sync Cadence */}
          <div>
            <label htmlFor="sync-cadence" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
              Sync Cadence
            </label>
            <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
              <input
                id="sync-cadence"
                type="number"
                min="1"
                step="1"
                disabled={disabled}
                value={settings.syncCadenceMinutes}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val > 0) onChange({ syncCadenceMinutes: val });
                }}
                className="w-full text-right bg-transparent border-none text-[13px] py-1 px-2 font-mono text-[#E8ECEF] focus:outline-none"
              />
              <span className="px-2 text-[#929BA3] font-mono text-[11px] border-l border-[#30373D]">m</span>
            </div>
          </div>

          {/* Max Trace Depth */}
          <div>
            <label htmlFor="max-trace-depth" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
              Max Trace Depth
            </label>
            <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
              <input
                id="max-trace-depth"
                type="number"
                min="1"
                max="6"
                step="1"
                disabled={disabled}
                value={settings.maxTraceDepth}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val >= 1 && val <= 6) onChange({ maxTraceDepth: val });
                }}
                className="w-full text-right bg-transparent border-none text-[13px] py-1 px-2 font-mono text-[#E8ECEF] focus:outline-none"
              />
              <span className="px-2 text-[#929BA3] font-mono text-[11px] border-l border-[#30373D]">hops</span>
            </div>
            <span className="text-[9px] text-[#929BA3] font-mono">Capped at 6</span>
          </div>

          {/* Min Edge USD */}
          <div>
            <label htmlFor="min-edge-usd" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
              Min Edge USD
            </label>
            <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
              <span className="px-1.5 text-[#929BA3] font-mono text-[11px]">$</span>
              <input
                id="min-edge-usd"
                type="number"
                min="0"
                step="10"
                disabled={disabled}
                value={settings.minEdgeUsd}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val >= 0) onChange({ minEdgeUsd: val });
                }}
                className="w-full text-right bg-transparent border-none text-[13px] py-1 px-2 font-mono text-[#E8ECEF] focus:outline-none"
              />
            </div>
          </div>

          {/* Profit Sink Ratio */}
          <div>
            <label htmlFor="profit-sink-ratio" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
              Profit Sink Ratio
            </label>
            <div className="flex items-center border border-[#30373D] bg-[#101214] focus-within:border-[#D7A84B]">
              <input
                id="profit-sink-ratio"
                type="number"
                min="0"
                max="100"
                step="5"
                disabled={disabled}
                value={settings.profitSinkRatioPct}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val >= 0 && val <= 100) onChange({ profitSinkRatioPct: val });
                }}
                className="w-full text-right bg-transparent border-none text-[13px] py-1 px-2 font-mono text-[#E8ECEF] focus:outline-none"
              />
              <span className="px-2 text-[#929BA3] font-mono text-[11px] border-l border-[#30373D]">%</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
