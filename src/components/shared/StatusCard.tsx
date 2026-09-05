interface StatusCardProps { label: string; value: string; }

export function StatusCard({ label, value }: StatusCardProps) {
  const healthy = value === "ok";
  return <div className="rounded-xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">{label}</p><p className={`mt-3 text-xl font-semibold ${healthy ? "text-emerald-400" : "text-amber-400"}`}><span aria-hidden="true">●</span> <span className="capitalize">{value}</span></p></div>;
}
