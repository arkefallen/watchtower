// src/components/self/EdgeDecayChart.tsx
"use client";

import React from "react";
import type { EdgeDecayBucket } from "@/server/services/self/decay";

interface EdgeDecayChartProps {
  buckets: EdgeDecayBucket[];
  sampleSize: number;
  insufficientSample: boolean;
  selectedFollowedWallet?: string;
  onFollowedWalletChange?: (wallet: string) => void;
  followedWalletOptions?: Array<{ address: string; label: string | null; chain: string }>;
}

export function EdgeDecayChart({
  buckets,
  sampleSize,
  insufficientSample,
  selectedFollowedWallet,
  onFollowedWalletChange,
  followedWalletOptions = [],
}: EdgeDecayChartProps) {
  // SVG Chart Dimensions
  const chartWidth = 540;
  const chartHeight = 220;
  const padding = { top: 20, right: 30, bottom: 40, left: 50 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  // Extract ROI values for charting
  const parsedData = buckets.map((b, idx) => ({
    name: b.bucket,
    userRoi: b.avgUserRoiPct !== null ? Number(b.avgUserRoiPct) : null,
    walletRoi: b.avgWalletRoiPct !== null ? Number(b.avgWalletRoiPct) : null,
    tradeCount: b.tradeCount,
    idx,
  }));

  const allRois = parsedData
    .flatMap((d) => [d.userRoi, d.walletRoi])
    .filter((v): v is number => v !== null && !isNaN(v));

  const minRoi = allRois.length > 0 ? Math.min(0, Math.min(...allRois) * 1.1) : -10;
  const maxRoi = allRois.length > 0 ? Math.max(20, Math.max(...allRois) * 1.2) : 50;
  const roiRange = maxRoi - minRoi || 1;

  const getX = (index: number) => {
    return padding.left + (index / (buckets.length - 1 || 1)) * innerWidth;
  };

  const getY = (val: number) => {
    const clamped = Math.max(minRoi, Math.min(maxRoi, val));
    const ratio = (clamped - minRoi) / roiRange;
    return padding.top + (1 - ratio) * innerHeight;
  };

  // Generate path points
  const userPoints = parsedData
    .filter((d) => d.userRoi !== null)
    .map((d) => ({ x: getX(d.idx), y: getY(d.userRoi!), val: d.userRoi }));

  const walletPoints = parsedData
    .filter((d) => d.walletRoi !== null)
    .map((d) => ({ x: getX(d.idx), y: getY(d.walletRoi!), val: d.walletRoi }));

  const userPathD =
    userPoints.length > 1
      ? userPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")
      : "";

  const walletPathD =
    walletPoints.length > 1
      ? walletPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")
      : "";

  return (
    <div className="bg-[#171A1D] border border-[#30373D] p-5 space-y-4">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#30373D] pb-3">
        <div>
          <h3 className="text-[14px] font-mono font-semibold uppercase text-[#E8ECEF] flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-[#D7A84B]"></span>
            EDGE DECAY CURVE (FR-6.4)
          </h3>
          <p className="text-[12px] font-mono text-[#929BA3] mt-0.5">
            Average user ROI and win rate bucketed by follow lag
          </p>
        </div>

        {followedWalletOptions.length > 0 && onFollowedWalletChange && (
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-mono uppercase text-[#929BA3]">
              FILTER BY SIGNAL:
            </label>
            <select
              value={selectedFollowedWallet || ""}
              onChange={(e) => onFollowedWalletChange(e.target.value)}
              className="bg-[#101214] border border-[#30373D] text-[#E8ECEF] text-[11px] font-mono p-1.5 focus:border-[#D7A84B] focus:outline-none"
            >
              <option value="">ALL FOLLOWED WALLETS</option>
              {followedWalletOptions.map((fw) => (
                <option key={fw.address} value={fw.address}>
                  {fw.label || `${fw.address.slice(0, 6)}...${fw.address.slice(-4)}`} [{fw.chain.toUpperCase()}]
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Insufficient Sample Notice (FR-6.4, DoD) */}
      {insufficientSample && (
        <div className="p-3 bg-[#101214] border-l-4 border-l-[#D7A84B] border border-[#30373D] text-[12px] font-mono text-[#929BA3] flex items-center gap-2">
          <span className="text-[#D7A84B] font-bold">⚠ LOW SAMPLE WARNING:</span>
          <span>
            Sample size ({sampleSize} trades) is below the minimum threshold (5 trades). Data shown for observation only, not statistical significance.
          </span>
        </div>
      )}

      {/* Side-by-Side: Recharts-style SVG Curve + Accessible Data Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Visual Line Chart */}
        <div className="lg:col-span-6 bg-[#101214] border border-[#30373D] p-4 flex flex-col items-center">
          <div className="w-full flex items-center justify-between text-[10px] font-mono mb-2">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-[#D7A84B]">
                <span className="w-3 h-0.5 bg-[#D7A84B]"></span> USER ROI (%)
              </span>
              <span className="flex items-center gap-1 text-[#929BA3]">
                <span className="w-3 h-0.5 bg-[#929BA3] border-dashed"></span> WALLET ROI (%)
              </span>
            </div>
            <span className="text-[#D7A84B] font-semibold">
              ★ 0-1H CAPTURE ZONE
            </span>
          </div>

          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-auto max-w-[540px] select-none"
          >
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padding.top + ratio * innerHeight;
              const val = maxRoi - ratio * roiRange;
              return (
                <g key={ratio}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={chartWidth - padding.right}
                    y2={y}
                    stroke="#30373D"
                    strokeDasharray="2 2"
                    strokeWidth="1"
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 3}
                    textAnchor="end"
                    fill="#929BA3"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {val.toFixed(0)}%
                  </text>
                </g>
              );
            })}

            {/* Highlight Golden Capture Zone [0-1h] */}
            <rect
              x={padding.left}
              y={padding.top}
              width={innerWidth / 3}
              height={innerHeight}
              fill="#D7A84B"
              fillOpacity="0.06"
              stroke="#D7A84B"
              strokeWidth="1"
              strokeDasharray="4 2"
            />

            {/* Zero Line */}
            {minRoi < 0 && maxRoi > 0 && (
              <line
                x1={padding.left}
                y1={getY(0)}
                x2={chartWidth - padding.right}
                y2={getY(0)}
                stroke="#929BA3"
                strokeWidth="1"
              />
            )}

            {/* Followed Wallet Line */}
            {walletPathD && (
              <path
                d={walletPathD}
                fill="none"
                stroke="#929BA3"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
            )}
            {walletPoints.map((p, idx) => (
              <circle
                key={`wp-${idx}`}
                cx={p.x}
                cy={p.y}
                r="3"
                fill="#929BA3"
              />
            ))}

            {/* User Line */}
            {userPathD && (
              <path
                d={userPathD}
                fill="none"
                stroke="#D7A84B"
                strokeWidth="2.5"
              />
            )}
            {userPoints.map((p, idx) => (
              <circle
                key={`up-${idx}`}
                cx={p.x}
                cy={p.y}
                r="4"
                fill="#101214"
                stroke="#D7A84B"
                strokeWidth="2"
              />
            ))}

            {/* X Axis Labels */}
            {buckets.map((b, idx) => (
              <text
                key={b.bucket}
                x={getX(idx)}
                y={chartHeight - 12}
                textAnchor="middle"
                fill={idx === 0 ? "#D7A84B" : "#929BA3"}
                fontWeight={idx === 0 ? "bold" : "normal"}
                fontSize="11"
                fontFamily="monospace"
              >
                {b.bucket}
              </text>
            ))}
          </svg>
        </div>

        {/* Accessible Data Table (FR-6.4, DoD) */}
        <div className="lg:col-span-6 border border-[#30373D] bg-[#101214] overflow-x-auto">
          <table className="w-full text-left text-[12px] font-mono border-collapse">
            <thead>
              <tr className="border-b border-[#30373D] text-[#929BA3] text-[11px] uppercase bg-[#171A1D]">
                <th className="p-3">LAG BUCKET</th>
                <th className="p-3 text-right">TRADES</th>
                <th className="p-3 text-right">AVG USER ROI</th>
                <th className="p-3 text-right">AVG WALLET ROI</th>
                <th className="p-3 text-right">WIN RATE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30373D]/60 text-[#E8ECEF]">
              {buckets.map((b) => {
                const isGolden = b.bucket === "0-1h";
                return (
                  <tr
                    key={b.bucket}
                    className={`transition-colors ${
                      isGolden
                        ? "bg-[#D7A84B]/10 hover:bg-[#D7A84B]/20"
                        : "hover:bg-[#1E2327]"
                    }`}
                  >
                    <td className="p-3 font-semibold flex items-center gap-1.5">
                      {isGolden && <span className="text-[#D7A84B]">★</span>}
                      <span className={isGolden ? "text-[#D7A84B]" : ""}>
                        {b.bucket}
                      </span>
                    </td>
                    <td className="p-3 text-right">{b.tradeCount}</td>
                    <td
                      className={`p-3 text-right font-semibold ${
                        b.avgUserRoiPct !== null
                          ? Number(b.avgUserRoiPct) >= 0
                            ? "text-[#79B79A]"
                            : "text-[#D87870]"
                          : "text-[#929BA3]"
                      }`}
                    >
                      {b.avgUserRoiPct !== null ? `${b.avgUserRoiPct}%` : "—"}
                    </td>
                    <td className="p-3 text-right text-[#929BA3]">
                      {b.avgWalletRoiPct !== null ? `${b.avgWalletRoiPct}%` : "—"}
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {b.winRatePct !== null ? `${b.winRatePct}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
