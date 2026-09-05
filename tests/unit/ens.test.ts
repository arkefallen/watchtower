import { describe, expect, it, vi } from "vitest";
import {
  isEnsName,
  resolveEnsForward,
  resolveEnsReverse,
  resolveWalletInput,
  UnresolvableEnsError,
  type EnsClient,
} from "@/server/services/wallet/ens";

describe("P1-T02: ENS Resolution", () => {
  it("ens: forward resolution sets the address primary key", async () => {
    const mockClient: EnsClient = {
      getEnsAddress: vi.fn().mockResolvedValue("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"),
      getEnsName: vi.fn().mockResolvedValue(null),
    };

    const result = await resolveEnsForward("vitalik.eth", mockClient);
    expect(result.address).toBe("0xd8da6bf26964af9d7eed9e03e53415d37aa96045");
    expect(result.name).toBe("vitalik.eth");
  });

  it("ens: reverse resolution populates ensName", async () => {
    const mockClient: EnsClient = {
      getEnsAddress: vi.fn().mockResolvedValue(null),
      getEnsName: vi.fn().mockResolvedValue("vitalik.eth"),
    };

    const name = await resolveEnsReverse("0xd8da6bf26964af9d7eed9e03e53415d37aa96045", mockClient);
    expect(name).toBe("vitalik.eth");
  });

  it("ens: unresolvable name returns a validation error", async () => {
    const mockClient: EnsClient = {
      getEnsAddress: vi.fn().mockResolvedValue(null),
      getEnsName: vi.fn().mockResolvedValue(null),
    };

    await expect(resolveEnsForward("nonexistent-whale-123456789.eth", mockClient)).rejects.toThrow(
      UnresolvableEnsError
    );
  });

  it("ens: resolver failure is non-fatal on a raw-address add", async () => {
    const mockClient: EnsClient = {
      getEnsAddress: vi.fn().mockResolvedValue(null),
      getEnsName: vi.fn().mockRejectedValue(new Error("RPC Timeout")),
    };

    const result = await resolveWalletInput(
      {
        addressOrName: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
        chain: "base",
      },
      mockClient
    );

    expect(result.address).toBe("0xd8da6bf26964af9d7eed9e03e53415d37aa96045");
    expect(result.ensName).toBeNull();
    expect(result.warning).toContain("RPC Timeout");
  });

  it("ens: address remains the primary key even when a name exists", async () => {
    const mockClient: EnsClient = {
      getEnsAddress: vi.fn().mockResolvedValue("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"),
      getEnsName: vi.fn().mockResolvedValue("vitalik.eth"),
    };

    const result = await resolveWalletInput(
      {
        addressOrName: "vitalik.eth",
        chain: "base",
      },
      mockClient
    );

    expect(result.address).toBe("0xd8da6bf26964af9d7eed9e03e53415d37aa96045");
    expect(result.ensName).toBe("vitalik.eth");
  });
});
