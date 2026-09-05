export type UsageOutcome = "ok" | "error" | "rate_limited";

export interface UsageDelegate {
  upsert: (args: {
    where: { provider_day: { provider: string; day: Date } };
    create: { provider: string; day: Date; callCount: number; errorCount: number; rateLimitHits: number; recordsFetched: number };
    update: { callCount: { increment: number }; errorCount: { increment: number }; rateLimitHits: { increment: number }; recordsFetched: { increment: number } };
  }) => Promise<unknown>;
}

function utcDay(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function createUsageRecorder(delegate: UsageDelegate) {
  return {
    async record(provider: string, outcome: UsageOutcome, records: number): Promise<void> {
      await delegate.upsert({
        where: { provider_day: { provider, day: utcDay() } },
        create: {
          provider,
          day: utcDay(),
          callCount: 1,
          errorCount: outcome === "error" ? 1 : 0,
          rateLimitHits: outcome === "rate_limited" ? 1 : 0,
          recordsFetched: records,
        },
        update: {
          callCount: { increment: 1 },
          errorCount: { increment: outcome === "error" ? 1 : 0 },
          rateLimitHits: { increment: outcome === "rate_limited" ? 1 : 0 },
          recordsFetched: { increment: records },
        },
      });
    },
  };
}
