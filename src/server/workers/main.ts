import { Worker, type ConnectionOptions, type Job } from "bullmq";

import { QUEUES, type JobProgress } from "../../lib/queue/contracts";
import { reportProgress } from "../../lib/queue/progress";

export function createWorkers(connection: ConnectionOptions, handler?: (job: Job) => Promise<unknown>) {
  const process = handler ?? (async (job: Job) => {
    await reportProgress(job, { pct: 100, stage: "done", message: "Completed" });
    return { ok: true };
  });
  return Object.values(QUEUES).map((name) => new Worker(name, process, { connection, concurrency: name === QUEUES.intake ? 2 : 1 }));
}

export type WorkerProgress = JobProgress;
