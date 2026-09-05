import { NextResponse } from "next/server";

import { loadEnv } from "@/lib/env";
import { QUEUES } from "@/lib/queue/contracts";
import { createQueues, type QueueRegistry } from "@/server/workers/queues";

let registryPromise: Promise<QueueRegistry> | undefined;

function isLoopback(request: Request): boolean {
  const forwarded = request.headers.get("x-watchtower-client-ip");
  if (forwarded) return forwarded === "127.0.0.1" || forwarded === "::1" || forwarded === "localhost";
  const host = request.headers.get("host") ?? "";
  return host.startsWith("127.0.0.1:") || host.startsWith("localhost:") || host.startsWith("[::1]:");
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function getRegistry(): Promise<QueueRegistry> {
  registryPromise ??= Promise.resolve(createQueues(loadEnv().REDIS_URL));
  return registryPromise;
}

export async function GET(request: Request): Promise<Response> {
  if (!isLoopback(request)) return NextResponse.json({ error: "Bull Board is loopback-only" }, { status: 403 });
  try {
    const { queues } = await getRegistry();
    const rows = await Promise.all(Object.entries(QUEUES).map(async ([key, name]) => {
      const queue = queues[key as keyof typeof queues];
      const counts = await queue.getJobCounts("waiting", "active", "completed", "failed", "delayed", "paused");
      return `<tr><th scope="row">${escapeHtml(name)}</th>${["waiting", "active", "completed", "failed", "delayed", "paused"].map((state) => `<td data-label="${state}"${state === "failed" && counts[state] > 0 ? ' class="ops-danger"' : ""}>${(counts[state] ?? 0).toLocaleString("en-US")}</td>`).join("")}</tr>`;
    }));
    const checkedAt = new Date().toISOString();
    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bull Board · Watchtower</title>
<link rel="stylesheet" href="/watchtower-operations.css"></head>
<body class="ops-board">
  <aside class="ops-board-nav"><a class="ops-brand" href="/health">WATCHTOWER</a><p class="ops-brand-note ops-mono">ONCHAIN INTELLIGENCE</p><nav aria-label="Operations navigation"><a href="/health">System health</a><a href="/api/bull-board" aria-current="page">Bull Board</a></nav></aside>
  <main class="ops-console">
    <header class="ops-topbar"><div class="ops-breadcrumb"><a href="/health">Watchtower</a><span aria-hidden="true">/</span><strong>Bull Board</strong></div><a class="ops-button" href="/api/bull-board"><span aria-hidden="true">↻</span> Refresh queues</a></header>
    <div class="ops-workspace"><div class="ops-content">
      <div class="ops-page-heading"><div><p class="ops-eyebrow">Operations / 02</p><h1>Bull Board</h1><p class="ops-description">Queue activity &amp; worker backlog</p></div><span class="ops-badge ops-amber"><span aria-hidden="true">●</span> Loopback only</span></div>
      <section aria-labelledby="queues-heading"><div class="ops-section-heading"><h2 class="ops-section-title" id="queues-heading">Queue overview</h2><span class="ops-mono ops-muted">${rows.length} QUEUES</span></div>
        <table class="ops-table"><caption class="ops-sr-only">Local queue counts by job state</caption><thead><tr><th scope="col">Queue</th><th scope="col">Waiting</th><th scope="col">Active</th><th scope="col">Completed</th><th scope="col">Failed</th><th scope="col">Delayed</th><th scope="col">Paused</th></tr></thead><tbody>${rows.join("")}</tbody></table>
        <p class="ops-note">Counts reflect this snapshot. Refresh to read the latest queue state.</p>
      </section><footer class="ops-content-footer"><span>Local runtime observation</span><span>Read-only queue inspection</span></footer>
    </div><aside class="ops-evidence" aria-label="Queue metadata"><h2 class="ops-rail-title">Queue metadata</h2><div class="ops-rail-content">
      <div><h3 class="ops-section-title">Access boundary</h3><p class="ops-value ops-mono">LOCAL / LOOPBACK</p><p class="ops-note">This page is loopback-only.</p></div>
      <div><h3 class="ops-section-title">Last checked · UTC</h3><p class="ops-value ops-mono"><time datetime="${checkedAt}">${checkedAt.replace("T", " ").slice(0, 19)} UTC</time></p></div>
      <div class="ops-rail-tools"><h3 class="ops-section-title">Tools</h3><a class="ops-tool-link" href="/health"><span>Back to system health</span><span aria-hidden="true">↗</span></a><p class="ops-note">Review infrastructure and provider usage.</p></div>
    </div></aside></div>
  </main>
</body></html>`;
    return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Bull Board unavailable" }, { status: 503 });
  }
}
