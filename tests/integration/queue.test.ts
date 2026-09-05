import Redis from "ioredis";
import { describe, expect, it } from "vitest";
import { Queue } from "bullmq";

const redisUrl = process.env.REDIS_URL;

describe.skipIf(!redisUrl)("BullMQ integration", () => {
  it("deduplicates the same deterministic job ID", async () => {
    const connection = new Redis(redisUrl as string, { maxRetriesPerRequest: null });
    const queue = new Queue(`test.queue.${Date.now()}`, { connection });
    await queue.add("noop", {}, { jobId: "noop:test:1" });
    await queue.add("noop", {}, { jobId: "noop:test:1" });
    expect(await queue.getJobCountByTypes("waiting", "prioritized", "delayed")).toBe(1);
    await queue.obliterate({ force: true });
    await queue.close();
    await connection.quit();
  });
});
