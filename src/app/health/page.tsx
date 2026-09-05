import { QuotaMeter } from "@/components/shared/QuotaMeter";
import { StatusCard } from "@/components/shared/StatusCard";
import { TimeCell } from "@/components/shared/TimeCell";
import Link from "next/link";

interface HealthResponse {
  status: string;
  db: string;
  redis: string;
  migration: string;
  quota: Array<{ provider: string; callsToday: number; dailyLimit: number | null; remainingToday: number | null }>;
}

async function getHealth(): Promise<HealthResponse | null> {
  const response = await fetch("http://127.0.0.1:3000/api/health", { cache: "no-store" }).catch(() => null);
  return response ? response.json() as Promise<HealthResponse> : null;
}

export default async function HealthPage() {
  const health = await getHealth();
  const state = health?.status ?? "down";
  return <main className="min-h-screen bg-slate-950 p-8 text-slate-100">
    <header className="mb-8"><p className="text-xs uppercase tracking-[0.25em] text-cyan-400">Watchtower / Operations</p><h1 className="mt-2 text-3xl font-semibold">System health</h1><p className="mt-2 text-slate-400">Local service status and provider quota.</p></header>
    <section className="grid gap-4 md:grid-cols-3" aria-label="Service status"><StatusCard label="Overall" value={state} /><StatusCard label="PostgreSQL" value={health?.db ?? "down"} /><StatusCard label="Redis" value={health?.redis ?? "down"} /></section>
    <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6"><h2 className="text-lg font-medium">Provider quota</h2>{health?.quota.map((item) => <QuotaMeter key={item.provider} {...item} />)}</section>
    <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6"><h2 className="text-lg font-medium">Last checked</h2><TimeCell timestamp={new Date().toISOString()} blockNumber="latest" /></section>
    <p className="mt-6 text-sm text-slate-500">Migration: {health?.migration ?? "unavailable"}</p>
    <Link className="mt-3 inline-block text-sm text-cyan-400 underline" href="/api/bull-board">Open Bull Board</Link>
  </main>;
}
