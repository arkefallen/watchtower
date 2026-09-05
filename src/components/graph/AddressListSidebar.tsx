"use client";

import React, { useState, useMemo } from "react";
import type { GraphNodePayload, CompoundClusterPayload } from "@/server/services/interaction/graph-query";

export interface AddressListSidebarProps {
  nodes: GraphNodePayload[];
  clusters: CompoundClusterPayload[];
  selectedNodeId: string | null;
  onSelectNode: (node: GraphNodePayload) => void;
  onCenterNode: (nodeId: string) => void;
  onClose?: () => void;
}

const formatUsd = (val: number) => {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${Math.round(val)}`;
};

const truncateAddress = (addr: string) => {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

const ChevronDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6"/>
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>
);

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.3-4.3"/>
  </svg>
);

export function AddressListSidebar({
  nodes,
  clusters,
  selectedNodeId,
  onSelectNode,
  onCenterNode,
  onClose,
}: AddressListSidebarProps) {
  const [search, setSearch] = useState("");
  const [collapsedClusters, setCollapsedClusters] = useState<Set<string>>(new Set());

  const toggleCluster = (clusterId: string) => {
    setCollapsedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(clusterId)) {
        next.delete(clusterId);
      } else {
        next.add(clusterId);
      }
      return next;
    });
  };

  const handleNodeClick = (node: GraphNodePayload) => {
    onSelectNode(node);
    onCenterNode(node.id);
  };

  const filteredNodes = useMemo(() => {
    if (!search) return nodes;
    const lowerSearch = search.toLowerCase();
    return nodes.filter(
      (n) =>
        n.address.toLowerCase().includes(lowerSearch) ||
        (n.ensName && n.ensName.toLowerCase().includes(lowerSearch)) ||
        (n.label && n.label.toLowerCase().includes(lowerSearch))
    );
  }, [nodes, search]);

  const { clustered, unclustered } = useMemo(() => {
    const clusterMap = new Map<string, { cluster: CompoundClusterPayload; members: GraphNodePayload[]; totalUsd: number }>();
    
    clusters.forEach((c) => {
      clusterMap.set(c.id, { cluster: c, members: [], totalUsd: 0 });
    });

    const unclusteredNodes: GraphNodePayload[] = [];

    filteredNodes.forEach((node) => {
      if (node.clusterId && clusterMap.has(node.clusterId)) {
        const entry = clusterMap.get(node.clusterId)!;
        entry.members.push(node);
        entry.totalUsd += node.stableBalanceUsd || 0;
      } else {
        unclusteredNodes.push(node);
      }
    });

    // Sort members within clusters by stableBalanceUsd desc
    for (const entry of clusterMap.values()) {
      entry.members.sort((a, b) => (b.stableBalanceUsd || 0) - (a.stableBalanceUsd || 0));
    }

    // Sort unclustered nodes by stableBalanceUsd desc
    unclusteredNodes.sort((a, b) => (b.stableBalanceUsd || 0) - (a.stableBalanceUsd || 0));

    // Convert map to array and sort by total USD desc
    const clusteredArr = Array.from(clusterMap.values())
      .filter((c) => c.members.length > 0)
      .sort((a, b) => b.totalUsd - a.totalUsd);

    return { clustered: clusteredArr, unclustered: unclusteredNodes };
  }, [filteredNodes, clusters]);

  return (
    <div className="w-full h-full bg-[#0D1117]/95 backdrop-blur-md flex flex-col text-[#E8ECEF] font-mono select-none">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[#30373D]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#D7A84B]" />
          <h2 className="text-[12px] font-semibold tracking-wide">Address List</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <div className="absolute left-2 text-[#929BA3]">
              <SearchIcon />
            </div>
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-[120px] bg-[#171A1D] border border-[#30373D] rounded-md py-1 pl-6 pr-2 text-[11px] text-[#E8ECEF] placeholder:text-[#929BA3] focus:outline-none focus:border-[#D7A84B] transition-colors"
            />
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-[#171A1D] border border-transparent hover:border-[#30373D] rounded text-[#929BA3] hover:text-[#E8ECEF] transition-colors"
              title="Close Address List"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* List Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {clustered.map(({ cluster, members, totalUsd }) => {
          const isCollapsed = collapsedClusters.has(cluster.id);
          return (
            <div key={cluster.id} className="border-b border-[#30373D]/50 last:border-0">
              {/* Cluster Header */}
              <div
                className="flex items-center justify-between p-2 hover:bg-[#171A1D] cursor-pointer group transition-colors"
                onClick={() => toggleCluster(cluster.id)}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cluster.colorHex }}
                  />
                  <div className="text-[12px] text-[#E8ECEF] truncate flex items-center gap-1.5">
                    <span className="font-semibold">{cluster.name}</span>
                    <span className="text-[#929BA3] text-[11px]">({members.length})</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[#929BA3] text-[11px]">{formatUsd(totalUsd)}</span>
                  <div className="text-[#929BA3] group-hover:text-[#E8ECEF] transition-colors">
                    {isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
                  </div>
                </div>
              </div>

              {/* Members */}
              {!isCollapsed && (
                <div className="flex flex-col">
                  {members.map((node, idx) => {
                    const isSelected = selectedNodeId === node.id;
                    return (
                      <div
                        key={node.id}
                        onClick={() => handleNodeClick(node)}
                        className={`flex items-center justify-between py-1.5 pl-6 pr-2 cursor-pointer hover:bg-[#30373D]/40 transition-colors border-l-2 ${
                          isSelected ? "border-[#D7A84B] bg-[#171A1D]" : "border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="text-[#929BA3] text-[11px] w-4 shrink-0">
                            #{idx + 1}
                          </span>
                          <span className="text-[11px] truncate" title={node.address}>
                            {node.ensName || node.label || truncateAddress(node.address)}
                          </span>
                        </div>
                        <span className="text-[#929BA3] text-[11px] shrink-0">
                          {formatUsd(node.stableBalanceUsd)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Unclustered Section */}
        {unclustered.length > 0 && (
          <div className="border-b border-[#30373D]/50 last:border-0 pb-4">
            <div
              className="flex items-center justify-between p-2 hover:bg-[#171A1D] cursor-pointer group transition-colors"
              onClick={() => toggleCluster("unclustered")}
            >
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#30373D] shrink-0" />
                <div className="text-[12px] text-[#929BA3] font-semibold flex items-center gap-1.5">
                  Unclustered
                  <span className="text-[11px]">({unclustered.length})</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-[#929BA3] group-hover:text-[#E8ECEF] transition-colors">
                  {collapsedClusters.has("unclustered") ? <ChevronRightIcon /> : <ChevronDownIcon />}
                </div>
              </div>
            </div>

            {!collapsedClusters.has("unclustered") && (
              <div className="flex flex-col">
                {unclustered.map((node, idx) => {
                  const isSelected = selectedNodeId === node.id;
                  return (
                    <div
                      key={node.id}
                      onClick={() => handleNodeClick(node)}
                      className={`flex items-center justify-between py-1.5 pl-6 pr-2 cursor-pointer hover:bg-[#30373D]/40 transition-colors border-l-2 ${
                        isSelected ? "border-[#D7A84B] bg-[#171A1D]" : "border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="text-[#929BA3] text-[11px] w-4 shrink-0">
                          #{idx + 1}
                        </span>
                        <span className="text-[11px] truncate" title={node.address}>
                          {node.ensName || node.label || truncateAddress(node.address)}
                        </span>
                      </div>
                      <span className="text-[#929BA3] text-[11px] shrink-0">
                        {formatUsd(node.stableBalanceUsd)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
