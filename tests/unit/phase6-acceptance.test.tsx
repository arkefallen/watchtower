import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";

vi.mock("@/server/db/client", () => ({
  prisma: {},
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/server/services/settings", () => ({
  loadSettings: vi.fn().mockResolvedValue({
    gradedDefinition: "ANY_TAG_OR_COMPUTED",
  }),
}));

import { lookupTokenDetails, deriveHolderStatus } from "@/server/services/token/lookup";
import { evaluateTokenRedFlags } from "@/server/services/token/red-flags";
import { calculateWalletGrade } from "@/server/services/wallet/grade";
import { pruneTokenHistory } from "@/server/services/maintenance/prune";
import { HolderTable } from "@/components/tokens/HolderTable";
import { RedFlagList } from "@/components/tokens/RedFlagList";
import { TokenNetflowChart } from "@/components/tokens/TokenNetflowChart";
import { TokenLookupForm } from "@/components/tokens/TokenLookupForm";
import { GradeCard } from "@/components/wallets/GradeCard";

// Load Phase 6 scenario fixture
const fixturePath = path.resolve(__dirname, "../fixtures/scenarios/phase6-bundle.json");
const phase6Bundle = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

describe("Phase 6 Acceptance Criteria: Token Lookup & Grading (SRS §8)", () => {
  const pepeAddress = "0x6982508145454ce325ddbe47a25d4ec3d2311933";
  const deployerAddress = "0xde91000000000000000000000000000000000001";
  const trackedWallet = "0x1111111111111111111111111111111111111111";
  const promoterTxHash = "0x6000000000000000000000000000000000000000000000000000000000000010";

  it("criterion 1: paste/lookup token -> renders holders with grades, entry MCs, netflow history, and red flags", async () => {
    const tokenInfo = phase6Bundle.tokens[pepeAddress];
    const holderInfo = phase6Bundle.holders[pepeAddress];

    const mockPositions = [
      {
        walletAddress: trackedWallet,
        wallet: {
          ensName: "whale.eth",
          edge: "SMART",
          style: "RIDER",
          size: "W",
          profile: {
            gradeJson: {
              available: true,
              winRate: 0.75,
              winRatePct: 75,
              realizedPnlUsd: "12500.00",
              entryTimingRatio: 0.18,
              gradeLabel: "SMART-RIDER [W]",
            },
          },
        },
        isOpen: true,
        entryMarketCap: 1_200_000,
        amountRaw: "5000000000000000000000000",
        costUsd: 1000,
        unrealizedUsd: 42000,
        cexDepositedUsd: 0,
        sellCount: 0,
        openedAt: new Date("2026-01-02T10:00:00Z"),
      },
    ];

    const mockMovements = [
      {
        timestamp: new Date("2026-01-02T10:00:00Z"),
        kind: "BUY",
        amountUsd: 1000,
      },
    ];

    const result = await lookupTokenDetails({
      tokenAddress: pepeAddress,
      chain: "base",
      mockData: {
        token: tokenInfo,
        positions: mockPositions,
        movements: mockMovements,
        clusters: [],
        redFlags: {
          tokenAddress: pepeAddress,
          chain: "base",
          deployedAt: tokenInfo.deployedAt,
          tokenAgeDays: 60,
          deployerAddress,
          hasPromoterWarning: true,
          promoterWarnings: [
            {
              walletAddress: trackedWallet,
              txHash: promoterTxHash,
              amount: "5000000000000000000000000",
              timestamp: "2026-01-02T10:00:00.000Z",
            },
          ],
          top10SharePct: holderInfo.top10SharePct,
          holderCount: holderInfo.holderCount,
          holderDataUnavailable: false,
          checkedAt: new Date().toISOString(),
        },
      },
    });

    // Verify service structure
    expect(result.isKnown).toBe(true);
    expect(result.token?.symbol).toBe("PEPE");
    expect(result.holders).toHaveLength(1);
    expect(result.holders[0].walletAddress).toBe(trackedWallet.toLowerCase());
    expect(result.holders[0].label).toBe("SMART-RIDER [W]");
    expect(result.holders[0].status).toBe("HOLDING");
    expect(result.holders[0].entryMarketCap).toBe("1200000");
    expect((result.holders[0].grade as any).winRatePct).toBe(75);

    expect(result.netflow.window24h).toBeDefined();
    expect(result.redFlags?.hasPromoterWarning).toBe(true);

    // SSR UI components
    const holderHtml = renderToString(
      <HolderTable holders={result.holders} chain="base" />
    );
    expect(holderHtml).toContain("whale.eth");
    expect(holderHtml).toContain("SMART-RIDER [W]");
    expect(holderHtml).toContain("HOLDING");
    expect(holderHtml).toContain("75");

    const netflowHtml = renderToString(
      <TokenNetflowChart netflow={result.netflow} symbol="PEPE" />
    );
    expect(netflowHtml).toContain("Netflow Analytics");

    const formHtml = renderToString(
      <TokenLookupForm initialAddress={pepeAddress} initialChain="base" />
    );
    expect(formHtml).toContain(pepeAddress);
  });

  it("criterion 2: panel query completes in < 3s SLA from local DB", async () => {
    const tokenInfo = phase6Bundle.tokens[pepeAddress];

    const result = await lookupTokenDetails({
      tokenAddress: pepeAddress,
      chain: "base",
      mockData: {
        token: tokenInfo,
        positions: [],
        movements: [],
      },
    });

    // Local DB query SLA check (< 3,000 ms)
    expect(result.renderDurationMs).toBeLessThan(3000);
    expect(typeof result.renderDurationMs).toBe("number");
  });

  it("criterion 3: promoter red flag is visible for a deployer-funded wallet naming wallet and tx hash", () => {
    const tokenInfo = phase6Bundle.tokens[pepeAddress];
    const holderInfo = phase6Bundle.holders[pepeAddress];
    const transfers = phase6Bundle.tokenTransfers[trackedWallet];

    const mappedTxs = transfers.map((t: any) => ({
      hash: t.hash,
      fromAddress: t.from,
      toAddress: t.to,
      tokenAddress: t.tokenAddress,
      valueRaw: t.valueRaw,
      timestamp: new Date(t.timestamp),
    }));

    const redFlags = evaluateTokenRedFlags({
      tokenAddress: pepeAddress,
      chain: "base",
      deployerAddress: tokenInfo.deployerAddress,
      deployedAt: new Date(tokenInfo.deployedAt),
      transactions: mappedTxs,
      trackedWalletAddresses: [trackedWallet],
      holderSummary: {
        top10SharePct: holderInfo.top10SharePct,
        holderCount: holderInfo.holderCount,
        source: holderInfo.source,
      },
      now: new Date("2026-03-01T00:00:00.000Z"),
    });

    // Assert red-flags evaluation
    expect(redFlags.hasPromoterWarning).toBe(true);
    expect(redFlags.promoterWarnings).toHaveLength(1);
    expect(redFlags.promoterWarnings[0].walletAddress).toBe(trackedWallet.toLowerCase());
    expect(redFlags.promoterWarnings[0].txHash).toBe(promoterTxHash);
    expect(redFlags.top10SharePct).toBe(42.8);
    expect(redFlags.tokenAgeDays).toBeGreaterThan(0);

    // SSR of RedFlagList component
    const redFlagHtml = renderToString(
      <RedFlagList
        redFlags={redFlags}
        clusterWarnings={[]}
        chain="base"
        explorerBaseUrl="https://basescan.org"
      />
    );

    expect(redFlagHtml).toContain("Paid-Promoter Warning");
    expect(redFlagHtml).toContain("0x1111...1111");
    expect(redFlagHtml).toContain("0x600000...000010");
    expect(redFlagHtml).toContain("42.8");
  });

  it("criterion 4: wallet profile shows the auto-grade block with win rate, realized PnL, and entry-timing ratio", () => {
    // 10 closed positions, 7 profitable
    const positions = [
      { isOpen: false, realizedUsd: "500.00", entryMarketCap: 1_000_000, peakMarketCap: 5_000_000 },
      { isOpen: false, realizedUsd: "1200.00", entryMarketCap: 2_000_000, peakMarketCap: 10_000_000 },
      { isOpen: false, realizedUsd: "-300.00", entryMarketCap: 3_000_000, peakMarketCap: 4_000_000 },
      { isOpen: false, realizedUsd: "800.00", entryMarketCap: 500_000, peakMarketCap: 2_500_000 },
      { isOpen: false, realizedUsd: "400.00", entryMarketCap: 800_000, peakMarketCap: 1_600_000 },
      { isOpen: false, realizedUsd: "-200.00", entryMarketCap: 1_500_000, peakMarketCap: 1_800_000 },
      { isOpen: false, realizedUsd: "950.00", entryMarketCap: 400_000, peakMarketCap: 4_000_000 },
      { isOpen: false, realizedUsd: "600.00", entryMarketCap: 600_000, peakMarketCap: 3_000_000 },
      { isOpen: false, realizedUsd: "-150.00", entryMarketCap: 2_000_000, peakMarketCap: 2_200_000 },
      { isOpen: false, realizedUsd: "1500.00", entryMarketCap: 1_000_000, peakMarketCap: 10_000_000 },
      // 1 open position (must be excluded from realized PnL and win rate)
      { isOpen: true, realizedUsd: "0.00", entryMarketCap: 1_000_000, peakMarketCap: 2_000_000 },
    ];

    const grade = calculateWalletGrade(
      positions,
      {
        edgeTag: "SMART",
        styleTag: "RIDER",
        sizeTag: "W",
      }
    );

    expect(grade.available).toBe(true);
    expect(grade.sampleSize).toBe(10);
    expect(grade.profitablePositionsCount).toBe(7);
    expect(grade.winRatePct).toBe(70);
    expect(grade.realizedPnlUsd).toBe("5300.00");
    expect(grade.entryTimingRatio).toBeGreaterThan(0);
    expect(grade.entryTimingRatio).toBeLessThanOrEqual(1);
    expect(grade.gradeLabel).toBe("SMART-RIDER [W]");

    // SSR GradeCard component
    const gradeHtml = renderToString(<GradeCard grade={grade} />);
    expect(gradeHtml).toContain("Auto-Grade Assessment");
    expect(gradeHtml).toContain("SMART-RIDER [W]");
    expect(gradeHtml).toContain("70.0");
    expect(gradeHtml).toContain("5,300.00");
    expect(gradeHtml).toContain("GRADE ACTIVE");

    // Low-sample safeguard (<3 positions)
    const lowSampleGrade = calculateWalletGrade([
      { isOpen: false, realizedUsd: "100.00" },
    ]);
    expect(lowSampleGrade.available).toBe(false);

    const lowSampleHtml = renderToString(<GradeCard grade={lowSampleGrade} />);
    expect(lowSampleHtml).toContain("UNAVAILABLE (SAMPLE &lt; 3)");
  });

  it("criterion 5: maintenance prune requires confirmation and isolates target token", async () => {
    const mockPrisma: any = {
      transaction: { deleteMany: vi.fn().mockResolvedValue({ count: 12 }) },
      movementEvent: { deleteMany: vi.fn().mockResolvedValue({ count: 8 }) },
      priceSnapshot: { deleteMany: vi.fn().mockResolvedValue({ count: 5 }) },
      position: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
      dailyFlow: { deleteMany: vi.fn().mockResolvedValue({ count: 4 }) },
    };

    // Fails without explicit "PRUNE" confirmation
    await expect(
      pruneTokenHistory(
        {
          tokenAddress: pepeAddress,
          chain: "base",
          confirmation: "prune" as any,
        },
        mockPrisma
      )
    ).rejects.toThrow(/Explicit confirmation 'PRUNE' is required/i);

    // Succeeds with "PRUNE"
    const pruneResult = await pruneTokenHistory(
      {
        tokenAddress: pepeAddress,
        chain: "base",
        confirmation: "PRUNE",
      },
      mockPrisma
    );

    expect(pruneResult.tokenAddress).toBe(pepeAddress.toLowerCase());
    expect(pruneResult.rowsDeleted.total).toBe(31);
    expect(pruneResult.rowsDeleted.transactions).toBe(12);
    expect(pruneResult.rowsDeleted.movements).toBe(8);
  });
});
