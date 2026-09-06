// src/server/workers/processors/alert-evaluate.ts
import type { Job } from "bullmq";
import { prisma as defaultPrisma } from "@/server/db/client";
import type { PrismaClient, AlertType } from "@/generated/prisma/client";
import type { Address, ChainSlug } from "@/lib/chains/types";
import { evaluateAlerts } from "@/server/services/alert/evaluate";
import type { AlertEvaluateResult } from "@/lib/rules/types";

export interface AlertEvaluateJobPayload {
  mode: "INCREMENTAL" | "BACKFILL";
  address?: Address;
  chain?: ChainSlug;
  from?: string | Date;
  to?: string | Date;
  rules?: AlertType[];
}

/**
 * BullMQ worker processor for the `alert.evaluate` queue.
 * Runs at concurrency 1 to ensure race-free alert evaluation.
 */
export async function processAlertEvaluateJob(
  job: Job<AlertEvaluateJobPayload>,
  injectedPrisma?: PrismaClient
): Promise<AlertEvaluateResult> {
  const { mode, address, chain, from, to, rules } = job.data;
  const prisma = injectedPrisma ?? defaultPrisma;

  const result = await evaluateAlerts({
    mode,
    scope: address ? { address, chain } : undefined,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    rules,
    prisma,
    onProgress: async (p) => {
      if (typeof job.updateProgress === "function") {
        await job.updateProgress(p.percent);
      }
    },
  });

  return result;
}
