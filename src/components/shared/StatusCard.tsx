interface StatusCardProps { label: string; value: string; detail?: string; }

export function StatusCard({ label, value, detail }: StatusCardProps) {
  const tone = value === "ok" ? "success" : value === "down" ? "danger" : "muted";
  return <div className="ops-status-card">
    <div className="ops-card-heading"><h3>{label}</h3><span className={`ops-badge ops-${tone}`}><span aria-hidden="true">●</span> {value}</span></div>
    <p className="ops-mono ops-muted">{detail ?? "Status unavailable"}</p>
  </div>;
}
