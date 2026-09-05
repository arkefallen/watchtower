"use client";

import React, { useState, useRef, useEffect } from "react";
import type { Core } from "cytoscape";
import { trpc } from "@/lib/trpc/client";
import { GraphCanvas } from "@/components/graph/GraphCanvas";
import { GraphFilters, type GraphFiltersState } from "@/components/graph/GraphFilters";
import { GraphLegend } from "@/components/graph/GraphLegend";
import { NodeSidePanel } from "@/components/graph/NodeSidePanel";
import { EdgeBreakdownPanel } from "@/components/graph/EdgeBreakdownPanel";
import { AddressListSidebar } from "@/components/graph/AddressListSidebar";
import type {
  GraphNodePayload,
  GraphEdgePayload,
} from "@/server/services/interaction/graph-query";

export default function GraphPage() {
  const [filters, setFilters] = useState<GraphFiltersState>({
    timeRange: "ALL",
    minUsd: 100,
    token: undefined,
    direction: "BOTH",
    sizeMode: "tag",
    includeFunders: false,
    includePrimaryWallets: false,
  });

  const [selectedNode, setSelectedNode] = useState<GraphNodePayload | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdgePayload | null>(null);
  const [isAddressListOpen, setIsAddressListOpen] = useState(true);
  const cyRef = useRef<Core | null>(null);

  // Derive timeFrom based on timeRange
  const getTimeFrom = (range: string): Date | undefined => {
    const now = new Date();
    switch (range) {
      case "24H":
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case "7D":
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case "30D":
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return undefined;
    }
  };

  const { data, isLoading, isError, refetch } = trpc.graph.load.useQuery({
    chain: filters.chain,
    minUsd: filters.minUsd,
    token: filters.token,
    direction: filters.direction,
    timeFrom: getTimeFrom(filters.timeRange),
    includeFunders: filters.includeFunders,
    includePrimaryWallets: filters.includePrimaryWallets,
    sizeMode: filters.sizeMode,
  });

  // Re-adjust Cytoscape viewport when the sidebar is expanded or collapsed
  useEffect(() => {
    if (cyRef.current) {
      const timer = setTimeout(() => {
        cyRef.current?.resize();
      }, 220);
      return () => clearTimeout(timer);
    }
  }, [isAddressListOpen]);

  const handleFitView = () => {
    if (cyRef.current) {
      cyRef.current.fit(undefined, 60);
    }
  };

  const handleExportPng = () => {
    if (!cyRef.current) return;
    const pngBase64 = cyRef.current.png({
      full: false,
      bg: "#06080B",
      scale: 2.5,
    });
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 16);
    const filename = `watchtower-bubblemap-${timestamp}.png`;
    const downloadLink = document.createElement("a");
    downloadLink.href = pngBase64;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const handleCenterNode = (nodeId: string) => {
    if (cyRef.current) {
      const ele = cyRef.current.$(`node[id = "${nodeId}"]`);
      if (ele.length > 0) {
        cyRef.current.animate({
          center: { eles: ele },
          zoom: Math.max(cyRef.current.zoom(), 1.35),
          duration: 500,
          easing: "ease-out-cubic",
        });
        ele.select();
      }
    }
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-[#06080B] select-none font-mono">
      {/* Top Header Navigation Bar */}
      <header className="h-14 min-h-[56px] px-4 bg-[#0D1117]/95 backdrop-blur-md border-b border-[#30373D] flex items-center justify-between gap-3 z-30 shrink-0 select-none font-mono">
        {/* Left: Intelligence / Map Status Pill */}
        <div className="flex items-center gap-2.5 shrink-0 bg-[#12161D]/90 border border-[#30373D] rounded-xl px-2.5 py-1 h-10 shadow-sm">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#D7A84B] to-[#79B79A] flex items-center justify-center text-[#0D1117] font-bold text-[13px] shadow-sm shrink-0">
            ◎
          </div>
          <div className="flex flex-col justify-center leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[#E8ECEF] text-[12px] tracking-wide whitespace-nowrap">
                Interaction Map
              </span>
              <span className="flex items-center gap-1 text-[9px] text-[#79B79A] bg-[#79B79A]/10 border border-[#79B79A]/30 px-1 py-0.2 rounded-full font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#79B79A] animate-pulse" />
                Live
              </span>
            </div>
            <div className="text-[9.5px] text-[#929BA3] flex items-center gap-1.5 whitespace-nowrap">
              <span>{data?.nodes?.length ?? 0} Wallets</span>
              <span>·</span>
              <span>{data?.clusters?.length ?? 0} Clusters</span>
              <span>·</span>
              <span className="text-[#D7A84B]">{data?.edges?.length ?? 0} Links</span>
            </div>
          </div>
        </div>

        {/* Center: Filters Pill Bar */}
        <div className="flex items-center shrink min-w-0 overflow-x-auto">
          <GraphFilters
            filters={filters}
            onChange={(updated) => setFilters((prev) => ({ ...prev, ...updated }))}
            onFitView={handleFitView}
            onExportPng={handleExportPng}
          />
        </div>

        {/* Right: Address List Sidebar Toggle */}
        <div className="flex items-center shrink-0">
          <button
            onClick={() => setIsAddressListOpen(!isAddressListOpen)}
            className={`h-10 px-3 rounded-xl text-[11px] font-semibold border shadow-sm transition-all flex items-center gap-2 whitespace-nowrap ${
              isAddressListOpen
                ? "bg-[#D7A84B]/15 text-[#D7A84B] border-[#D7A84B] shadow-[#D7A84B]/10"
                : "bg-[#171A1D] text-[#E8ECEF] border-[#30373D] hover:border-[#D7A84B] hover:text-[#D7A84B]"
            }`}
            title="Toggle Address List Sidebar"
          >
            <span className="text-[13px]">📋</span>
            <span>Address List</span>
            {data && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  isAddressListOpen
                    ? "bg-[#D7A84B]/25 text-[#D7A84B]"
                    : "bg-[#101214] text-[#929BA3]"
                }`}
              >
                {data.nodes.length}
              </span>
            )}
            <span className="text-[9px] opacity-75">{isAddressListOpen ? "▶" : "◀"}</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Body: Canvas Area (flex-1) + Right Sidebar (320px) */}
      <div className="flex flex-1 w-full min-h-0 overflow-hidden relative">
        {/* Canvas Area */}
        <main className="relative flex-1 h-full min-w-0 overflow-hidden">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#06080B] z-10 font-mono text-[12px] text-[#929BA3]">
              <div className="flex items-center gap-2.5 p-4 bg-[#0D1117]/90 border border-[#30373D] rounded-xl shadow-2xl">
                <span className="h-2.5 w-2.5 rounded-full bg-[#D7A84B] animate-ping" />
                <span>Simulating celestial interaction map...</span>
              </div>
            </div>
          ) : isError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#06080B] z-10 font-mono text-[12px] text-[#D87870]">
              <div className="p-5 border border-[#D87870]/60 bg-[#0D1117]/95 rounded-xl max-w-md text-center space-y-3 shadow-2xl">
                <div className="font-semibold">Failed to load graph interaction data.</div>
                <button
                  onClick={() => refetch()}
                  className="px-3.5 py-1.5 bg-[#171A1D] border border-[#30373D] text-[#E8ECEF] hover:border-[#D7A84B] rounded-lg transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : data && data.nodes.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#06080B] z-10 font-mono text-[12px] text-[#929BA3]">
              <div className="p-6 border border-[#30373D] bg-[#0D1117]/95 rounded-xl max-w-md text-center space-y-2 shadow-2xl">
                <div className="text-[#E8ECEF] font-semibold text-[13px]">
                  No Wallets or Interactions Found
                </div>
                <p className="text-[11px] text-[#929BA3] leading-relaxed">
                  Import wallets via Registry (/wallets/new) or adjust your filter thresholds.
                </p>
              </div>
            </div>
          ) : (
            data && (
              <GraphCanvas
                nodes={data.nodes}
                edges={data.edges}
                clusters={data.clusters}
                sizeMode={filters.sizeMode}
                onSelectNode={(node) => setSelectedNode(node)}
                onSelectEdge={(edge) => setSelectedEdge(edge)}
                onCyInit={(cy) => {
                  cyRef.current = cy;
                }}
              />
            )
          )}

          {/* Selected Node Inspection Drawer (anchored inside canvas, to the left of the sidebar) */}
          <NodeSidePanel
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
          />

          {/* Selected Edge Breakdown Drawer */}
          <EdgeBreakdownPanel
            edge={selectedEdge}
            onClose={() => setSelectedEdge(null)}
          />

          {/* Legend Overlay (Bottom Left) */}
          <GraphLegend />
        </main>

        {/* Dedicated Right Sidebar for Address List */}
        {isAddressListOpen && data && (
          <aside className="w-[320px] shrink-0 h-full border-l border-[#30373D] flex flex-col z-20 shadow-2xl animate-in slide-in-from-right duration-200">
            <AddressListSidebar
              nodes={data.nodes}
              clusters={data.clusters}
              selectedNodeId={selectedNode?.id ?? null}
              onSelectNode={(node) => setSelectedNode(node)}
              onCenterNode={handleCenterNode}
              onClose={() => setIsAddressListOpen(false)}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
