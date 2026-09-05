"use client";

import React, { useState, useMemo } from "react";

interface HeatmapData {
  habitual?: number[][];
  recent7d?: number[][];
  timezone?: string;
  recentWindow?: {
    start: string;
    end: string;
  };
}

interface ActivityHeatmapProps {
  heatmapData?: HeatmapData | null;
  totalTxCount?: number;
}

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function ActivityHeatmap({ heatmapData, totalTxCount = 0 }: ActivityHeatmapProps) {
  const [mode, setMode] = useState<"habitual" | "recent">("habitual");
  const [hoveredCell, setHoveredCell] = useState<{
    day: string;
    dayIdx: number;
    hour: number;
    count: number;
    pct: string;
  } | null>(null);

  const matrix = useMemo(() => {
    if (!heatmapData) {
      return Array.from({ length: 7 }, () => Array(24).fill(0));
    }
    const data = mode === "habitual" ? heatmapData.habitual : heatmapData.recent7d;
    if (!data || data.length !== 7) {
      return Array.from({ length: 7 }, () => Array(24).fill(0));
    }
    return data;
  }, [heatmapData, mode]);

  const { maxVal, modeTotal } = useMemo(() => {
    let max = 0;
    let sum = 0;
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 24; c++) {
        const val = matrix[r]?.[c] ?? 0;
        if (val > max) max = val;
        sum += val;
      }
    }
    return { maxVal: max, modeTotal: sum };
  }, [matrix]);

  // Stepped amber color palette:
  // Level 0: #171A1D
  // Level 1: #4A3A1A
  // Level 2: #85621F
  // Level 3: #D7A84B
  const getCellBg = (count: number) => {
    if (count <= 0) return "#171A1D";
    if (maxVal <= 1) return "#D7A84B";
    const ratio = count / maxVal;
    if (ratio <= 0.33) return "#4A3A1A";
    if (ratio <= 0.66) return "#85621F";
    return "#D7A84B";
  };

  const getDayLabel = (dayIdx: number) => {
    if (mode === "habitual") {
      return DAYS_SHORT[dayIdx] ?? `D${dayIdx}`;
    }
    // For rolling recent 7 days: Day -6 to Day 0 (today)
    const diff = 6 - dayIdx;
    if (diff === 0) return "Today";
    if (diff === 1) return "Yest";
    return `-${diff}d`;
  };

  return (
    <div className="bg-[#171A1D] border border-[#30373D] p-4 text-[#E8ECEF]">
      {/* Header with Mode Toggle & Timezone Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#30373D] mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold tracking-wider text-[#D7A84B] uppercase font-['Geist']">
              Activity Heatmap (168h Matrix)
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#101214] border border-[#30373D] text-[#929BA3]">
              {mode === "habitual" ? "ALL-TIME" : "LAST 7D"}
            </span>
          </div>
          <div className="text-[11px] text-[#929BA3] mt-0.5 font-mono">
            Local Context: <span className="text-[#E8ECEF]">Asia/Jakarta (UTC+7)</span> •{" "}
            {mode === "habitual" ? "Aggregated full history by day & hour" : "Rolling 7-day diurnal window"}
          </div>
        </div>

        {/* Toggle buttons */}
        <div className="flex items-center border border-[#30373D] bg-[#101214] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMode("habitual")}
            className={`px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors font-['Geist'] ${
              mode === "habitual"
                ? "bg-[#D7A84B] text-[#101214]"
                : "text-[#929BA3] hover:text-[#E8ECEF] hover:bg-[#1E2327]"
            }`}
          >
            Habitual Timing (Full History)
          </button>
          <button
            type="button"
            onClick={() => setMode("recent")}
            className={`px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors border-l border-[#30373D] font-['Geist'] ${
              mode === "recent"
                ? "bg-[#D7A84B] text-[#101214]"
                : "text-[#929BA3] hover:text-[#E8ECEF] hover:bg-[#1E2327]"
            }`}
          >
            Rolling 7 Local Days (Recent)
          </button>
        </div>
      </div>

      {/* Grid Container */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[640px]">
          {/* Hour labels header */}
          <div className="grid grid-cols-[44px_repeat(24,1fr)] gap-1 mb-1 text-center font-mono text-[10px] text-[#929BA3]">
            <div className="text-left font-['Geist']">DAY</div>
            {HOURS.map((hr) => (
              <div key={hr} className="truncate">
                {hr.toString().padStart(2, "0")}
              </div>
            ))}
          </div>

          {/* 7 Rows */}
          {Array.from({ length: 7 }, (_, dayIdx) => {
            const dayLabel = getDayLabel(dayIdx);
            return (
              <div
                key={dayIdx}
                className="grid grid-cols-[44px_repeat(24,1fr)] gap-1 mb-1 items-center"
              >
                <div className="font-mono text-[11px] text-[#929BA3] font-medium pr-1 text-left">
                  {dayLabel}
                </div>
                {HOURS.map((hr) => {
                  const count = matrix[dayIdx]?.[hr] ?? 0;
                  const pct = modeTotal > 0 ? ((count / modeTotal) * 100).toFixed(1) : "0.0";
                  const bg = getCellBg(count);
                  const isHovered =
                    hoveredCell?.dayIdx === dayIdx && hoveredCell?.hour === hr;

                  return (
                    <div
                      key={hr}
                      onMouseEnter={() =>
                        setHoveredCell({
                          day: dayLabel,
                          dayIdx,
                          hour: hr,
                          count,
                          pct,
                        })
                      }
                      onMouseLeave={() => setHoveredCell(null)}
                      style={{ backgroundColor: bg }}
                      className={`aspect-square border transition-all cursor-pointer relative ${
                        isHovered
                          ? "border-[#E8ECEF] scale-110 z-10 shadow-sm"
                          : "border-[#30373D]/60 hover:border-[#D7A84B]"
                      }`}
                      title={`${dayLabel} ${hr.toString().padStart(2, "0")}:00 - ${count} txs (${pct}%)`}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer / Legend / Hover status bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-[#30373D] mt-2 text-[11px] font-mono text-[#929BA3]">
        {/* Dynamic Hover Details */}
        <div className="h-5 flex items-center">
          {hoveredCell ? (
            <div className="flex items-center gap-2 text-[#E8ECEF]">
              <span className="font-semibold text-[#D7A84B]">{hoveredCell.day}</span>
              <span>@ {hoveredCell.hour.toString().padStart(2, "0")}:00-{hoveredCell.hour.toString().padStart(2, "0")}:59</span>
              <span>•</span>
              <span className="text-[#D7A84B] font-semibold">{hoveredCell.count} txs</span>
              <span>({hoveredCell.pct}% of active period)</span>
            </div>
          ) : (
            <span className="text-[#929BA3]/70">Hover over any cell to inspect hourly frequency and share.</span>
          )}
        </div>

        {/* Stepped Legend */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <span className="text-[10px] uppercase tracking-wider text-[#929BA3] mr-1 font-['Geist']">Intensity:</span>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 bg-[#171A1D] border border-[#30373D]" title="Level 0 (0 txs)" />
            <span className="text-[10px]">0</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 bg-[#4A3A1A] border border-[#30373D]" title="Level 1" />
            <span className="text-[10px]">Low</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 bg-[#85621F] border border-[#30373D]" title="Level 2" />
            <span className="text-[10px]">Med</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 bg-[#D7A84B] border border-[#30373D]" title="Level 3" />
            <span className="text-[10px]">High</span>
          </div>
        </div>
      </div>
    </div>
  );
}
