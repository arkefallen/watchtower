"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { AddressChip } from "@/components/shared/AddressChip";
import { UsdCell } from "@/components/shared/UsdCell";
import { TimeCell } from "@/components/shared/TimeCell";
import { StateBadge } from "@/components/shared/StateBadge";
import { LabelPreview } from "./LabelPreview";
import type { TimeFormat } from "./WalletFilters";

export interface WalletRecord {
  address: string;
  chain: string;
  label?: string | null;
  ensName?: string | null;
  edge?: string | null;
  style?: string | null;
  size?: string | null;
  notes?: string | null;
  isBlacklisted?: boolean;
  isSelf?: boolean;
  watchPriority?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  profile?: {
    lastActiveAt?: Date | string | null;
    totalUsdValue?: number | null;
    stableUsdValue?: number | null;
    balanceUsd?: number | null;
  } | null;
  syncState?: {
    status: string;
    lastSyncedAt?: Date | string | null;
    lastError?: string | null;
  } | null;
  alertState?: {
    state: string;
    reason?: string | null;
  } | null;
  clusterLinks?: Array<{
    clusterId: string;
    cluster?: {
      id: string;
      name?: string | null;
      color?: string | null;
    } | null;
  }>;
}

export interface WalletTableProps {
  wallets: WalletRecord[];
  selectedKeys: Set<string>;
  onToggleSelect: (key: string) => void;
  onToggleSelectAll: () => void;
  onEditTags?: (wallet: WalletRecord) => void;
  onDeleteWallet?: (wallet: WalletRecord) => void;
  onResyncWallet?: (wallet: WalletRecord) => void;
  timeFormat?: TimeFormat;
  isLoading?: boolean;
  emptyState?: React.ReactNode;
}

