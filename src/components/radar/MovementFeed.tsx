// src/components/radar/MovementFeed.tsx
"use client";

import React from "react";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { AddressChip } from "@/components/shared/AddressChip";
import { UsdCell } from "@/components/shared/UsdCell";
import { StateBadge } from "@/components/shared/StateBadge";
import { TimeCell } from "@/components/shared/TimeCell";

/** Minimal movement event shape used by the UI */
export interface MovementEvent {
  id: string;
  timestamp: string | Date;
  fromAddress: string;
  toAddress: string;
  chain: string;
  kind: string; // e.g., "TRANSFER", "SWAP"
  amountUsd: number;
  blockNumber: string | number;
}

interface Props {
  data: MovementEvent[];
  isLoading?: boolean;
}

export function MovementFeed({ data, isLoading = false }: Props) {
  const columns: Column<MovementEvent>[] = [
    {
      key: "time",
      header: "Time",
      render: (ev) => (
        <TimeCell timestamp={String(ev.timestamp)} blockNumber={String(ev.blockNumber)} />
      ),
    },
    {
      key: "from",
      header: "From",
      render: (ev) => (
        <AddressChip address={ev.fromAddress} chain={ev.chain} internalLink={true} truncate />
      ),
    },
    {
      key: "to",
      header: "To",
      render: (ev) => (
        <AddressChip address={ev.toAddress} chain={ev.chain} internalLink={true} truncate />
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (ev) => <StateBadge state={ev.kind} />,
    },
    {
      key: "amount",
      header: "Amount (USD)",
      render: (ev) => <UsdCell value={ev.amountUsd} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      keyExtractor={(row) => row.id}
      emptyState={<div className="p-4 text-center text-[#929BA3]">No movements found</div>}
    />
  );
}
