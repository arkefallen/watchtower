import { Queue, QueueEvents, type JobsOptions } from "bullmq";
import Redis from "ioredis";

import { QUEUES } from "../../lib/queue/contracts";

export const DEFAULT_JOB_OPTIONS: JobsOptions = { attempts: 3, backoff: { type: "exponential", delay: 1000 }, removeOnComplete: false, removeOnFail: false };

export function createQueues(redisUrl: string) {
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const queues = Object.fromEntries(Object.entries(QUEUES).map(([key, name]) => [key, new Queue(name, { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS })])) as { [K in keyof typeof QUEUES]: Queue };
  const events = Object.fromEntries(Object.values(QUEUES).map((name) => [name, new QueueEvents(name, { connection })])) as Record<string, QueueEvents>;
  return { connection, queues, events };
}

export type QueueRegistry = ReturnType<typeof createQueues>;
