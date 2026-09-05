import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

import { recordFixture } from "../../scripts/record-fixtures";

describe("fixture recorder", () => {
  it("captures an HTTPS response without persisting the request URL", async () => {
    const directory = await mkdtemp(`${tmpdir()}/watchtower-fixture-`);
    try {
      const destination = `${directory}/response.json`;
      await recordFixture({
        url: "https://api.example.test/v2/api?apikey=secret",
        destination,
        now: new Date("2026-01-01T00:00:00.000Z"),
        fetcher: async () => new Response(JSON.stringify({ result: "ok" }), { status: 200 }),
      });
      const saved = await readFile(destination, "utf8");
      expect(saved).toContain('"result": "ok"');
      expect(saved).not.toContain("apikey");
      expect(saved).not.toContain("secret");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects non-HTTPS endpoints before making a request", async () => {
    let calls = 0;
    await expect(recordFixture({ url: "http://localhost/api", destination: "ignored.json", fetcher: async () => { calls += 1; return new Response("{}"); } })).rejects.toThrow("HTTPS");
    expect(calls).toBe(0);
  });
});
