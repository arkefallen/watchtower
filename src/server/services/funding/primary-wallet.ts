import type { Address, ChainSlug } from "@/lib/chains/types";

export interface PrimaryWalletInput {
  trackedAddress: Address;
  trackedChain: ChainSlug;
  candidate: { address: Address; chain: ChainSlug };
  /** Aggregated funding of tracked-by-candidate. */
  funding: {
    eventsCount: number;
    totalUsd: string;
    firstAt: Date | null;
    fundedFirstGas: boolean;
  };
  /** Tracked wallet's realized outflow value and per-destination breakdown. */
  outflow: {
    realizedOutflowUsd: string;
    byDestination: Array<{ address: Address; usd: string }>;
  };
  thresholds: {
    profitSinkRatioPct: number;
    minFundingEvents: number;
  };
}

export interface PrimaryWalletVerdict {
  isRepeatedFunder: boolean;
  fundedFirstGas: boolean;
  isProfitSink: boolean;
  profitSinkRatio: string | null;
  isLargestOutflowDestination: boolean;
  isPrimaryWallet: boolean;
  label: "PRIMARY_WALLET" | "REPEATED_FUNDER_CANDIDATE" | "PROFIT_SINK_CANDIDATE" | null;
  /** Rendered for the UI badge tooltip; mirrors FR-5.5's evidence discipline. */
  evidence: {
    ruleText: string;
    conditionA: { satisfied: boolean; detail: string };
    conditionB: { satisfied: boolean; detail: string };
    numbers: Record<string, string>;
  };
}

export function classifyPrimaryWallet(input: PrimaryWalletInput): PrimaryWalletVerdict {
  const { candidate, funding, outflow, thresholds } = input;
  const { profitSinkRatioPct, minFundingEvents } = thresholds;

  // Condition A (funding relationship):
  // True when candidate funded tracked wallet >= minFundingEvents (default 2),
  // OR when it funded first-ever gas and at least one later funding (eventsCount >= 2).
  // Note: single funding (eventsCount = 1) that is first gas does NOT satisfy A alone.
  const satisfiedA =
    funding.eventsCount >= minFundingEvents ||
    (funding.fundedFirstGas && funding.eventsCount >= 2);

  // Condition B (profit sink):
  // True when candidate received back >= profitSinkRatioPct% of realized outflow,
  // OR when candidate is the single largest destination of outgoing value.
  const candidateNorm = candidate.address.toLowerCase();
  const totalOutflowNum = parseFloat(outflow.realizedOutflowUsd) || 0;

  const candidateDest = outflow.byDestination.find(
    (d) => d.address.toLowerCase() === candidateNorm
  );
  const candidateUsdNum = candidateDest ? parseFloat(candidateDest.usd) || 0 : 0;

  let profitSinkRatio: string | null = null;
  let ratioSatisfied = false;

  if (totalOutflowNum > 0) {
    const ratioPct = (candidateUsdNum / totalOutflowNum) * 100;
    profitSinkRatio = ratioPct.toFixed(4);
    if (ratioPct >= profitSinkRatioPct) {
      ratioSatisfied = true;
    }
  }

  // Check largest destination
  let isLargestOutflowDestination = false;
  if (outflow.byDestination.length > 0 && totalOutflowNum > 0 && candidateUsdNum > 0) {
    const sortedDestinations = [...outflow.byDestination].sort(
      (a, b) => (parseFloat(b.usd) || 0) - (parseFloat(a.usd) || 0)
    );
    const topDest = sortedDestinations[0];
    if (
      topDest.address.toLowerCase() === candidateNorm &&
      (parseFloat(topDest.usd) || 0) > 0
    ) {
      // Check for strictly or tied largest
      isLargestOutflowDestination = true;
    }
  }

  const satisfiedB = ratioSatisfied || isLargestOutflowDestination;
  const isPrimaryWallet = satisfiedA && satisfiedB;

  let label: PrimaryWalletVerdict["label"] = null;
  if (isPrimaryWallet) {
    label = "PRIMARY_WALLET";
  } else if (satisfiedA) {
    label = "REPEATED_FUNDER_CANDIDATE";
  } else if (satisfiedB) {
    label = "PROFIT_SINK_CANDIDATE";
  }

  const evidence = {
    ruleText:
      "Primary wallet rule (FR-2.4): Condition A (≥2 fundings or first-gas + later funding) AND Condition B (≥20% profit return or largest outflow destination).",
    conditionA: {
      satisfied: satisfiedA,
      detail: `Funding count ${funding.eventsCount} (min ${minFundingEvents})${funding.fundedFirstGas ? " [funded first gas]" : ""}`,
    },
    conditionB: {
      satisfied: satisfiedB,
      detail: `Returned $${candidateUsdNum.toFixed(2)} of $${totalOutflowNum.toFixed(2)} (${profitSinkRatio ? `${profitSinkRatio}%` : "0%"})${isLargestOutflowDestination ? " [largest destination]" : ""}`,
    },
    numbers: {
      eventsCount: funding.eventsCount.toString(),
      minFundingEvents: minFundingEvents.toString(),
      realizedOutflowUsd: outflow.realizedOutflowUsd,
      candidateOutflowUsd: candidateUsdNum.toFixed(2),
      profitSinkRatioPct: profitSinkRatioPct.toString(),
      ratioCalculatedPct: profitSinkRatio ?? "0",
    },
  };

  return {
    isRepeatedFunder: satisfiedA,
    fundedFirstGas: funding.fundedFirstGas,
    isProfitSink: satisfiedB,
    profitSinkRatio,
    isLargestOutflowDestination,
    isPrimaryWallet,
    label,
    evidence,
  };
}

export function mapFundingEdgeKind(flags: {
  isPrimaryWallet: boolean;
  isRepeatedFunder: boolean;
  isProfitSink: boolean;
}): "PRIMARY" | "PROFIT_SINK" | "REPEATED" | "INITIAL" {
  if (flags.isPrimaryWallet) return "PRIMARY";
  if (flags.isProfitSink) return "PROFIT_SINK";
  if (flags.isRepeatedFunder) return "REPEATED";
  return "INITIAL";
}
