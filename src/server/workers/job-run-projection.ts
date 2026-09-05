import type { Job, QueueEvents } from "bullmq";

export interface JobRunProjectionStore {
  upsert: (args: { where: { id: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown>;
}

export function attachJobRunProjection(events: QueueEvents, store: JobRunProjectionStore): void {
  const update = (jobId: string, status: string, extra: Record<string, unknown> = {}) => store.upsert({ where: { id: jobId }, create: { id: jobId, status, queueName: events.name, jobName: "unknown", payloadJson: {}, ...extra }, update: { status, ...extra } }).catch(() => undefined);
  events.on("active", ({ jobId }) => { void update(jobId, "RUNNING"); });
  events.on("completed", ({ jobId }) => { void update(jobId, "COMPLETED", { progressPct: 100 }); });
  events.on("failed", ({ jobId, failedReason }) => { void update(jobId, "FAILED", { error: failedReason }); });
}

export function deterministicJobId(prefix: string, parts: string[]): string { return `${prefix}:${parts.join(":")}`; }

export function jobIdOf(job: Pick<Job, "id">): string { return String(job.id); }
