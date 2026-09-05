import { describe, expect, it } from "vitest";
import {
  classifyPrimaryWallet,
  mapFundingEdgeKind,
  type PrimaryWalletInput,
} from "@/server/services/funding/primary-wallet";
import type { Address } from "@/lib/chains/types";

describe("P1-T10: Primary-Wallet Detector", () => {
  const tracked = "0x1111111111111111111111111111111111111111" as Address;
  const candidate = "0x2222222222222222222222222222222222222222" as Address;
  const otherDest = "0x3333333333333333333333333333333333333333" as Address;

  const defaultInput: PrimaryWalletInput = {
    trackedAddress: tracked,
    trackedChain: "base",
    candidate: { address: candidate, chain: "base" },
    funding: {
      eventsCount: 2,
      totalUsd: "500.00",
      firstAt: new Date("2026-01-01T00:00:00Z"),
      fundedFirstGas: false,
    },
    outflow: {
      realizedOutflowUsd: "1000.00",
      byDestination: [
        { address: candidate, usd: "250.00" }, // 25%
        { address: otherDest, usd: "750.00" },
      ],
    },
    thresholds: {
      profitSinkRatioPct: 20,
      minFundingEvents: 2,
    },
  };

  it("primary: two fundings plus 25% return is PRIMARY_WALLET", () => {
    const verdict = classifyPrimaryWallet(defaultInput);
    expect(verdict.isRepeatedFunder).toBe(true);
    expect(verdict.isProfitSink).toBe(true);
    expect(verdict.isPrimaryWallet).toBe(true);
    expect(verdict.label).toBe("PRIMARY_WALLET");
  });

  it("primary: exactly 20.0% return satisfies the profit-sink threshold", () => {
    const input: PrimaryWalletInput = {
      ...defaultInput,
      outflow: {
        realizedOutflowUsd: "1000.00",
        byDestination: [
          { address: candidate, usd: "200.00" }, // exactly 20.0%
          { address: otherDest, usd: "800.00" },
        ],
      },
    };
    const verdict = classifyPrimaryWallet(input);
    expect(verdict.isProfitSink).toBe(true);
    expect(verdict.isPrimaryWallet).toBe(true);
  });

  it("primary: 19.9% does not satisfy profit-sink threshold via ratio", () => {
    const input: PrimaryWalletInput = {
      ...defaultInput,
      outflow: {
        realizedOutflowUsd: "1000.00",
        byDestination: [
          { address: candidate, usd: "199.00" }, // 19.9%
          { address: otherDest, usd: "801.00" }, // other is larger
        ],
      },
    };
    const verdict = classifyPrimaryWallet(input);
    expect(verdict.isProfitSink).toBe(false);
    expect(verdict.isPrimaryWallet).toBe(false);
    expect(verdict.label).toBe("REPEATED_FUNDER_CANDIDATE");
  });

  it("primary: exactly 2 fundings satisfies condition A", () => {
    const input: PrimaryWalletInput = {
      ...defaultInput,
      funding: {
        ...defaultInput.funding,
        eventsCount: 2,
        fundedFirstGas: false,
      },
    };
    const verdict = classifyPrimaryWallet(input);
    expect(verdict.isRepeatedFunder).toBe(true);
  });

  it("primary: single funding that is first gas does not satisfy A alone", () => {
    const input: PrimaryWalletInput = {
      ...defaultInput,
      funding: {
        ...defaultInput.funding,
        eventsCount: 1,
        fundedFirstGas: true,
      },
    };
    const verdict = classifyPrimaryWallet(input);
    expect(verdict.isRepeatedFunder).toBe(false);
    expect(verdict.fundedFirstGas).toBe(true);
    expect(verdict.isPrimaryWallet).toBe(false);
    expect(verdict.label).toBe("PROFIT_SINK_CANDIDATE");
  });

  it("primary: first gas plus one later funding satisfies A", () => {
    const input: PrimaryWalletInput = {
      ...defaultInput,
      funding: {
        ...defaultInput.funding,
        eventsCount: 2,
        fundedFirstGas: true,
      },
    };
    const verdict = classifyPrimaryWallet(input);
    expect(verdict.isRepeatedFunder).toBe(true);
    expect(verdict.isPrimaryWallet).toBe(true);
  });

  it("primary: largest-destination path satisfies B without the ratio", () => {
    // Total outflow = 1000. Candidate received 150 (15% < 20%), but is the largest destination
    const input: PrimaryWalletInput = {
      ...defaultInput,
      outflow: {
        realizedOutflowUsd: "1000.00",
        byDestination: [
          { address: candidate, usd: "150.00" }, // largest single dest
          { address: "0x4444444444444444444444444444444444444444" as Address, usd: "100.00" },
          { address: "0x5555555555555555555555555555555555555555" as Address, usd: "100.00" },
        ],
      },
    };
    const verdict = classifyPrimaryWallet(input);
    expect(verdict.isLargestOutflowDestination).toBe(true);
    expect(verdict.isProfitSink).toBe(true);
    expect(verdict.isPrimaryWallet).toBe(true);
  });

  it("primary: neither condition yields a null label", () => {
    const input: PrimaryWalletInput = {
      ...defaultInput,
      funding: {
        eventsCount: 1,
        totalUsd: "100.00",
        firstAt: new Date("2026-01-01T00:00:00Z"),
        fundedFirstGas: false,
      },
      outflow: {
        realizedOutflowUsd: "1000.00",
        byDestination: [
          { address: candidate, usd: "50.00" }, // 5%
          { address: otherDest, usd: "950.00" },
        ],
      },
    };
    const verdict = classifyPrimaryWallet(input);
    expect(verdict.isRepeatedFunder).toBe(false);
    expect(verdict.isProfitSink).toBe(false);
    expect(verdict.isPrimaryWallet).toBe(false);
    expect(verdict.label).toBeNull();
  });

  it("primary: zero realized outflow makes the ratio path unsatisfiable", () => {
    const input: PrimaryWalletInput = {
      ...defaultInput,
      outflow: {
        realizedOutflowUsd: "0.00",
        byDestination: [],
      },
    };
    const verdict = classifyPrimaryWallet(input);
    expect(verdict.profitSinkRatio).toBeNull();
    expect(verdict.isProfitSink).toBe(false);
    expect(verdict.label).toBe("REPEATED_FUNDER_CANDIDATE");
  });

  it("primary: configurable ratio of 30 changes the verdict", () => {
    // 25% returned: satisfies default 20%, but fails 30%
    const input: PrimaryWalletInput = {
      ...defaultInput,
      thresholds: {
        profitSinkRatioPct: 30,
        minFundingEvents: 2,
      },
    };
    const verdict = classifyPrimaryWallet(input);
    expect(verdict.isProfitSink).toBe(false);
    expect(verdict.label).toBe("REPEATED_FUNDER_CANDIDATE");
  });

  it("primary: evidence includes both condition details and the numbers", () => {
    const verdict = classifyPrimaryWallet(defaultInput);
    expect(verdict.evidence).toBeDefined();
    expect(verdict.evidence.conditionA.satisfied).toBe(true);
    expect(verdict.evidence.conditionB.satisfied).toBe(true);
    expect(verdict.evidence.numbers).toHaveProperty("eventsCount", "2");
    expect(verdict.evidence.numbers).toHaveProperty("realizedOutflowUsd", "1000.00");
  });

  it("primary: FundingEdge.kind maps PRIMARY/PROFIT_SINK/REPEATED/INITIAL correctly", () => {
    expect(mapFundingEdgeKind({ isPrimaryWallet: true, isRepeatedFunder: true, isProfitSink: true })).toBe("PRIMARY");
    expect(mapFundingEdgeKind({ isPrimaryWallet: false, isRepeatedFunder: false, isProfitSink: true })).toBe("PROFIT_SINK");
    expect(mapFundingEdgeKind({ isPrimaryWallet: false, isRepeatedFunder: true, isProfitSink: false })).toBe("REPEATED");
    expect(mapFundingEdgeKind({ isPrimaryWallet: false, isRepeatedFunder: false, isProfitSink: false })).toBe("INITIAL");
  });
});
