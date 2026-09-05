import type { JobProgress } from "./contracts";

export function clampProgress(progress: JobProgress, previous = 0): JobProgress {
  return { ...progress, pct: Math.min(100, Math.max(previous, Math.max(0, progress.pct))) };
}

export async function reportProgress(job: { updateProgress: (value: JobProgress) => Promise<void> }, progress: JobProgress, previous = 0): Promise<JobProgress> {
  const next = clampProgress(progress, previous);
  await job.updateProgress(next);
  return next;
}
