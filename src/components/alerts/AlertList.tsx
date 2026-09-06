"use client";

import React, { useState } from "react";
import { StateBadge } from "@/components/shared/StateBadge";
import { AddressChip } from "@/components/shared/AddressChip";
import { EvidenceTooltip } from "@/components/alerts/EvidenceTooltip";
import { getClusterColor } from "@/lib/format/cluster-color";
import { formatWalletLabel } from "@/lib/format/wallet-label";
import { formatFullUsd } from "@/lib/format/usd";
import { getTxExplorerUrl } from "@/lib/rules/evidence";
import type { AlertListItem } from "@/server/services/alert/list";

export interface AlertListProps {
  alerts: AlertListItem[];
  isLoading?: boolean;
  selectedAlertId?: string | null;
  onSelectAlert?: (alert: AlertListItem | null) => void;
  onAcknowledge: (id: string) => Promise<void> | void;
  isAcknowledging?: boolean;
}

export function AlertList({
  alerts,
  isLoading = false,
  selectedAlertId,
  onSelectAlert,
  onAcknowledge,
  isAcknowledging = false,
}: AlertListProps) {
  const [useUtc, setUseUtc] = useState(true);
  const [activeRailAlert, setActiveRailAlert] = useState<AlertListItem | null>(null);

  // Sync activeRailAlert with selectedAlertId if provided
  const currentSelectedAlert =
    activeRailAlert ?? (selectedAlertId ? alerts.find((a) => a.id === selectedAlertId) ?? null : null);

  const handleRowClick = (alert: AlertListItem) => {
    setActiveRailAlert(alert);
    onSelectAlert?.(alert);
  };

  const handleCloseRail = () => {
    setActiveRailAlert(null);
    onSelectAlert?.(null);
  };

  const formatTimestamp = (date: Date | string) => {
    const d = new Date(date);
    if (useUtc) {
      return d.toISOString().replace("T", " ").slice(0, 19) + "Z";
    }
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(d);
  };

  return (
    <div className="flex-1 flex overflow-hidden border border-[#30373D] bg-[#101214] relative">
      {/* Dense Alerts Table View */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse data-table select-none">
            <thead className="sticky top-0 bg-[#171A1D] border-b border-[#30373D] z-10 shadow-xs">
              <tr>
                <th className="py-2 px-3 font-mono text-[10px] text-[#929BA3] uppercase tracking-wider w-44">
                  <button
                    type="button"
                    onClick={() => setUseUtc(!useUtc)}
                    title="Toggle UTC / Local time"
                    aria-label={`Switch to ${useUtc ? "Local" : "UTC"} time`}
                    className="flex items-center gap-1 hover:text-[#E8ECEF] transition-colors"
                  >
                    <span>TIME ({useUtc ? "UTC" : "LOCAL"})</span>
                    <span className="text-[12px]">⇄</span>
                  </button>
                </th>
                <th className="py-2 px-3 font-mono text-[10px] text-[#929BA3] uppercase tracking-wider w-24">
                  RULE
                </th>
                <th className="py-2 px-3 font-mono text-[10px] text-[#929BA3] uppercase tracking-wider min-w-[200px]">
                  WALLET
                </th>
                <th className="py-2 px-3 font-mono text-[10px] text-[#929BA3] uppercase tracking-wider w-28">
                  STATE
                </th>
                <th className="py-2 px-3 font-mono text-[10px] text-[#929BA3] uppercase tracking-wider w-28">
                  TOKEN
                </th>
                <th className="py-2 px-3 font-mono text-[10px] text-[#929BA3] uppercase tracking-wider text-right w-28">
                  TRIGGER USD
                </th>
                <th className="py-2 px-3 font-mono text-[10px] text-[#929BA3] uppercase tracking-wider text-center w-20">
                  EVIDENCE
                </th>
                <th className="py-2 px-3 font-mono text-[10px] text-[#929BA3] uppercase tracking-wider text-right w-28 pr-4">
                  ACTIONS
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#30373D] font-mono text-[11px] text-[#E8ECEF]">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-[#929BA3]">
                    <div className="flex flex-col items-center gap-2">
                      <span className="w-5 h-5 border-2 border-[#D7A84B] border-t-transparent animate-spin rounded-none" />
                      <span className="tracking-wider uppercase text-[11px]">Loading alert feed...</span>
                    </div>
                  </td>
                </tr>
              ) : alerts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-[#929BA3]">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-[24px]">🛡️</span>
                      <span className="font-bold tracking-widest uppercase text-[#E8ECEF]">
                        NO ACTIVE ALERTS MATCHING CRITERIA
                      </span>
                      <span className="text-[11px] text-[#929BA3]">
                        Triage queue is clear or filters excluded all events.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                alerts.map((alert) => {
                  const isSelected = currentSelectedAlert?.id === alert.id;
                  const isUnread = alert.readAt === null;
                  const isEscalatedA5 = alert.type === "A5";
                  const clusterId =
                    alert.clusterId || alert.wallet?.clusterLinks?.[0]?.clusterId;
                  const clusterColor = clusterId ? getClusterColor(clusterId) : null;
                  const tagsLabel = alert.wallet
                    ? formatWalletLabel({
                        edge: alert.wallet.edge,
                        style: alert.wallet.style,
                        size: alert.wallet.size,
                      })
                    : "";

                  // First tx hash if present in evidence
                  let primaryTxHash: string | null = null;
                  if (alert.evidenceJson && typeof alert.evidenceJson === "object") {
                    const links = (alert.evidenceJson as Record<string, unknown>).txLinks;
                    if (Array.isArray(links) && links.length > 0) {
                      const first = links[0];
                      primaryTxHash = typeof first === "string" ? first : first?.hash || null;
                    }
                  }

                  return (
                    <tr
                      key={alert.id}
                      data-testid={`alert-row-${alert.id}`}
                      onClick={() => handleRowClick(alert)}
                      className={`cursor-pointer transition-colors duration-100 ${
                        isSelected
                          ? "bg-[#1E2327] border-l-2 border-[#D7A84B]"
                          : isUnread
                          ? "bg-[#171A1D]/60 hover:bg-[#1E2327]"
                          : "hover:bg-[#171A1D]"
                      }`}
                    >
                      {/* Timestamp */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-[#929BA3] text-[11px]">
                        <div className="flex items-center gap-1.5">
                          {isUnread && (
                            <span
                              title="Unread alert"
                              aria-label="Unread alert"
                              className="w-1.5 h-1.5 bg-[#D7A84B] rounded-none shrink-0"
                            />
                          )}
                          <span>{formatTimestamp(alert.occurredAt || alert.createdAt)}</span>
                        </div>
                      </td>

                      {/* Rule Badge */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-none ${
                            isEscalatedA5
                              ? "bg-[#D7A84B] text-[#101214] font-extrabold shadow-[0_0_8px_rgba(215,168,75,0.4)]"
                              : alert.state === "TRIGGERED"
                              ? "bg-[#D87870]/20 text-[#D87870] border border-[#D87870]/40"
                              : alert.state === "EXIT_RISK"
                              ? "bg-[#E59866]/20 text-[#E59866] border border-[#E59866]/40"
                              : "bg-[#D7A84B]/15 text-[#D7A84B] border border-[#D7A84B]/40"
                          }`}
                        >
                          {alert.type}
                          {isEscalatedA5 ? " [ESC]" : ""}
                        </span>
                      </td>

                      {/* Wallet Chip with cluster dot & tags */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <AddressChip
                            address={alert.walletAddress}
                            ensName={alert.wallet?.ensName}
                            chain={(alert.walletChain || alert.wallet?.chain || "BASE").toLowerCase()}
                            clusterColor={clusterColor}
                            showCopy={false}
                            showExplorer={false}
                            internalLink={true}
                          />

                          {tagsLabel && (
                            <span className="text-[9px] px-1 py-0.2 bg-[#121416] text-[#929BA3] border border-[#30373D] rounded-none">
                              {tagsLabel}
                            </span>
                          )}

                          {alert.wallet?.isSelf && (
                            <span className="text-[9px] px-1 py-0.2 bg-[#D7A84B]/20 text-[#D7A84B] border border-[#D7A84B] rounded-none font-bold">
                              SELF
                            </span>
                          )}
                        </div>
                      </td>

                      {/* State Badge */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <StateBadge state={alert.state} />
                      </td>

                      {/* Token */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {alert.tokenSymbol ? (
                          <span className="font-bold text-[#E8ECEF]">
                            ${alert.tokenSymbol}
                          </span>
                        ) : alert.tokenAddress ? (
                          <span className="text-[#929BA3]">
                            {alert.tokenAddress.slice(0, 6)}...{alert.tokenAddress.slice(-4)}
                          </span>
                        ) : (
                          <span className="text-[#929BA3]/50">—</span>
                        )}
                      </td>

                      {/* Trigger USD */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap font-medium text-[#E8ECEF]">
                        {alert.amountUsd !== null && alert.amountUsd !== undefined
                          ? formatFullUsd(Number(alert.amountUsd))
                          : "—"}
                      </td>

                      {/* Evidence Popover Trigger */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(alert);
                          }}
                          title="Inspect Evidence Trail"
                          aria-label={`Inspect evidence for alert ${alert.id}`}
                          className={`p-1 border rounded-none transition-colors ${
                            isSelected
                              ? "border-[#D7A84B] bg-[#D7A84B] text-[#101214]"
                              : "border-[#30373D] bg-[#121416] text-[#929BA3] hover:text-[#D7A84B] hover:border-[#D7A84B]"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px] block">
                            visibility
                          </span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap pr-4">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {/* Acknowledge Button */}
                          {isUnread ? (
                            <button
                              type="button"
                              onClick={() => onAcknowledge(alert.id)}
                              disabled={isAcknowledging}
                              title="Acknowledge Alert"
                              aria-label={`Acknowledge alert ${alert.id}`}
                              className="px-2 py-0.5 text-[10px] font-bold uppercase bg-[#D7A84B]/20 border border-[#D7A84B] text-[#D7A84B] hover:bg-[#D7A84B] hover:text-[#101214] transition-colors rounded-none"
                            >
                              ACK
                            </button>
                          ) : (
                            <span className="text-[10px] text-[#79B79A] flex items-center gap-0.5">
                              <span>✓</span>
                              <span>READ</span>
                            </span>
                          )}

                          {/* Explorer Link */}
                          {primaryTxHash && (
                            <a
                              href={getTxExplorerUrl(primaryTxHash, alert.walletChain || alert.wallet?.chain || "BASE")}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View in block explorer"
                              aria-label={`View transaction ${primaryTxHash} on block explorer`}
                              className="p-1 text-[#929BA3] hover:text-[#D7A84B] hover:border-[#D7A84B] border border-[#30373D] bg-[#121416] rounded-none"
                            >
                              <span className="text-[11px] leading-none block">↗</span>
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Evidence Rail Side Panel (matches alerts.html) */}
      {currentSelectedAlert && (
        <aside
          aria-label="Evidence Rail"
          className="w-80 md:w-96 border-l border-[#30373D] bg-[#121416] flex flex-col shrink-0 z-20 shadow-xl overflow-hidden"
        >
          {/* Rail Header */}
          <div className="p-3.5 border-b border-[#30373D] bg-[#171A1D] flex items-center justify-between">
            <div>
              <div className="font-mono text-[12px] font-bold text-[#D7A84B] uppercase tracking-wider flex items-center gap-2">
                <span>EVIDENCE_RAIL</span>
                <span className="text-[10px] px-1 py-0.2 bg-[#1E2327] text-[#929BA3] border border-[#30373D]">
                  {currentSelectedAlert.type}
                </span>
              </div>
              <div className="font-mono text-[10px] text-[#929BA3] mt-0.5 truncate max-w-[220px]">
                {currentSelectedAlert.wallet?.label || currentSelectedAlert.walletAddress}
              </div>
            </div>

            <button
              type="button"
              onClick={handleCloseRail}
              aria-label="Close evidence rail"
              className="text-[#929BA3] hover:text-[#E8ECEF] p-1 text-[14px]"
            >
              ✕
            </button>
          </div>

          {/* Rail Scrollable Content */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            <EvidenceTooltip
              evidenceJson={currentSelectedAlert.evidenceJson}
              alertType={currentSelectedAlert.type}
              chain={currentSelectedAlert.walletChain || currentSelectedAlert.wallet?.chain || "BASE"}
            />
          </div>

          {/* Rail Footer Actions */}
          <div className="p-3.5 border-t border-[#30373D] bg-[#171A1D] flex gap-2">
            {currentSelectedAlert.readAt === null ? (
              <button
                type="button"
                onClick={() => onAcknowledge(currentSelectedAlert.id)}
                disabled={isAcknowledging}
                className="flex-1 h-9 bg-[#D7A84B] text-[#101214] font-mono text-[11px] font-bold uppercase tracking-wider rounded-none hover:brightness-110 transition-colors"
              >
                ACKNOWLEDGE
              </button>
            ) : (
              <div className="flex-1 h-9 bg-[#1E2327] border border-[#30373D] text-[#79B79A] font-mono text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
                <span>✓</span>
                <span>ACKNOWLEDGED</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleCloseRail}
              className="px-3 h-9 border border-[#30373D] text-[#929BA3] hover:text-[#E8ECEF] hover:bg-[#1E2327] font-mono text-[11px] uppercase tracking-wider rounded-none transition-colors"
            >
              CLOSE
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}
