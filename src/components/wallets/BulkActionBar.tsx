"use client";

import React, { useState } from "react";

export interface BulkActionBarProps {
  selectedCount: number;
  onResync: () => void | Promise<void>;
  onSetPriority: () => void | Promise<void>;
  onExport: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  onClearSelection: () => void;
  isLoading?: boolean;
}

export function BulkActionBar({
  selectedCount,
  onResync,
  onSetPriority,
  onExport,
  onDelete,
  onClearSelection,
  isLoading = false,
}: BulkActionBarProps) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  if (selectedCount <= 0) {
    return null;
  }

  return (
    <aside
      aria-label="Bulk actions toolbar"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#171A1D] border-t-2 border-t-[#D7A84B] border-x border-b border-[#30373D] shadow-2xl px-6 py-3 flex items-center gap-6 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <div className="font-mono text-[12px] text-[#D7A84B] uppercase font-bold whitespace-nowrap">
        {selectedCount} {selectedCount === 1 ? "wallet" : "wallets"} selected
      </div>

      <div className="h-6 w-px bg-[#30373D]" />

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={isLoading}
          onClick={onResync}
          className="h-8 px-3 bg-transparent border border-[#30373D] text-[#E8ECEF] font-sans text-[12px] uppercase font-semibold hover:bg-[#1E2327] transition-colors rounded-none focus:outline-none focus:ring-1 focus:ring-[#D7A84B] disabled:opacity-50"
        >
          Re-sync Selected (Incremental)
        </button>

        <button
          type="button"
          disabled={isLoading}
          onClick={onSetPriority}
          className="h-8 px-3 bg-transparent border border-[#30373D] text-[#E8ECEF] font-sans text-[12px] uppercase font-semibold hover:bg-[#1E2327] transition-colors rounded-none focus:outline-none focus:ring-1 focus:ring-[#D7A84B] disabled:opacity-50"
        >
          Set Priority Watch
        </button>

        <button
          type="button"
          disabled={isLoading}
          onClick={onExport}
          className="h-8 px-3 bg-transparent border border-[#30373D] text-[#E8ECEF] font-sans text-[12px] uppercase font-semibold hover:bg-[#1E2327] transition-colors rounded-none focus:outline-none focus:ring-1 focus:ring-[#D7A84B] disabled:opacity-50"
        >
          Export Selection
        </button>

        {showConfirmDelete ? (
          <div className="flex items-center gap-2 bg-[#93000a]/20 border border-[#D87870] px-2 py-1">
            <span className="font-sans text-[11px] text-[#D87870] uppercase font-bold">
              Confirm delete?
            </span>
            <button
              type="button"
              disabled={isLoading}
              onClick={async () => {
                await onDelete();
                setShowConfirmDelete(false);
              }}
              className="px-2 py-0.5 bg-[#D87870] text-[#101214] font-bold text-[11px] uppercase rounded-none hover:brightness-110"
            >
              Yes, Delete
            </button>
            <button
              type="button"
              onClick={() => setShowConfirmDelete(false)}
              className="text-[#929BA3] hover:text-[#E8ECEF] text-[11px] uppercase"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={isLoading}
            onClick={() => setShowConfirmDelete(true)}
            className="h-8 px-3 bg-transparent border border-[#D87870] text-[#D87870] font-sans text-[12px] uppercase font-semibold hover:bg-[#93000a]/30 transition-colors rounded-none focus:outline-none focus:ring-1 focus:ring-[#D87870] disabled:opacity-50"
          >
            Delete (Danger)
          </button>
        )}

        <button
          type="button"
          onClick={onClearSelection}
          className="h-8 w-8 flex items-center justify-center text-[#929BA3] hover:text-[#E8ECEF] transition-colors rounded-none ml-2"
          title="Clear Selection"
          aria-label="Clear Selection"
        >
          ✕
        </button>
      </div>
    </aside>
  );
}
