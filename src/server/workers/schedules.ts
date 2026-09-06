import type { Queue } from "bullmq";

export async function registerSchedules(queue: Queue, cadenceMinutes: number): Promise<void> {
  await queue.upsertJobScheduler("schedule.sync.tick", { every: cadenceMinutes * 60_000 }, { name: "schedule.sync.tick", data: {} });
}

export async function registerAlertSchedules(queue: Queue, cadenceMinutes: number): Promise<void> {
  await queue.upsertJobScheduler(
    "schedule.alert.evaluate",
    { every: cadenceMinutes * 60_000 },
    { name: "schedule.alert.evaluate", data: { mode: "INCREMENTAL" } }
  );
}
