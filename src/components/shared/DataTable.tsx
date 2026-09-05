"use client";

import React from "react";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
  render: (row: T, index: number) => React.ReactNode;
  align?: "left" | "center" | "right";
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  onRowClick?: (row: T) => void;
  getRowBorderColor?: (row: T) => string | undefined;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading,
  emptyState,
  onRowClick,
  getRowBorderColor,
  className = "",
}: DataTableProps<T>) {
  return (
    <div className={`w-full overflow-hidden border border-[#30373D] bg-[#0c0e10] flex flex-col ${className}`}>
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead className="sticky top-0 bg-[#1E2327] border-b border-[#30373D] z-10">
            <tr>
              {columns.map((col) => {
                const alignClass =
                  col.align === "right"
                    ? "text-right"
                    : col.align === "center"
                    ? "text-center"
                    : "text-left";
                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={`p-3 font-sans text-[12px] font-semibold text-[#929BA3] uppercase tracking-wider ${alignClass} ${col.headerClassName ?? ""}`}
                  >
                    {col.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#30373D] font-mono text-[13px] text-[#E8ECEF]">
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="p-8 text-center text-[#929BA3] font-mono animate-pulse"
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-none bg-[#D7A84B] animate-ping" />
                    <span>Loading registry data...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="p-12 text-center text-[#929BA3]"
                >
                  {emptyState ?? (
                    <div className="flex flex-col items-center justify-center gap-2">
                      <p className="font-sans text-[14px] text-[#E8ECEF]">No wallets tracked yet</p>
                      <p className="font-mono text-[12px] text-[#929BA3]">
                        Import a CSV or register a single address to begin monitoring.
                      </p>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              data.map((row, idx) => {
                const rowKey = keyExtractor(row, idx);
                const borderLeftColor = getRowBorderColor ? getRowBorderColor(row) : undefined;
                return (
                  <tr
                    key={rowKey}
                    tabIndex={0}
                    onClick={() => onRowClick?.(row)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick?.(row);
                      }
                    }}
                    style={{
                      borderLeft: borderLeftColor ? `3px solid ${borderLeftColor}` : "3px solid transparent",
                    }}
                    className={`transition-colors duration-100 bg-[#121416] hover:bg-[#1E2327] ${
                      onRowClick ? "cursor-pointer" : "cursor-default"
                    } focus:outline-none focus:bg-[#1E2327] focus:ring-1 focus:ring-inset focus:ring-[#D7A84B]`}
                  >
                    {columns.map((col) => {
                      const alignClass =
                        col.align === "right"
                          ? "text-right"
                          : col.align === "center"
                          ? "text-center"
                          : "text-left";
                      return (
                        <td
                          key={col.key}
                          className={`p-3 align-middle ${alignClass} ${col.cellClassName ?? ""}`}
                        >
                          {col.render(row, idx)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
