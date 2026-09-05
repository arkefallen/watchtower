import type { IncomingHttpHeaders } from "node:http";

import type { RateLimiterSnapshot } from "@/lib/ratelimit";
import type { SettingsSnapshot } from "@/lib/settings-schema";

export interface HealthDependencies {
  db: { query: () => Promise<void> };
  redis: { ping: () => Promise<string> };
  queues: Record<string, { getJobCounts: (...types: string[]) => Promise<Record<string, number>> }>;
  settings: { loadSettings: () => Promise<SettingsSnapshot> };
  quotas: () => Promise<RateLimiterSnapshot[]>;
  migration: string;
}
export interface JobDependencies { enqueueNoop: (requestId: string) => Promise<{ jobId: string }>; }

import type { PrismaClient } from "@/generated/prisma/client";

export interface TRPCContext {
  headers: IncomingHttpHeaders;
  health: HealthDependencies;
  jobs: JobDependencies;
  clock: { now: () => Date };
  prisma?: PrismaClient;
  queues?: any;
}

export function createContext(input: {
  headers?: IncomingHttpHeaders;
  health: HealthDependencies;
  jobs?: JobDependencies;
  clock?: { now: () => Date };
  prisma?: PrismaClient;
  queues?: any;
}): TRPCContext {
  return {
    headers: input.headers ?? {},
    health: input.health,
    jobs: input.jobs ?? { enqueueNoop: async () => { throw new Error("Job dependencies not wired"); } },
    clock: input.clock ?? { now: () => new Date() },
    prisma: input.prisma,
    queues: input.queues,
  };
}
