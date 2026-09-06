"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { AlertFilters, type StateFilterTab } from "@/components/alerts/AlertFilters";
import { AlertList } from "@/components/alerts/AlertList";
import type { AlertListItem } from "@/server/services/alert/list";
import type { AlertType } from "@/generated/prisma/client";

export default function AlertsPage() {
  const [stateFilter, setStateFilter] = useState<StateFilterTab>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [selectedAlert, setSelectedAlert] = useState<AlertListItem | null>(null);

  // Pagination state: stack of cursors for navigating forward and back
  const [cursorHistory, setCursorHistory] = useState<(string | undefined)[]>([undefined]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const utils = trpc.useUtils();

  // Map category filter to types/type
  let typeParam: AlertType | undefined = undefined;
  let typesParam: AlertType[] | undefined = undefined;

  if (categoryFilter === "CAT_ARMING") {
    typesParam = ["A1", "A2", "A3", "A4", "A5", "A6"];
  } else if (categoryFilter === "CAT_TRIGGER") {
    typesParam = ["T1", "T2", "T3", "T4", "T5"];
  } else if (categoryFilter === "CAT_EXIT_RISK") {
    typesParam = ["C1", "C2", "C3", "C4"];
  } else if (categoryFilter !== "ALL") {
    typeParam = categoryFilter as AlertType;
  }

  const currentCursor = cursorHistory[currentPageIndex];

  // Fetch alerts list
  const { data: alertData, isLoading: isAlertsLoading, refetch: refetchAlerts } = trpc.alert.list.useQuery(
    {
      state: stateFilter === "ALL" ? undefined : stateFilter,
      type: typeParam,
      types: typesParam,
      search: search.trim() ? search.trim() : undefined,
      unreadOnly: unreadOnly ? true : undefined,
      cursor: currentCursor,
      limit: 50,
    },
    {
      staleTime: 5000,
    }
  );

  // Fetch KPI metrics
  const { data: kpiData, isLoading: isKpisLoading, refetch: refetchKpis } = trpc.alert.kpis.useQuery(undefined, {
    refetchInterval: 15000,
  });

  // Acknowledge mutation
  const acknowledgeMutation = trpc.alert.acknowledge.useMutation({
    onSuccess: () => {
      utils.alert.list.invalidate();
      utils.alert.kpis.invalidate();
      utils.alert.unreadCount.invalidate();
    },
  });

  // Mark all read mutation
  const markAllReadMutation = trpc.alert.markAllRead.useMutation({
    onSuccess: () => {
      utils.alert.list.invalidate();
      utils.alert.kpis.invalidate();
      utils.alert.unreadCount.invalidate();
    },
  });

  const handleAcknowledge = async (id: string) => {
    await acknowledgeMutation.mutateAsync({ id });
  };

  const handleMarkAllRead = async () => {
    await markAllReadMutation.mutateAsync();
  };

  const handleRefresh = () => {
    refetchAlerts();
    refetchKpis();
    utils.alert.unreadCount.invalidate();
  };

  // Reset pagination on filter changes
  const handleStateFilterChange = (tab: StateFilterTab) => {
    setStateFilter(tab);
    setCursorHistory([undefined]);
    setCurrentPageIndex(0);
  };

  const handleCategoryFilterChange = (cat: string) => {
    setCategoryFilter(cat);
    setCursorHistory([undefined]);
    setCurrentPageIndex(0);
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCursorHistory([undefined]);
    setCurrentPageIndex(0);
  };

  const handleUnreadOnlyChange = (unread: boolean) => {
    setUnreadOnly(unread);
    setCursorHistory([undefined]);
    setCurrentPageIndex(0);
  };

  // Pagination handlers
  const handleNextPage = () => {
    if (!alertData?.nextCursor) return;
    const nextIdx = currentPageIndex + 1;
    if (nextIdx < cursorHistory.length) {
      setCurrentPageIndex(nextIdx);
    } else {
      setCursorHistory([...cursorHistory, alertData.nextCursor]);
      setCurrentPageIndex(nextIdx);
    }
  };

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1);
    }
  };

  const items = alertData?.items ?? [];
  const totalCount = alertData?.totalCount ?? 0;
  const nextCursor = alertData?.nextCursor;

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-[#101214] text-[#E8ECEF] p-4 md:p-6 gap-4 select-none">
      {/* Top Intelligence Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-[20px] font-bold tracking-tight text-[#D7A84B] uppercase">
              ALERT_CENTER
            </h1>
            <span className="px-1.5 py-0.5 text-[9px] font-mono border border-[#30373D] bg-[#171A1D] text-[#929BA3] uppercase">
              TRIAGE QUEUE
            </span>
          </div>
          <p className="font-mono text-[11px] text-[#929BA3] mt-0.5">
            Real-time state transitions, rule evaluations, and evidence auditing
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRefresh}
            title="Refresh alerts"
            aria-label="Refresh alerts"
            className="h-8 px-3 border border-[#30373D] bg-[#171A1D] text-[#929BA3] hover:text-[#E8ECEF] hover:border-[#D7A84B] font-mono text-[11px] uppercase tracking-wider rounded-none flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            <span>REFRESH</span>
          </button>

          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={markAllReadMutation.isPending || (kpiData?.unreadCount ?? 0) === 0}
            className="h-8 px-3.5 border border-[#D7A84B] bg-[#D7A84B] text-[#101214] hover:brightness-110 disabled:opacity-40 disabled:pointer-events-none font-mono text-[11px] font-bold uppercase tracking-wider rounded-none flex items-center gap-1.5 transition-colors"
          >
            <span>✓</span>
            <span>MARK ALL READ</span>
          </button>
        </div>
      </div>

      {/* 5 KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 shrink-0">
        {/* Total Active */}
        <div className="bg-[#171A1D] border border-[#30373D] p-3 rounded-none flex flex-col justify-between">
          <div className="font-mono text-[10px] text-[#929BA3] uppercase tracking-wider">
            TOTAL ACTIVE
          </div>
          <div className="font-mono text-[22px] font-bold text-[#E8ECEF] mt-1">
            {isKpisLoading ? "—" : kpiData?.totalActive ?? 0}
          </div>
          <div className="font-mono text-[9px] text-[#929BA3]/70 uppercase mt-1">
            ALL EVALUATED EVENTS
          </div>
        </div>

        {/* Armed Wallets */}
        <div className="bg-[#171A1D] border border-[#30373D] p-3 rounded-none flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-[#929BA3] uppercase tracking-wider">
              ARMED WALLETS
            </span>
            <span className="w-2 h-2 bg-[#D7A84B] rounded-none shrink-0" />
          </div>
          <div className="font-mono text-[22px] font-bold text-[#D7A84B] mt-1">
            {isKpisLoading ? "—" : kpiData?.armedCount ?? 0}
          </div>
          <div className="font-mono text-[9px] text-[#D7A84B]/70 uppercase mt-1">
            ARMED STATE
          </div>
        </div>

        {/* Triggered Wallets */}
        <div className="bg-[#171A1D] border border-[#30373D] p-3 rounded-none flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-[#929BA3] uppercase tracking-wider">
              TRIGGERED WALLETS
            </span>
            <span className="w-2 h-2 bg-[#D87870] rounded-none shrink-0 animate-pulse" />
          </div>
          <div className="font-mono text-[22px] font-bold text-[#D87870] mt-1">
            {isKpisLoading ? "—" : kpiData?.triggeredCount ?? 0}
          </div>
          <div className="font-mono text-[9px] text-[#D87870]/70 uppercase mt-1">
            TRIGGERED STATE
          </div>
        </div>

        {/* Exit Risk */}
        <div className="bg-[#171A1D] border border-[#30373D] p-3 rounded-none flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-[#929BA3] uppercase tracking-wider">
              EXIT RISK WARNINGS
            </span>
            <span className="w-2 h-2 bg-[#E59866] rounded-none shrink-0" />
          </div>
          <div className="font-mono text-[22px] font-bold text-[#E59866] mt-1">
            {isKpisLoading ? "—" : kpiData?.exitRiskCount ?? 0}
          </div>
          <div className="font-mono text-[9px] text-[#E59866]/70 uppercase mt-1">
            C1–C4 ANNOTATIONS
          </div>
        </div>

        {/* Unread Alerts */}
        <div className="bg-[#171A1D] border border-[#30373D] p-3 rounded-none flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-[#929BA3] uppercase tracking-wider">
              UNREAD ALERTS
            </span>
            {(kpiData?.unreadCount ?? 0) > 0 && (
              <span className="px-1 text-[9px] font-mono bg-[#D7A84B] text-[#101214] font-bold">
                NEW
              </span>
            )}
          </div>
          <div className="font-mono text-[22px] font-bold text-[#E8ECEF] mt-1">
            {isKpisLoading ? "—" : kpiData?.unreadCount ?? 0}
          </div>
          <div className="font-mono text-[9px] text-[#929BA3]/70 uppercase mt-1">
            ACTION REQUIRED
          </div>
        </div>
      </div>

      {/* Multi-Dimensional Filter Bar */}
      <div className="shrink-0">
        <AlertFilters
          stateFilter={stateFilter}
          onStateFilterChange={handleStateFilterChange}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={handleCategoryFilterChange}
          search={search}
          onSearchChange={handleSearchChange}
          unreadOnly={unreadOnly}
          onUnreadOnlyChange={handleUnreadOnlyChange}
        />
      </div>

      {/* Alerts Table Workspace & Evidence Rail */}
      <AlertList
        alerts={items}
        isLoading={isAlertsLoading}
        selectedAlertId={selectedAlert?.id}
        onSelectAlert={setSelectedAlert}
        onAcknowledge={handleAcknowledge}
        isAcknowledging={acknowledgeMutation.isPending}
      />

      {/* Pagination Footer */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#171A1D] border border-[#30373D] shrink-0 font-mono text-[11px] text-[#929BA3]">
        <div>
          <span>Showing </span>
          <span className="font-bold text-[#E8ECEF]">{items.length}</span>
          <span> of </span>
          <span className="font-bold text-[#E8ECEF]">{totalCount}</span>
          <span> active alerts</span>
          {currentPageIndex > 0 && (
            <span className="ml-2 text-[#D7A84B]">(Page {currentPageIndex + 1})</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPageIndex === 0 || isAlertsLoading}
            className="h-7 px-3 border border-[#30373D] bg-[#121416] text-[#E8ECEF] hover:bg-[#1E2327] disabled:opacity-30 disabled:pointer-events-none rounded-none uppercase transition-colors"
          >
            ← PREV
          </button>
          <button
            type="button"
            onClick={handleNextPage}
            disabled={!nextCursor || isAlertsLoading}
            className="h-7 px-3 border border-[#30373D] bg-[#121416] text-[#E8ECEF] hover:bg-[#1E2327] disabled:opacity-30 disabled:pointer-events-none rounded-none uppercase transition-colors"
          >
            NEXT →
          </button>
        </div>
      </div>
    </div>
  );
}
