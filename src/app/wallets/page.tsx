"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { WalletFilters, type WalletFilterState } from "@/components/wallets/WalletFilters";
import { WalletTable, type WalletRecord } from "@/components/wallets/WalletTable";
import { BulkActionBar } from "@/components/wallets/BulkActionBar";
import { TagEditor } from "@/components/wallets/TagEditor";

export default function WalletsPage() {
  const [filters, setFilters] = useState<WalletFilterState>({
    search: "",
    chain: "",
    tag: "",
    clusterId: "",
    alertState: "",
    timeFormat: "local",
  });

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [editingWallet, setEditingWallet] = useState<WalletRecord | null>(null);

  // Queries
  const listQuery = trpc.wallet.list.useQuery({
    search: filters.search || undefined,
    chain: (filters.chain as any) || undefined,
    clusterId: filters.clusterId || undefined,
    take: 100,
  });

  const clustersQuery = trpc.cluster.list.useQuery();

  // Mutations
  const utils = trpc.useUtils();
  const deleteMutation = trpc.wallet.delete.useMutation({
    onSuccess: () => {
      utils.wallet.list.invalidate();
    },
  });

  const updateMutation = trpc.wallet.update.useMutation({
    onSuccess: () => {
      utils.wallet.list.invalidate();
    },
  });

  const addMutation = trpc.wallet.add.useMutation({
    onSuccess: () => {
      utils.wallet.list.invalidate();
    },
  });

  // Client-side filtering for tag and alertState if not supported directly by DB query
  const filteredWallets: WalletRecord[] = useMemo(() => {
    if (!listQuery.data?.items) return [];
    let items = listQuery.data.items as unknown as WalletRecord[];

    if (filters.tag) {
      const tagUpper = filters.tag.toUpperCase();
      items = items.filter((w) => {
        return (
          w.edge?.toUpperCase() === tagUpper ||
          w.style?.toUpperCase() === tagUpper ||
          w.size?.toUpperCase() === tagUpper ||
          (tagUpper === "WHALE" && w.size === "W") ||
          (tagUpper === "DOLPHIN" && w.size === "M") ||
          (tagUpper === "SHRIMP" && w.size === "S")
        );
      });
    }

    if (filters.alertState) {
      const alertUpper = filters.alertState.toUpperCase();
      items = items.filter((w) => {
        const currentAlert = w.alertState?.state?.toUpperCase() || "IDLE";
        return currentAlert === alertUpper;
      });
    }

    return items;
  }, [listQuery.data?.items, filters.tag, filters.alertState]);

  // Selection handlers
  const handleToggleSelect = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (filteredWallets.length === 0) return;
    const allSelected = filteredWallets.every((w) => selectedKeys.has(`${w.chain}:${w.address}`));
    if (allSelected) {
      setSelectedKeys(new Set());
    } else {
      const next = new Set<string>();
      filteredWallets.forEach((w) => next.add(`${w.chain}:${w.address}`));
      setSelectedKeys(next);
    }
  };

  // Bulk actions
  const handleBulkResync = async () => {
    const selectedWallets = filteredWallets.filter((w) =>
      selectedKeys.has(`${w.chain}:${w.address}`)
    );
    for (const w of selectedWallets) {
      await addMutation.mutateAsync({
        address: w.address,
        chain: w.chain as any,
        forceFullResync: false,
      });
    }
    utils.wallet.list.invalidate();
  };

  const handleBulkSetPriority = async () => {
    const selectedWallets = filteredWallets.filter((w) =>
      selectedKeys.has(`${w.chain}:${w.address}`)
    );
    for (const w of selectedWallets) {
      await updateMutation.mutateAsync({
        address: w.address,
        chain: w.chain as any,
        watchPriority: "HIGH",
      });
    }
    utils.wallet.list.invalidate();
  };

  const handleBulkExport = () => {
    const selectedWallets = filteredWallets.filter((w) =>
      selectedKeys.has(`${w.chain}:${w.address}`)
    );
    const rows = [
      ["address", "chain", "label", "ensName", "edge", "style", "size", "watchPriority", "isSelf"],
      ...selectedWallets.map((w) => [
        w.address,
        w.chain,
        w.label ?? "",
        w.ensName ?? "",
        w.edge ?? "",
        w.style ?? "",
        w.size ?? "",
        w.watchPriority ?? "NORMAL",
        w.isSelf ? "true" : "false",
      ]),
    ];
    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `watchtower_wallets_selected_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkDelete = async () => {
    const selectedWallets = filteredWallets.filter((w) =>
      selectedKeys.has(`${w.chain}:${w.address}`)
    );
    for (const w of selectedWallets) {
      await deleteMutation.mutateAsync({
        address: w.address,
        chain: w.chain as any,
      });
    }
    setSelectedKeys(new Set());
    utils.wallet.list.invalidate();
  };

  const handleExportAllCsv = () => {
    const rows = [
      ["address", "chain", "label", "ensName", "edge", "style", "size", "watchPriority", "isSelf"],
      ...filteredWallets.map((w) => [
        w.address,
        w.chain,
        w.label ?? "",
        w.ensName ?? "",
        w.edge ?? "",
        w.style ?? "",
        w.size ?? "",
        w.watchPriority ?? "NORMAL",
        w.isSelf ? "true" : "false",
      ]),
    ];
    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `watchtower_wallets_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="min-h-screen bg-[#101214] text-[#E8ECEF] flex flex-col p-6 max-w-[1440px] mx-auto w-full gap-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 py-2">
        <div>
          <div className="font-mono text-[12px] text-[#929BA3] uppercase mb-2 flex items-center gap-2">
            <span>WATCHTOWER</span>
            <span className="text-[#30373D]">/</span>
            <span className="text-[#D7A84B]">WALLETS</span>
          </div>
          <h1 className="font-sans text-[32px] font-bold text-[#E8ECEF] uppercase tracking-tight">
            WALLETS
          </h1>
          <p className="font-sans text-[14px] text-[#929BA3] mt-1">
            Tracked EVM watchlist and multi-chain profiling
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportAllCsv}
            className="h-10 px-4 bg-transparent border border-[#30373D] text-[#E8ECEF] font-sans text-[12px] uppercase font-semibold hover:bg-[#1E2327] transition-colors rounded-none focus:outline-none focus:ring-1 focus:ring-[#D7A84B] flex items-center gap-2"
          >
            <span>↓</span>
            Export CSV
          </button>
          <Link
            href="/wallets/new"
            className="h-10 px-4 bg-[#D7A84B] text-[#101214] font-sans text-[12px] uppercase font-bold hover:brightness-110 active:translate-y-[1px] transition-all rounded-none focus:outline-none flex items-center gap-2"
          >
            <span>+</span>
            Import Wallets
          </Link>
        </div>
      </div>

      {/* Filters Bar */}
      <WalletFilters
        filters={filters}
        onFilterChange={setFilters}
        clusterOptions={clustersQuery.data ?? []}
        totalCount={listQuery.data?.totalCount ?? 0}
        filteredCount={filteredWallets.length}
      />

      {/* Inline Tag Editor Modal/Card if editing */}
      {editingWallet && (
        <div className="border border-[#D7A84B] bg-[#171A1D] p-4 shadow-xl">
          <TagEditor
            address={editingWallet.address}
            chain={editingWallet.chain as any}
            initialEdge={editingWallet.edge}
            initialStyle={editingWallet.style}
            initialSize={editingWallet.size}
            initialLabel={editingWallet.label}
            initialNotes={editingWallet.notes}
            initialWatchPriority={editingWallet.watchPriority as any}
            initialIsBlacklisted={editingWallet.isBlacklisted}
            initialIsSelf={editingWallet.isSelf}
            onSaved={() => setEditingWallet(null)}
            onCancel={() => setEditingWallet(null)}
          />
        </div>
      )}

      {/* Main Table */}
      <div className="flex-1">
        <WalletTable
          wallets={filteredWallets}
          selectedKeys={selectedKeys}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={handleToggleSelectAll}
          onEditTags={(w) => setEditingWallet(w)}
          onDeleteWallet={async (w) => {
            if (confirm(`Delete wallet ${w.address} on ${w.chain}?`)) {
              await deleteMutation.mutateAsync({ address: w.address, chain: w.chain as any });
            }
          }}
          onResyncWallet={async (w) => {
            await addMutation.mutateAsync({
              address: w.address,
              chain: w.chain as any,
              forceFullResync: true,
            });
          }}
          timeFormat={filters.timeFormat}
          isLoading={listQuery.isLoading}
          emptyState={
            <div className="flex flex-col items-center justify-center gap-2 py-12">
              <p className="font-sans text-[14px] text-[#E8ECEF]">No wallets yet — import a CSV</p>
              <p className="font-mono text-[12px] text-[#929BA3]">
                Use &quot;Import Wallets&quot; above to register addresses or upload batches.
              </p>
            </div>
          }
        />
      </div>

      {/* Floating Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedKeys.size}
        onResync={handleBulkResync}
        onSetPriority={handleBulkSetPriority}
        onExport={handleBulkExport}
        onDelete={handleBulkDelete}
        onClearSelection={() => setSelectedKeys(new Set())}
        isLoading={deleteMutation.isPending || updateMutation.isPending}
      />
    </main>
  );
}
