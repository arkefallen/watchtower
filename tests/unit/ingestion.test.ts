import { describe, expect, it, vi } from "vitest";
import {
  normalizeNativeTx,
  normalizeInternalTx,
  normalizeTokenTransfer,
} from "@/server/services/ingestion/normalize";
import { persistTransactions, type PersistTransactionsDeps } from "@/server/services/ingestion/persist";
import type { RawNativeTx, RawInternalTx, RawTokenTransfer, Address } from "@/lib/chains/types";

describe("P1-T04: Ingestion and Idempotent Persistence", () => {
  const sampleHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  it("ingestion: one hash yields separate NATIVE, INTERNAL, and ERC20 rows", () => {
    const nativeRaw: RawNativeTx = {
      hash: sampleHash,
      blockNumber: 100n,
      timestamp: new Date("2026-01-01T00:00:00Z"),
      from: "0x1111111111111111111111111111111111111111" as Address,
      to: "0x2222222222222222222222222222222222222222" as Address,
      valueRaw: "1000000000000000000",
      gasUsed: "21000",
      gasPriceWei: "1000000000",
      isError: false,
      methodId: null,
      functionName: null,
      contractCreated: null,
    };

    const internalRaw: RawInternalTx = {
      hash: sampleHash,
      traceId: "trace_1",
      blockNumber: 100n,
      timestamp: new Date("2026-01-01T00:00:00Z"),
      from: "0x3333333333333333333333333333333333333333" as Address,
      to: "0x2222222222222222222222222222222222222222" as Address,
      valueRaw: "500000000000000000",
      isError: false,
      callType: "CALL",
    };

    const erc20Raw: RawTokenTransfer = {
      hash: sampleHash,
      logIndex: 4,
      blockNumber: 100n,
      timestamp: new Date("2026-01-01T00:00:00Z"),
      from: "0x4444444444444444444444444444444444444444" as Address,
      to: "0x2222222222222222222222222222222222222222" as Address,
      tokenAddress: "0x5555555555555555555555555555555555555555" as Address,
      tokenSymbol: "PEPE",
      tokenName: "Pepe",
      tokenDecimals: 18,
      valueRaw: "2000000000000000000",
    };

    const nativeNorm = normalizeNativeTx(nativeRaw, "base");
    const internalNorm = normalizeInternalTx(internalRaw, "base", 0);
    const erc20Norm = normalizeTokenTransfer(erc20Raw, "base");

    expect(nativeNorm.kind).toBe("NATIVE");
    expect(nativeNorm.ordinal).toBe(0);
    expect(internalNorm.kind).toBe("INTERNAL");
    expect(internalNorm.ordinal).toBe(0);
    expect(erc20Norm.kind).toBe("ERC20");
    expect(erc20Norm.ordinal).toBe(4);

    const rows = [nativeNorm, internalNorm, erc20Norm];
    expect(rows).toHaveLength(3);
    const keys = rows.map((r) => `${r.chain}:${r.hash}:${r.kind}:${r.ordinal}`);
    expect(new Set(keys).size).toBe(3);
  });

  it("ingestion: internal traces of one hash are distinguished by ordinal", () => {
    const traceA: RawInternalTx = {
      hash: sampleHash,
      traceId: "trace_0",
      blockNumber: 100n,
      timestamp: new Date(),
      from: "0x1111111111111111111111111111111111111111" as Address,
      to: "0x2222222222222222222222222222222222222222" as Address,
      valueRaw: "100",
      isError: false,
      callType: "CALL",
    };
    const traceB: RawInternalTx = {
      ...traceA,
      traceId: "trace_1",
      valueRaw: "200",
    };

    const normA = normalizeInternalTx(traceA, "base", 0);
    const normB = normalizeInternalTx(traceB, "base", 1);

    expect(normA.ordinal).toBe(0);
    expect(normB.ordinal).toBe(1);
    expect(normA.traceId).toBe("trace_0");
    expect(normB.traceId).toBe("trace_1");
  });

  it("ingestion: ERC20 rows are distinguished by logIndex", () => {
    const transferA: RawTokenTransfer = {
      hash: sampleHash,
      logIndex: 1,
      blockNumber: 100n,
      timestamp: new Date(),
      from: "0x1111111111111111111111111111111111111111" as Address,
      to: "0x2222222222222222222222222222222222222222" as Address,
      tokenAddress: "0x5555555555555555555555555555555555555555" as Address,
      tokenSymbol: "TKN",
      tokenName: "Token",
      tokenDecimals: 18,
      valueRaw: "100",
    };
    const transferB: RawTokenTransfer = {
      ...transferA,
      logIndex: 2,
      valueRaw: "200",
    };

    const normA = normalizeTokenTransfer(transferA, "base");
    const normB = normalizeTokenTransfer(transferB, "base");

    expect(normA.ordinal).toBe(1);
    expect(normB.ordinal).toBe(2);
    expect(normA.logIndex).toBe(1);
    expect(normB.logIndex).toBe(2);
  });

  it("ingestion: amountRaw is stored as an exact decimal string for an 18-decimal token", () => {
    const rawValue = "123456789012345678901234567890";
    const transfer: RawTokenTransfer = {
      hash: sampleHash,
      logIndex: 0,
      blockNumber: 100n,
      timestamp: new Date(),
      from: "0x1111111111111111111111111111111111111111" as Address,
      to: "0x2222222222222222222222222222222222222222" as Address,
      tokenAddress: "0x5555555555555555555555555555555555555555" as Address,
      tokenSymbol: "BIG",
      tokenName: "BigToken",
      tokenDecimals: 18,
      valueRaw: rawValue,
    };

    const norm = normalizeTokenTransfer(transfer, "base");
    expect(norm.amountRaw).toBe(rawValue);
  });

  it("ingestion: re-run creates zero new rows", async () => {
    const txStore = new Map<string, any>();
    const tokenStore = new Map<string, any>();

    const mockPrisma: any = {
      token: {
        upsert: vi.fn().mockImplementation(({ where, create, update }) => {
          const key = `${where.address_chain.chain}:${where.address_chain.address}`;
          if (!tokenStore.has(key)) tokenStore.set(key, create);
          return Promise.resolve(tokenStore.get(key));
        }),
      },
      transaction: {
        upsert: vi.fn().mockImplementation(({ where, create, update }) => {
          const key = `${where.tx_natural_key.chain}:${where.tx_natural_key.hash}:${where.tx_natural_key.kind}:${where.tx_natural_key.ordinal}`;
          const isNew = !txStore.has(key);
          if (isNew) txStore.set(key, create);
          return Promise.resolve({ record: txStore.get(key), isNew });
        }),
      },
      syncState: {
        findUnique: vi.fn().mockResolvedValue({ cursorsJson: {}, lastSyncedBlock: 0n }),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    const rows = [
      normalizeNativeTx(
        {
          hash: sampleHash,
          blockNumber: 100n,
          timestamp: new Date(),
          from: "0x1111111111111111111111111111111111111111" as Address,
          to: "0x2222222222222222222222222222222222222222" as Address,
          valueRaw: "100",
          gasUsed: null,
          gasPriceWei: null,
          isError: false,
          methodId: null,
          functionName: null,
          contractCreated: null,
        },
        "base"
      ),
    ];

    const res1 = await persistTransactions({
      prisma: mockPrisma,
      walletAddress: "0x2222222222222222222222222222222222222222",
      chain: "base",
      transactions: rows,
      tokenStubs: [],
      coveredThroughBlock: 100n,
      endpoint: "NORMAL_TX",
    });

    expect(res1.inserted).toBe(1);

    const res2 = await persistTransactions({
      prisma: mockPrisma,
      walletAddress: "0x2222222222222222222222222222222222222222",
      chain: "base",
      transactions: rows,
      tokenStubs: [],
      coveredThroughBlock: 100n,
      endpoint: "NORMAL_TX",
    });

    expect(res2.inserted).toBe(0);
    expect(txStore.size).toBe(1);
  });

  it("ingestion: Token stub rows are created for unseen tokens", async () => {
    const tokenStore = new Map<string, any>();
    const mockPrisma: any = {
      token: {
        upsert: vi.fn().mockImplementation(({ where, create }) => {
          const key = `${where.address_chain.chain}:${where.address_chain.address}`;
          tokenStore.set(key, create);
          return Promise.resolve(create);
        }),
      },
      transaction: {
        upsert: vi.fn().mockResolvedValue({ isNew: true }),
      },
      syncState: {
        findUnique: vi.fn().mockResolvedValue({ cursorsJson: {}, lastSyncedBlock: 0n }),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    const tokenStub = {
      address: "0x5555555555555555555555555555555555555555" as Address,
      chain: "base" as const,
      symbol: "TEST",
      decimals: 18,
    };

    await persistTransactions({
      prisma: mockPrisma,
      walletAddress: "0x2222222222222222222222222222222222222222",
      chain: "base",
      transactions: [],
      tokenStubs: [tokenStub],
      coveredThroughBlock: 100n,
      endpoint: "ERC20_TRANSFER",
    });

    expect(tokenStore.size).toBe(1);
    expect(mockPrisma.token.upsert).toHaveBeenCalledTimes(1);
  });

  it("ingestion: cursor advances only to coveredThroughBlock", async () => {
    let updatedCursors: any = null;
    const mockPrisma: any = {
      token: { upsert: vi.fn().mockResolvedValue({}) },
      transaction: { upsert: vi.fn().mockResolvedValue({ isNew: true }) },
      syncState: {
        findUnique: vi.fn().mockResolvedValue({
          cursorsJson: {},
          lastSyncedBlock: 50n,
        }),
        update: vi.fn().mockImplementation(({ data }) => {
          updatedCursors = data;
          return Promise.resolve({});
        }),
      },
    };

    await persistTransactions({
      prisma: mockPrisma,
      walletAddress: "0x2222222222222222222222222222222222222222",
      chain: "base",
      transactions: [],
      tokenStubs: [],
      coveredThroughBlock: 150n,
      endpoint: "NORMAL_TX",
      truncated: false,
    });

    expect(updatedCursors).toBeDefined();
    expect(updatedCursors.lastSyncedBlock).toBe(150n);
    expect(updatedCursors.cursorsJson.NORMAL_TX.coveredThroughBlock).toBe("150");
  });

  it("ingestion: truncated fetch does not advance past covered block", async () => {
    let updatedCursors: any = null;
    const mockPrisma: any = {
      token: { upsert: vi.fn().mockResolvedValue({}) },
      transaction: { upsert: vi.fn().mockResolvedValue({ isNew: true }) },
      syncState: {
        findUnique: vi.fn().mockResolvedValue({
          cursorsJson: {},
          lastSyncedBlock: 0n,
        }),
        update: vi.fn().mockImplementation(({ data }) => {
          updatedCursors = data;
          return Promise.resolve({});
        }),
      },
    };

    // A fetch requested up to 1000n, but truncated at 450n
    await persistTransactions({
      prisma: mockPrisma,
      walletAddress: "0x2222222222222222222222222222222222222222",
      chain: "base",
      transactions: [],
      tokenStubs: [],
      coveredThroughBlock: 450n,
      endpoint: "NORMAL_TX",
      truncated: true,
    });

    expect(updatedCursors.lastSyncedBlock).toBe(450n);
    expect(updatedCursors.cursorsJson.NORMAL_TX.coveredThroughBlock).toBe("450");
    expect(updatedCursors.cursorsJson.NORMAL_TX.truncated).toBe(true);
  });
});
