"use client";

import { useState } from "react";
import Link from "next/link";
import { QuotaMeter } from "@/components/shared/QuotaMeter";
import { StatusCard } from "@/components/shared/StatusCard";
import { trpc } from "@/lib/trpc/client";

export function HealthConsole({ timeZone }: { timeZone: string }) {
  const [timeMode, setTimeMode] = useState<"LOCAL" | "UTC" | "BLK">("LOCAL");
  const status = trpc.health.status.useQuery(undefined, { retry: false, refetchInterval: 30_000 });
  const quota = trpc.health.quota.useQuery(undefined, { retry: false, refetchInterval: 30_000 });
  const services = status.isError ? undefined : status.data;
  const providers = quota.isError ? undefined : quota.data?.providers;
  const queueCounts = Object.values(services?.queues ?? {});
  const waiting = queueCounts.reduce((sum, queue) => sum + (queue.waiting ?? 0), 0);
  const active = queueCounts.reduce((sum, queue) => sum + (queue.active ?? 0), 0);
  const failed = queueCounts.reduce((sum, queue) => sum + (queue.failed ?? 0), 0);
  const exhausted = providers?.filter((provider) => provider.remainingToday !== null && provider.remainingToday <= 0) ?? [];
  const loading = status.isPending || quota.isPending;
  const degraded = status.isError || quota.isError || services?.db === "down" || services?.redis === "down";
  const overall = loading ? "Checking" : degraded ? "Degraded" : exhausted.length ? "Quota exhausted" : "Operational";
  const checkedAt = status.dataUpdatedAt;
  const formatTime = (timestamp: number | Date) => new Intl.DateTimeFormat("en-GB", {
    timeZone: timeMode === "UTC" ? "UTC" : timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).format(timestamp);
  const time = timeMode === "BLK" ? "Block unavailable" : checkedAt ? formatTime(checkedAt) : "Awaiting snapshot";
  const refreshing = status.isFetching || quota.isFetching;

  return <main className="ops-console">
    <header className="ops-topbar">
      <div className="ops-breadcrumb"><span>Watchtower</span><span aria-hidden="true">/</span><strong>Health</strong></div>
      <div className="ops-toolbar">
        <div className="ops-segments" role="group" aria-label="Timestamp display">
          {(["LOCAL", "UTC", "BLK"] as const).map((mode) => <button type="button" key={mode} aria-pressed={timeMode === mode} onClick={() => setTimeMode(mode)}>{mode}</button>)}
        </div>
        <button type="button" className="ops-button" disabled={refreshing} onClick={() => { void status.refetch(); void quota.refetch(); }} aria-label="Refresh status"><span aria-hidden="true">↻</span> {refreshing ? "Checking…" : "Refresh"}</button>
      </div>
    </header>
    <div className="ops-workspace">
      <div className="ops-content">
        <div className="ops-page-heading"><div><p className="ops-eyebrow">Operations / 01</p><h1>System health</h1><p className="ops-description">Core infrastructure &amp; provider status</p></div><span role="status" className={`ops-badge ops-${degraded ? "danger" : loading ? "muted" : exhausted.length ? "amber" : "success"}`}><span aria-hidden="true">●</span> {overall}</span></div>
        <section aria-label="Service status">
          <h2 className="ops-section-title">Core infrastructure</h2>
          <div className="ops-status-grid" aria-busy={status.isPending}>
            <StatusCard label="PostgreSQL" value={services?.db ?? (status.isPending ? "checking" : "unknown")} detail={services?.db === "ok" ? "Database reachable" : services?.db === "down" ? "Database unreachable" : "Awaiting database status"} />
            <StatusCard label="Redis" value={services?.redis ?? (status.isPending ? "checking" : "unknown")} detail={services?.redis === "ok" ? "Connection available" : services?.redis === "down" ? "Connection unavailable" : "Awaiting connection status"} />
            <StatusCard label="BullMQ" value={queueCounts.length ? "ok" : status.isPending ? "checking" : "unknown"} detail={queueCounts.length ? `${waiting.toLocaleString("en-US")} waiting / ${active.toLocaleString("en-US")} active` : "Queue counts unavailable"} />
          </div>
          {status.isError && <div className="ops-notice ops-danger" role="alert"><strong>Infrastructure status unavailable</strong><p>Could not read the latest snapshot. Refresh to try again.</p></div>}
          {failed > 0 && <p className="ops-notice ops-amber">{failed.toLocaleString("en-US")} failed jobs recorded. Inspect queues in Bull Board.</p>}
        </section>
        <section aria-labelledby="quota-heading" aria-busy={quota.isPending}>
          <div className="ops-section-heading"><h2 id="quota-heading" className="ops-section-title">Provider quota</h2><span className="ops-mono ops-muted">24H / UTC</span></div>
          <table className="ops-table ops-provider-table"><caption className="ops-sr-only">Daily provider usage and rate limit events</caption><thead><tr><th scope="col">Provider</th><th scope="col">Calls today</th><th scope="col">Daily limit</th><th scope="col">Limit events</th><th scope="col">Remaining</th></tr></thead><tbody>
            {providers?.map((provider) => <QuotaMeter key={provider.provider} {...provider} />)}
            {quota.isPending && [0, 1, 2].map((row) => <tr key={row} aria-hidden="true"><td colSpan={5}><div className="ops-skeleton" /></td></tr>)}
          </tbody></table>
          {quota.isPending && <p className="ops-note" role="status">Loading provider usage…</p>}
          {quota.isError && <div className="ops-notice ops-danger" role="alert"><strong>Provider usage unavailable</strong><p>Quota could not be retrieved. Infrastructure status is shown independently; refresh to try again.</p></div>}
          {providers?.length === 0 && <p className="ops-notice">No enabled providers in this snapshot.</p>}
          {exhausted.map((provider) => <div className="ops-notice ops-amber" key={provider.provider}><strong>{provider.provider}: daily quota exhausted</strong><p>Wait for the next budget window. Resets {formatTime(provider.windowResetsAt)} ({timeMode === "UTC" ? "UTC" : timeZone}).</p></div>)}
          <p className="ops-note">Unknown limits remain unestimated. Limit events are recorded events today, not a live provider availability check.</p>
        </section>
        <footer className="ops-content-footer"><span>Local runtime observation</span><span>Refreshes every 30s</span></footer>
      </div>
      <aside className="ops-evidence" aria-label="System metadata">
        <h2 className="ops-rail-title">System metadata</h2>
        <div className="ops-rail-content">
          <div><h3 className="ops-section-title">Migration version</h3><p className="ops-value ops-mono">{services?.migration ?? "Unavailable"}</p></div>
          <div><h3 className="ops-section-title">Last checked</h3><button type="button" className="ops-time ops-mono" aria-label={timeMode === "BLK" ? "Show local time" : "Show block number"} onClick={() => setTimeMode(timeMode === "BLK" ? "LOCAL" : "BLK")}>{time}</button><p className="ops-note">{timeMode === "BLK" ? "Health snapshots have no chain block." : timeMode === "UTC" ? "UTC" : timeZone}</p></div>
          <div><h3 className="ops-section-title">Queue registry</h3><p className="ops-mono">{services ? `${queueCounts.length} queues reporting` : "Unavailable"}</p></div>
          <div className="ops-rail-tools"><h3 className="ops-section-title">Tools</h3><Link className="ops-tool-link" href="/api/bull-board"><span>Bull Board (Local)</span><span aria-hidden="true">↗</span></Link><p className="ops-note">Inspect waiting, active and failed jobs. Loopback access only.</p></div>
        </div>
      </aside>
    </div>
  </main>;
}
