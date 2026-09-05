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
      return `<tr><th scope="row">${escapeHtml(name)}</th><td>${counts.waiting}</td><td>${counts.active}</td><td>${counts.completed}</td><td>${counts.failed}</td><td>${counts.delayed}</td><td>${counts.paused}</td></tr>`;
    }));
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bull Board · Watchtower</title><style>body{margin:0;padding:32px;background:#0b0d0f;color:#e5e7e6;font:14px system-ui,sans-serif}main{max-width:1100px;margin:auto}h1{color:#67e8f9}table{width:100%;border-collapse:collapse;background:#111827}th,td{padding:12px;border:1px solid #273244;text-align:right}th:first-child,td:first-child{text-align:left}thead{color:#94a3b8}</style></head><body><main><p>WATCHTOWER / OPERATIONS</p><h1>Bull Board</h1><p>Local queue state. This page is loopback-only.</p><table><thead><tr><th scope="col">Queue</th><th scope="col">Waiting</th><th scope="col">Active</th><th scope="col">Completed</th><th scope="col">Failed</th><th scope="col">Delayed</th><th scope="col">Paused</th></tr></thead><tbody>${rows.join("")}</tbody></table></main></body></html>`;
    return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Bull Board unavailable" }, { status: 503 });
  }
}
