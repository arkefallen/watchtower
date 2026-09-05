import type { Job } from "bullmq";
import { prisma as defaultPrisma } from "@/server/db/client";
import { processImportBatch } from "@/server/services/wallet/import";

export interface WalletImportBatchPayload {
  rawText: string;
  defaultChain?: string;
  batchId?: string;
}

export async function processWalletImportBatchJob(job: Job<WalletImportBatchPayload>) {
  const { rawText, defaultChain = "base", batchId = String(job.id) } = job.data;

  await job.updateProgress({
    pct: 10,
    stage: "parse",
    message: "Parsing import batch entries",
  });

  const result = await processImportBatch(rawText, {
    prisma: defaultPrisma,
    defaultChain,
    batchId,
  });

  await job.updateProgress({
    pct: 100,
    stage: "done",
    message: `Batch import completed: ${result.accepted} accepted (${result.existing} existing), ${result.duplicates} duplicates, ${result.invalid} invalid`,
    counters: {
      accepted: result.accepted,
      existing: result.existing,
      duplicates: result.duplicates,
      invalid: result.invalid,
    },
  });

  return result;
}
