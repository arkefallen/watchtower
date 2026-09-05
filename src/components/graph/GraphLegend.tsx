"use client";

import React, { useState } from "react";

export function GraphLegend() {
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="absolute bottom-4 left-4 z-20 px-2.5 py-1.5 bg-[#0D1117]/85 backdrop-blur-md border border-[#30373D]/80 rounded-xl text-[11px] font-mono text-[#929BA3] hover:text-[#E8ECEF] hover:border-[#D7A84B] shadow-xl flex items-center gap-1.5 transition-all"
        title="Show Visual Legend"
      >
        <span className="w-2 h-2 rounded-full bg-[#D7A84B]" />
        <span>Legend</span>
      </button>
    );
  }

  return (
    <aside
      aria-label="Graph legend"
      className="absolute bottom-4 left-4 z-20 w-64 bg-[#0D1117]/90 backdrop-blur-md border border-[#30373D]/80 rounded-xl p-3.5 font-mono text-[11px] shadow-2xl select-none animate-in fade-in slide-in-from-bottom-2 duration-150"
    >
      <div className="flex items-center justify-between pb-2 border-b border-[#30373D]/70 mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#D7A84B]" />
          <span className="text-[#D7A84B] font-semibold text-[10px] uppercase tracking-wider">
            GRAPH ENCODING
          </span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-[#929BA3] hover:text-[#E8ECEF] text-[12px] p-0.5 rounded hover:bg-[#171A1D] transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2.5 text-[10px]">
        {/* Border State */}
        <div>
          <div className="text-[#929BA3] text-[9.5px] uppercase tracking-wider mb-1.5">
            NODE BORDER (ALERT STATE)
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <div className="flex items-center gap-1.5 text-[#929BA3]">
              <span className="w-3 h-3 rounded-full border-2 border-[#4B5563] bg-[#4B5563]/20" />
              <span>IDLE</span>
            </div>
            <div className="flex items-center gap-1.5 text-[#D7A84B]">
              <span className="w-3 h-3 rounded-full border-2 border-[#D7A84B] bg-[#D7A84B]/20" />
              <span>ARMED</span>
            </div>
            <div className="flex items-center gap-1.5 text-[#D87870]">
              <span className="w-3 h-3 rounded-full border-2 border-[#D87870] bg-[#D87870]/20" />
              <span>ALERT</span>
            </div>
          </div>
        </div>

        {/* Fill & Cluster */}
        <div>
          <div className="text-[#929BA3] text-[9.5px] uppercase tracking-wider mb-1">
            Cluster Ring & Body
          </div>
          <div className="text-[#E8ECEF] flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-[#79B79A] bg-[#79B79A]/30" />
            <span>Tinted by cluster membership</span>
          </div>
        </div>

        {/* Node Size */}
        <div>
          <div className="text-[#929BA3] text-[9.5px] uppercase tracking-wider mb-1">
            Bubble Scale
          </div>
          <div className="text-[#E8ECEF]">
            Whale (64px) · Mid (46px) · Small (30px) or Balance
          </div>
        </div>

        {/* Edge */}
        <div>
          <div className="text-[#929BA3] text-[9.5px] uppercase tracking-wider mb-1">
            Transfer Links
          </div>
          <div className="text-[#E8ECEF]">
            Dashed = Volume ($100 → $100K+) · Hover for token details
          </div>
        </div>
      </div>
    </aside>
  );
}
