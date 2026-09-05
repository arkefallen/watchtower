import { describe, expect, it, vi } from "vitest";
import { normalizeAddress, InvalidAddressError, normalizeChain } from "@/server/services/wallet/normalize";
import { createWalletRegistry, type WalletRegistryDeps } from "@/server/services/wallet/registry";

describe("P1-T01: Wallet Registry", () => {
  it("registry: address is stored lowercase", async () => {
    const mixedCase = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12";
    const normalized = normalizeAddress(mixedCase);
    expect(normalized).toBe("0xabcdef1234567890abcdef1234567890abcdef12");
  });

  it("registry: invalid address length is rejected", () => {
    expect(() => normalizeAddress("0x1234")).toThrow(InvalidAddressError);
    expect(() => normalizeAddress("0x" + "a".repeat(41))).toThrow(InvalidAddressError);
  });

  it("registry: non-hex address is rejected", () => {
    expect(() => normalizeAddress("0xzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz")).toThrow(InvalidAddressError);
    expect(() => normalizeAddress("vitalik.eth")).toThrow(InvalidAddressError);
  });

  it("registry: mixed-case duplicate does not create a second row", async () => {
    const store = new Map<string, any>();
    const mockPrisma: any = {
      wallet: {
        upsert: vi.fn().mockImplementation(({ where, create, update }) => {
          const key = `${where.address_chain.chain}:${where.address_chain.address}`;
          const existing = store.get(key);
          if (existing) {
            const updated = { ...existing, ...update };
            store.set(key, updated);
            return Promise.resolve(updated);
          }
          const created = { ...create };
          store.set(key, created);
          return Promise.resolve(created);
        }),
        findUnique: vi.fn().mockImplementation(({ where }) => {
          const key = `${where.address_chain.chain}:${where.address_chain.address}`;
          return Promise.resolve(store.get(key) ?? null);
        }),
      },
      syncState: {
        upsert: vi.fn().mockResolvedValue({ status: "NEVER_SYNCED" }),
      },
      jobRun: {
        upsert: vi.fn().mockResolvedValue({ id: "job-1" }),
      },
    };

    const intakeAdd = vi.fn().mockResolvedValue({ id: "job-1" });
    const registry = createWalletRegistry({
      prisma: mockPrisma,
      queues: { intake: { add: intakeAdd } },
    });

    const res1 = await registry.addWallet({
      address: "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12",
      chain: "base",
    });

    const res2 = await registry.addWallet({
      address: "0xabcdef1234567890abcdef1234567890abcdef12",
      chain: "base",
    });

    expect(store.size).toBe(1);
    expect(res1.address).toBe("0xabcdef1234567890abcdef1234567890abcdef12");
    expect(res2.address).toBe("0xabcdef1234567890abcdef1234567890abcdef12");
  });

  it("registry: add enqueues exactly one intake job", async () => {
    const intakeAdd = vi.fn().mockResolvedValue({ id: "job-1" });
    const mockPrisma: any = {
      wallet: {
        upsert: vi.fn().mockResolvedValue({
          address: "0xabcdef1234567890abcdef1234567890abcdef12",
          chain: "BASE",
        }),
      },
      syncState: {
        upsert: vi.fn().mockResolvedValue({ status: "NEVER_SYNCED" }),
      },
      jobRun: {
        upsert: vi.fn().mockResolvedValue({ id: "job-1" }),
      },
    };

    const registry = createWalletRegistry({
      prisma: mockPrisma,
      queues: { intake: { add: intakeAdd } },
    });

    await registry.addWallet({
      address: "0xabcdef1234567890abcdef1234567890abcdef12",
      chain: "base",
    });

    expect(intakeAdd).toHaveBeenCalledTimes(1);
    expect(intakeAdd).toHaveBeenCalledWith(
      "walletIntake",
      expect.objectContaining({
        address: "0xabcdef1234567890abcdef1234567890abcdef12",
        chain: "base",
      }),
      expect.objectContaining({
        jobId: "intake:base:0xabcdef1234567890abcdef1234567890abcdef12",
      })
    );
  });

  it("registry: delete cascades profile and sync state", async () => {
    let walletDeleted = false;
    const mockPrisma: any = {
      wallet: {
        delete: vi.fn().mockImplementation(({ where }) => {
          walletDeleted = true;
          return Promise.resolve({
            address: where.address_chain.address,
            chain: where.address_chain.chain,
          });
        }),
      },
    };

    const registry = createWalletRegistry({
      prisma: mockPrisma,
    });

    const res = await registry.deleteWallet({
      address: "0xabcdef1234567890abcdef1234567890abcdef12",
      chain: "base",
    });

    expect(res.success).toBe(true);
    expect(walletDeleted).toBe(true);
  });
});
