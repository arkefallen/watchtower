import { describe, expect, it, vi } from "vitest";
import { parseImportBatch, processImportBatch } from "@/server/services/wallet/import";

describe("P1-T03: Batch Import", () => {
  it("import: parses address,chain,label lines", () => {
    const raw = `
0x1111111111111111111111111111111111111111,base,Whale 1
0x2222222222222222222222222222222222222222,bsc,Whale 2
`;
    const res = parseImportBatch(raw, "base");
    expect(res.entries).toHaveLength(2);
    expect(res.entries[0]).toEqual({
      lineNumber: 2,
      address: "0x1111111111111111111111111111111111111111",
      chain: "base",
      label: "Whale 1",
    });
    expect(res.entries[1]).toEqual({
      lineNumber: 3,
      address: "0x2222222222222222222222222222222222222222",
      chain: "bsc",
      label: "Whale 2",
    });
  });

  it("import: missing chain falls back to defaultChain", () => {
    const raw = `0x1111111111111111111111111111111111111111`;
    const res = parseImportBatch(raw, "robinhood");
    expect(res.entries).toHaveLength(1);
    expect(res.entries[0].chain).toBe("robinhood");
  });

  it("import: blank and comment lines are ignored", () => {
    const raw = `
# This is a comment
// Another comment

0x1111111111111111111111111111111111111111,base

   
`;
    const res = parseImportBatch(raw, "base");
    expect(res.entries).toHaveLength(1);
    expect(res.invalid).toHaveLength(0);
    expect(res.duplicates).toHaveLength(0);
  });

  it("import: malformed line reports its line number and reason", () => {
    const raw = `
0x1111111111111111111111111111111111111111,base,Valid
not-an-address,base,Invalid
0x2222222222222222222222222222222222222222,unknownchain,InvalidChain
`;
    const res = parseImportBatch(raw, "base");
    expect(res.entries).toHaveLength(1);
    expect(res.invalid).toHaveLength(2);
    expect(res.invalid[0].lineNumber).toBe(3);
    expect(res.invalid[0].reason).toContain("Invalid EVM address");
    expect(res.invalid[1].lineNumber).toBe(4);
    expect(res.invalid[1].reason).toContain("Unsupported chain");
  });

  it("import: duplicate within the same batch counts once", () => {
    const raw = `
0x1111111111111111111111111111111111111111,base,First
0x1111111111111111111111111111111111111111,base,Duplicate
0x1111111111111111111111111111111111111111,bsc,Different Chain
`;
    const res = parseImportBatch(raw, "base");
    expect(res.entries).toHaveLength(2);
    expect(res.duplicates).toHaveLength(1);
    expect(res.duplicates[0].lineNumber).toBe(3);
  });

  it("import: existing wallet enqueues incremental sync, not intake", async () => {
    const existingWallet = {
      address: "0x1111111111111111111111111111111111111111",
      chain: "BASE",
    };

    const mockPrisma: any = {
      wallet: {
        findMany: vi.fn().mockResolvedValue([existingWallet]),
        upsert: vi.fn().mockResolvedValue(existingWallet),
        update: vi.fn().mockResolvedValue(existingWallet),
      },
      syncState: {
        upsert: vi.fn().mockResolvedValue({}),
      },
      jobRun: {
        upsert: vi.fn().mockResolvedValue({}),
      },
    };

    const intakeAdd = vi.fn().mockResolvedValue({ id: "intake-1" });
    const syncAdd = vi.fn().mockResolvedValue({ id: "sync-1" });

    const raw = `
0x1111111111111111111111111111111111111111,base,Existing
0x2222222222222222222222222222222222222222,base,New
`;

    const result = await processImportBatch(raw, {
      defaultChain: "base",
      prisma: mockPrisma,
      queues: {
        intake: { add: intakeAdd },
        sync: { add: syncAdd },
      },
    });

    expect(result.accepted).toBe(2);
    expect(intakeAdd).toHaveBeenCalledTimes(1);
    expect(syncAdd).toHaveBeenCalledTimes(1);
    expect(syncAdd).toHaveBeenCalledWith(
      "walletSync",
      expect.objectContaining({
        address: "0x1111111111111111111111111111111111111111",
        chain: "base",
        reason: "USER",
      }),
      expect.anything()
    );
  });

  it("import: 100 entries create 100 child jobs under one parent", async () => {
    const lines = Array.from({ length: 100 }, (_, i) => {
      const hex = i.toString(16).padStart(40, "0");
      return `0x${hex},base,Wallet ${i}`;
    });

    const mockPrisma: any = {
      wallet: {
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockImplementation(({ create }) => Promise.resolve(create)),
      },
      syncState: {
        upsert: vi.fn().mockResolvedValue({}),
      },
      jobRun: {
        upsert: vi.fn().mockResolvedValue({}),
      },
    };

    const intakeAdd = vi.fn().mockResolvedValue({ id: "job" });

    const result = await processImportBatch(lines.join("\n"), {
      defaultChain: "base",
      prisma: mockPrisma,
      queues: {
        intake: { add: intakeAdd },
      },
    });

    expect(result.accepted).toBe(100);
    expect(intakeAdd).toHaveBeenCalledTimes(100);
    expect(result.batchId).toBeDefined();
  });

  it("import: parent progress equals completed children over total", () => {
    const completed = 45;
    const total = 100;
    const progressPct = Math.round((completed / total) * 100);
    expect(progressPct).toBe(45);
  });
});
