import { describe, expect, it } from "vitest";

import { FakeClock } from "@/../tests/helpers/clock";
import { createHttpStub } from "@/../tests/helpers/http-stub";

describe("test harness", () => {
  it("advances FakeClock deterministically", () => {
    const clock = new FakeClock(new Date("2026-01-01T00:00:00Z"));
    clock.advanceMs(60_000);
    expect(clock.now().toISOString()).toBe("2026-01-01T00:01:00.000Z");
  });

  it("rejects unexpected outbound requests", async () => {
    const stub = createHttpStub({ "https://known.test": { status: 200, body: {} } });
    await expect(stub.fetcher("https://unknown.test")).rejects.toThrow("Unexpected outbound request");
  });
});
