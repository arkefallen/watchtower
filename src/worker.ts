import { loadEnv } from "./lib/env";
import { createWorkers } from "./server/workers/main";
import { createQueues } from "./server/workers/queues";
import { attachJobRunProjection } from "./server/workers/job-run-projection";
import { prisma } from "./server/db/client";

process.env.NEXT_TELEMETRY_DISABLED ??= "1";
const env = loadEnv();
const workers = createWorkers({ url: env.REDIS_URL });
const queueRuntime = createQueues(env.REDIS_URL);
for (const events of Object.values(queueRuntime.events)) attachJobRunProjection(events, {
  upsert: (args) => prisma.jobRun.upsert(args as Parameters<typeof prisma.jobRun.upsert>[0]),
});
const heartbeat = setInterval(() => undefined, 30_000);

async function shutdown(): Promise<void> {
  clearInterval(heartbeat);
  await Promise.all(workers.map((worker) => worker.close()));
  await Promise.all(Object.values(queueRuntime.events).map((events) => events.close()));
  await queueRuntime.connection.quit();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => { void shutdown(); });
process.on("SIGTERM", () => { void shutdown(); });
