import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { RateLimiterSnapshot } from "@/lib/ratelimit";
import { createContext } from "@/server/trpc/context";
import { appRouter } from "@/server/trpc/root";

type Runtime = Awaited<ReturnType<typeof createRuntime>>;
let runtimePromise: Promise<Runtime> | undefined;

async function createRuntime() {
  const [{ prisma }, { createQueues }, { loadEnv }, { loadSettings }] = await Promise.all([
    import("@/server/db/client"), import("@/server/workers/queues"), import("@/lib/env"), import("@/server/services/settings"),
  ]);
  const env = loadEnv();
  const queues = createQueues(env.REDIS_URL);
  const day = new Date(); day.setUTCHours(0, 0, 0, 0);
  const quotas = async (): Promise<RateLimiterSnapshot[]> => {
    const rows = await prisma.apiUsageDaily.findMany({ where: { day } });
    const providers = ["etherscan", ...(env.ALCHEMY_API_KEY ? ["alchemy-robinhood"] : []), ...(env.BLOCKSCOUT_API_KEY ? ["blockscout-robinhood"] : []), ...(env.DEXSCREENER_ENABLED ? ["dexscreener"] : [])];
    return providers.map((provider) => {
      const row = rows.find((item) => item.provider === provider); const dailyLimit = provider === "etherscan" ? 100000 : provider === "dexscreener" ? 20000 : null;
      return { provider, tokensAvailable: 0, refillPerSecond: provider === "dexscreener" ? 3 : 4, callsToday: row?.callCount ?? 0, dailyLimit, remainingToday: dailyLimit === null ? null : Math.max(0, dailyLimit - (row?.callCount ?? 0)), rateLimitHitsToday: row?.rateLimitHits ?? 0, windowResetsAt: new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + 1)) };
    });
  };
  const queueHealth = Object.fromEntries(Object.entries(queues.queues).map(([name, queue]) => [name, { getJobCounts: (...types: string[]) => queue.getJobCounts(...types as Array<"active" | "completed" | "delayed" | "failed" | "paused" | "prioritized" | "waiting" | "waiting-children">) }]));
  const enqueueNoop = async (requestId: string): Promise<{ jobId: string }> => {
    const jobId = `noop:${requestId}`;
    await queues.queues.intake.add("noop", {}, { jobId });
    await prisma.jobRun.upsert({ where: { id: jobId }, create: { id: jobId, queueName: "watchtower.intake", jobName: "noop", payloadJson: {}, status: "QUEUED" }, update: {} });
    return { jobId };
  };
  return { prisma, queues, loadSettings, quotas, queueHealth, enqueueNoop };
}

async function getRuntime(): Promise<Runtime> {
  runtimePromise ??= createRuntime();
  return runtimePromise;
}

const handler = (request: Request) => fetchRequestHandler({ endpoint: "/api/trpc", req: request, router: appRouter, createContext: async () => {
  const runtime = await getRuntime();
  return createContext({
    health: { db: { query: async () => { await runtime.prisma.setting.count(); } }, redis: { ping: () => runtime.queues.connection.ping() }, queues: runtime.queueHealth, settings: { loadSettings: runtime.loadSettings }, quotas: runtime.quotas, migration: "0001_phase0_initial" },
    jobs: { enqueueNoop: runtime.enqueueNoop },
    prisma: runtime.prisma,
    queues: runtime.queues.queues,
  });
} });
export { handler as GET, handler as POST };
