import { describe, expect, it } from "vitest";
import { PassThrough } from "node:stream";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { runBackup, type DumpProcess } from "../../scripts/backup";
import { assertRestoreConfirmed } from "../../scripts/restore";

describe("backup and restore safety", () => {
  it("refuses restore without --confirm before inspecting or mutating the database", async () => {
    expect(() => assertRestoreConfirmed([])).toThrow("Restore requires --confirm");
  });

  it("writes a readable gzip and metadata only after pg_dump succeeds", async () => {
    const directory = await mkdtemp(`${tmpdir()}/watchtower-backup-`);
    try {
      const spawnProcess = (): DumpProcess => {
        const stdout = new PassThrough();
        const stderr = new PassThrough();
        const process = new PassThrough() as PassThrough & DumpProcess;
        Object.defineProperty(process, "stdout", { value: stdout });
        Object.defineProperty(process, "stderr", { value: stderr });
        queueMicrotask(() => { stdout.end("CREATE TABLE test (id integer);\n"); process.emit("close", 0); });
        return process;
      };
      const output = await runBackup({ databaseUrl: "postgresql://test", backupDirectory: directory, now: new Date("2026-01-01T00:00:00.000Z"), spawnProcess });
      expect((await readFile(output)).length).toBeGreaterThan(0);
      expect(JSON.parse(await readFile(`${output}.json`, "utf8"))).toMatchObject({ format: "plain-sql-gzip" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("fails when pg_dump exits non-zero", async () => {
    const directory = await mkdtemp(`${tmpdir()}/watchtower-backup-`);
    try {
      const spawnProcess = (): DumpProcess => {
        const stdout = new PassThrough();
        const stderr = new PassThrough();
        const process = new PassThrough() as PassThrough & DumpProcess;
        Object.defineProperty(process, "stdout", { value: stdout });
        Object.defineProperty(process, "stderr", { value: stderr });
        queueMicrotask(() => { stderr.end("permission denied"); stdout.end(); process.emit("close", 1); });
        return process;
      };
      await expect(runBackup({ databaseUrl: "postgresql://test", backupDirectory: directory, spawnProcess })).rejects.toThrow("pg_dump failed");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
