interface QuotaMeterProps { provider: string; callsToday: number; dailyLimit: number | null; remainingToday: number | null; }

export function QuotaMeter({ provider, callsToday, dailyLimit, remainingToday }: QuotaMeterProps) {
  return <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-4"><span>{provider}</span><span className="text-slate-400">{callsToday.toLocaleString()} / {dailyLimit?.toLocaleString() ?? "unknown limit"} calls · {remainingToday?.toLocaleString() ?? "runtime probe required"} remaining</span></div>;
}
