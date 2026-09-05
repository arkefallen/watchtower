interface QuotaMeterProps {
  provider: string;
  callsToday: number;
  dailyLimit: number | null;
  remainingToday: number | null;
  rateLimitHitsToday: number;
}

export function QuotaMeter({ provider, callsToday, dailyLimit, remainingToday, rateLimitHitsToday }: QuotaMeterProps) {
  const exhausted = remainingToday !== null && remainingToday <= 0;
  const hasEvents = rateLimitHitsToday > 0;
  const state = exhausted ? "RATE LIMITED" : hasEvents ? "LIMIT EVENTS" : "NO LIMIT EVENTS";
  return <tr className={exhausted ? "ops-row-warning" : undefined}>
    <th scope="row"><span>{provider}</span><span className={`ops-provider-state ops-badge ops-${exhausted || hasEvents ? "amber" : "success"}`}><span aria-hidden="true">●</span> {state}</span></th>
    <td data-label="Calls today">{callsToday.toLocaleString("en-US")}</td>
    <td data-label="Daily limit">{dailyLimit?.toLocaleString("en-US") ?? <span className="ops-muted">UNKNOWN</span>}</td>
    <td data-label="Limit events" className={hasEvents ? "ops-amber" : "ops-muted"}>{rateLimitHitsToday.toLocaleString("en-US")}</td>
    <td data-label="Remaining" className={exhausted ? "ops-amber" : undefined}>{remainingToday?.toLocaleString("en-US") ?? <span className="ops-muted">UNKNOWN</span>}</td>
  </tr>;
}
