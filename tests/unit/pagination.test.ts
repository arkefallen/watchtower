import { describe, expect, it } from "vitest";

import { fetchAllPages } from "@/lib/etherscan/pagination";

type Row = { id: number; block: bigint };

const fixture: Row[] = Array.from({ length: 2500 }, (_, index) => ({
  id: index,
  block: index < 800 ? 1n : index < 1600 ? 2n : 3n,
}));

async function run(maxRecords?: number) {
  return fetchAllPages<Row>(
    { fromBlock: 1n, toBlock: 3n, priority: "BACKGROUND" },
    { endpoint: "NORMAL_TX", pageCap: 1000, maxRecords, blockOf: (row) => row.block },
    async ({ page, fromBlock, toBlock }) => fixture.filter((row) => row.block >= fromBlock && row.block <= toBlock).slice((page - 1) * 1000, page * 1000),
  );
}

describe("Etherscan pagination walker", () => {
  it("re-windows full pages without dropping or duplicating boundary records", async () => {
    const result = await run();
    expect(result.rows).toHaveLength(2500);
    expect(new Set(result.rows.map((row) => row.id)).size).toBe(2500);
    expect(result.pages.length).toBeGreaterThanOrEqual(3);
    expect(result.coveredThroughBlock).toBe(3n);
  });

  it("holds back coverage when maxRecords truncates the walk", async () => {
    const result = await run(1000);
    expect(result.rows).toHaveLength(1000);
    expect(result.truncated).toBe(true);
    expect(result.coveredThroughBlock).toBeLessThan(3n);
  });

  it("stops immediately on an aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await fetchAllPages(
      { fromBlock: 1n, toBlock: 3n, priority: "BACKGROUND", signal: controller.signal },
      { endpoint: "NORMAL_TX", pageCap: 1000, blockOf: (row: Row) => row.block },
      async () => fixture,
    );
    expect(result.truncated).toBe(true);
    expect(result.callsSpent).toBe(0);
  });
});
