"use client";

import { useState } from "react";

export function TimeCell({ timestamp, blockNumber }: { timestamp: string; blockNumber: string }) {
  const [showBlock, setShowBlock] = useState(false);
  const formatted = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(new Date(timestamp));
  return <button type="button" className="rounded px-1 text-left text-sm text-slate-400 underline decoration-slate-700 underline-offset-4 hover:text-slate-200" onClick={() => setShowBlock((current) => !current)} aria-label={showBlock ? "Show local time" : "Show block number"}>{showBlock ? `Block ${blockNumber}` : formatted}</button>;
}