export function WalletTable({
  wallets,
  selectedKeys,
  onToggleSelect,
  onToggleSelectAll,
  onEditTags,
  onDeleteWallet,
  onResyncWallet,
  timeFormat = "local",
  isLoading = false,
  emptyState,
}: WalletTableProps) {
  const [openActionKey, setOpenActionKey] = useState<string | null>(null);

  const isAllSelected = wallets.length > 0 && wallets.every((w) => selectedKeys.has(`${w.chain}:${w.address}`));

  const formatActivityTime = (dateVal?: Date | string | null) => {
    if (!dateVal) return "—";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "—";

    if (timeFormat === "utc") {
      return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
    }
    if (timeFormat === "block") {
      // In block mode, we can show relative or time with block indicator
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    // Local
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const columns: Column<WalletRecord>[] = [
    {
      key: "select",
      header: (
        <input
          type="checkbox"
          checked={isAllSelected}
          onChange={onToggleSelectAll}
          aria-label="Select all wallets"
          className="w-4 h-4 rounded-none bg-[#101214] border-[#30373D] text-[#D7A84B] focus:ring-0 focus:ring-offset-0 cursor-pointer"
        />
      ),
      align: "center",
      headerClassName: "w-10",
      cellClassName: "w-10 text-center",
      render: (wallet) => {
        const key = `${wallet.chain}:${wallet.address}`;
        const isChecked = selectedKeys.has(key);
        return (
          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => onToggleSelect(key)}
            aria-label={`Select wallet ${wallet.address}`}
            className="w-4 h-4 rounded-none bg-[#101214] border-[#30373D] text-[#D7A84B] focus:ring-0 focus:ring-offset-0 cursor-pointer"
          />
        );
      },
    },
    {
      key: "identity",
      header: "Identifier / Address",
      render: (wallet) => {
        const clusterColor = wallet.clusterLinks?.[0]?.cluster?.color ?? null;
        return (
          <div className="flex items-center gap-2">
            <AddressChip
              address={wallet.address}
              ensName={wallet.ensName}
              chain={wallet.chain}
              clusterColor={clusterColor}
              truncate={true}
            />
            {wallet.watchPriority === "HIGH" && (
              <span
                className="px-1 py-0.2 text-[10px] font-mono font-bold bg-[#D7A84B] text-[#101214]"
                title="Priority Watch"
              >
                ★
              </span>
            )}
            {wallet.isSelf && (
              <span
                className="px-1 py-0.2 text-[10px] font-mono border border-[#30373D] text-[#929BA3]"
                title="Self Wallet"
              >
                SELF
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "chain",
      header: "Network",
      render: (wallet) => (
        <span className="inline-flex items-center px-1.5 py-0.5 border border-[#30373D] bg-[#171A1D] text-[#E8ECEF] font-mono text-[10px] uppercase tracking-wider">
          {wallet.chain}
        </span>
      ),
    },
    {
      key: "label",
      header: "Behavior / Type",
      render: (wallet) => (
        <LabelPreview
          edge={wallet.edge}
          style={wallet.style}
          size={wallet.size}
          customLabel={wallet.label}
        />
      ),
    },
    {
      key: "cluster",
      header: "Cluster",
      render: (wallet) => {
        const link = wallet.clusterLinks?.[0];
        if (!link) {
          return <span className="text-[#929BA3] font-mono text-[12px]">—</span>;
        }
        const name = link.cluster?.name || `#${link.clusterId.slice(0, 4)}`;
        const color = link.cluster?.color || "#D7A84B";
        return (
          <div className="inline-flex items-center gap-1.5 font-mono text-[12px]">
            <span
              className="w-2 h-2 rounded-none shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-[#E8ECEF]">{name}</span>
          </div>
        );
      },
    },
    {
      key: "parked",
      header: "Parked Stables (USD)",
      align: "right",
      render: (wallet) => {
        const val = wallet.profile?.stableUsdValue ?? wallet.profile?.balanceUsd ?? null;
        return (
          <span className="font-mono text-[13px] text-[#E8ECEF]">
            <UsdCell value={val} />
          </span>
        );
      },
    },
    {
      key: "activity",
      header: "Last Activity",
      align: "right",
      render: (wallet) => {
        const ts = wallet.profile?.lastActiveAt || wallet.updatedAt;
        if (!ts) {
          return <span className="text-[#929BA3] font-mono text-[12px]">—</span>;
        }
        return (
          <span className="font-mono text-[12px] text-[#929BA3]" title={String(ts)}>
            {formatActivityTime(ts)}
          </span>
        );
      },
    },
    {
      key: "alertState",
      header: "Alert State",
      render: (wallet) => {
        const alertSt = wallet.alertState?.state || "IDLE";
        const reason = wallet.alertState?.reason ?? undefined;
        return <StateBadge state={alertSt} subText={reason} />;
      },
    },
    {
      key: "syncState",
      header: "Sync State",
      render: (wallet) => {
        const syncSt = wallet.syncState?.status || "NEVER_SYNCED";
        return <StateBadge state={syncSt} />;
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      headerClassName: "w-10",
      cellClassName: "w-10 text-right relative",
      render: (wallet) => {
        const key = `${wallet.chain}:${wallet.address}`;
        const isOpen = openActionKey === key;
        return (
          <div className="relative inline-block text-left">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenActionKey(isOpen ? null : key);
              }}
              className="p-1 text-[#929BA3] hover:text-[#E8ECEF] transition-colors focus:outline-none"
              title="Row actions"
              aria-label="Row actions"
            >
              ⋮
            </button>

            {isOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 mt-1 w-44 bg-[#171A1D] border border-[#30373D] shadow-2xl py-1 z-30 font-sans text-[12px] uppercase"
              >
                <Link
                  href={`/wallets/${wallet.chain}/${wallet.address}`}
                  className="block px-3 py-1.5 text-[#E8ECEF] hover:bg-[#1E2327] hover:text-[#D7A84B]"
                  onClick={() => setOpenActionKey(null)}
                >
                  View Profile
                </Link>
                {onEditTags && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenActionKey(null);
                      onEditTags(wallet);
                    }}
                    className="w-full text-left px-3 py-1.5 text-[#E8ECEF] hover:bg-[#1E2327] hover:text-[#D7A84B]"
                  >
                    Edit Tags
                  </button>
                )}
                {onResyncWallet && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenActionKey(null);
                      onResyncWallet(wallet);
                    }}
                    className="w-full text-left px-3 py-1.5 text-[#E8ECEF] hover:bg-[#1E2327] hover:text-[#D7A84B]"
                  >
                    Force Re-sync
                  </button>
                )}
                {onDeleteWallet && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenActionKey(null);
                      onDeleteWallet(wallet);
                    }}
                    className="w-full text-left px-3 py-1.5 text-[#D87870] hover:bg-[#93000a]/20"
                  >
                    Delete Wallet
                  </button>
                )}
              </div>
            )}
          </div>
        );
      },
    },
  ];

  const getBorderColor = (wallet: WalletRecord) => {
    const alertSt = wallet.alertState?.state?.toUpperCase();
    if (alertSt === "TRIGGERED") return "#D87870";
    if (alertSt === "ARMED") return "#D7A84B";
    const isSelected = selectedKeys.has(`${wallet.chain}:${wallet.address}`);
    if (isSelected) return "#D7A84B";
    return undefined;
  };

  return (
    <DataTable<WalletRecord>
      columns={columns}
      data={wallets}
      keyExtractor={(w) => `${w.chain}:${w.address}`}
      isLoading={isLoading}
      emptyState={emptyState}
      getRowBorderColor={getBorderColor}
    />
  );
}
