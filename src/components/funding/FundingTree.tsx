"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import type { ChainSlug } from "@/lib/chains/types";
import { FundingNode, type TreeNodeData } from "./FundingNode";

interface FundingTreeProps {
  address: string;
  chain: ChainSlug;
  onSelectNode?: (node: TreeNodeData) => void;
}

interface TreeNodeItemProps {
  node: TreeNodeData;
  rootAddress: string;
  chain: ChainSlug;
  isRoot?: boolean;
  onSelectNode?: (node: TreeNodeData) => void;
}

function TreeNodeItem({
  node,
  rootAddress,
  chain,
  isRoot = false,
  onSelectNode,
}: TreeNodeItemProps) {
  const [collapsed, setCollapsed] = useState(false);
  const children = node.children ?? [];
  const hasChildren = children.length > 0;

  return (
    <div className="relative pl-4 border-l border-[#30373D] my-2">
      {/* Node Row with Collapse Toggle */}
      <div className="flex items-start gap-2">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="mt-3 w-5 h-5 flex items-center justify-center bg-[#1E2327] border border-[#30373D] text-[11px] font-mono text-[#D7A84B] hover:bg-[#D7A84B] hover:text-[#101214] transition-colors shrink-0"
            title={collapsed ? "Expand branch" : "Collapse branch"}
          >
            {collapsed ? "+" : "−"}
          </button>
        ) : (
          <div className="mt-4 w-2 h-[1px] bg-[#30373D] shrink-0" />
        )}

        <div className="flex-1">
          <FundingNode
            node={node}
            rootAddress={rootAddress}
            chain={chain}
            isRoot={isRoot}
            onSelectNode={onSelectNode}
          />
        </div>
      </div>

      {/* Children branches if expanded */}
      {!collapsed && hasChildren && (
        <div className="ml-3 mt-1 space-y-2">
          {children.map((child, idx) => (
            <TreeNodeItem
              key={`${child.address}-${child.depth}-${idx}`}
              node={child as unknown as TreeNodeData}
              rootAddress={rootAddress}
              chain={chain}
              isRoot={false}
              onSelectNode={onSelectNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Count total nodes recursively in the tree
function countNodes(node: TreeNodeData): number {
  let count = 1;
  for (const child of node.children ?? []) {
    count += countNodes(child as unknown as TreeNodeData);
  }
  return count;
}

export function FundingTree({ address, chain, onSelectNode }: FundingTreeProps) {
  const { data: rootNode, isLoading, error, refetch } = trpc.funding.tree.useQuery({
    address,
    chain,
  });

  if (isLoading) {
    return (
      <div className="bg-[#171A1D] border border-[#30373D] p-8 text-center font-mono text-[12px] text-[#929BA3]">
        <div className="inline-block w-4 h-4 border-2 border-[#D7A84B] border-t-transparent animate-spin mb-2" />
        <div>Tracing upstream funding paths...</div>
      </div>
    );
  }

  if (error || !rootNode) {
    return (
      <div className="bg-[#171A1D] border border-[#30373D] p-6 text-center font-mono text-[12px] text-[#929BA3]">
        <div className="text-[#D87870] mb-2 font-bold uppercase">Funding Trace Unavailable</div>
        <div className="text-[11px] mb-4">
          {error?.message ?? "No funding tree returned for this wallet. Ingestion or trace job pending."}
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="px-3 py-1 bg-[#1E2327] border border-[#30373D] text-[#E8ECEF] hover:border-[#D7A84B] uppercase text-[11px] font-semibold"
        >
          Retry Trace
        </button>
      </div>
    );
  }

  const rootData = rootNode as unknown as TreeNodeData;
  const totalExpanded = countNodes(rootData);

  return (
    <div className="bg-[#171A1D] border border-[#30373D] p-4 text-[#E8ECEF]">
      {/* Header with Stats & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#30373D] mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold tracking-wider text-[#D7A84B] uppercase font-['Geist']">
              Recursive Funding Tracer
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#101214] border border-[#30373D] text-[#929BA3]">
              UP TO 6 HOPS
            </span>
          </div>
          <div className="text-[11px] text-[#929BA3] mt-0.5 font-mono">
            Traces gas and capital lineage to terminal exchange hot wallets or syndicates.
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono text-[#929BA3]">
          <span>Nodes in tree: <strong className="text-[#E8ECEF]">{totalExpanded}</strong></span>
        </div>
      </div>

      {/* Tree Visualization Container */}
      <div className="overflow-x-auto">
        <TreeNodeItem
          node={rootData}
          rootAddress={address}
          chain={chain}
          isRoot={true}
          onSelectNode={onSelectNode}
        />
      </div>
    </div>
  );
}
