// src/lib/rules/registry.ts
import type { AlertType } from "@/generated/prisma/client";
import type { AlertRule } from "@/lib/rules/types";
import { evaluateA1StableArming } from "./a1-stable-arming";
import { evaluateA2GasArming } from "./a2-gas-arming";
import { evaluateA3CexWithdrawal } from "./a3-cex-withdrawal";
import { evaluateA4DormancyWake } from "./a4-dormancy-wake";
import { evaluateA5ClusterArming } from "./a5-cluster-arming";
import { evaluateA6Consolidation } from "./a6-consolidation";
import { evaluateT1ArmedEntry } from "./t1-armed-entry";
import { evaluateT2IndependentCoEntry } from "./t2-independent-co-entry";
import { evaluateT3FreshLaunch } from "./t3-fresh-launch";
import { evaluateT4AddOnRetrace } from "./t4-add-on-retrace";
import { evaluateT5ClusterCoEntry } from "./t5-cluster-co-entry";
import { evaluateC1DistributionPrep } from "./c1-distribution-prep";
import { evaluateC2CoDistribution } from "./c2-co-distribution";
import { evaluateC3MoonDiscipline } from "./c3-moon-discipline";
import { evaluateC4CampaignSpent } from "./c4-campaign-spent";

export const ALERT_RULES: Readonly<Record<AlertType, AlertRule>> = {
  A1: {
    id: "A1",
    title: "Stablecoin Arming",
    category: "ARMING",
    lookback: (t) => t.a1WindowHours * 3600 * 1000,
    evaluate: evaluateA1StableArming,
  },
  A2: {
    id: "A2",
    title: "Gas Arming",
    category: "ARMING",
    lookback: (t) => t.a2WindowHours * 3600 * 1000,
    evaluate: evaluateA2GasArming,
  },
  A3: {
    id: "A3",
    title: "CEX Withdrawal",
    category: "ARMING",
    lookback: () => 24 * 3600 * 1000,
    evaluate: evaluateA3CexWithdrawal,
  },
  A4: {
    id: "A4",
    title: "Dormancy Wake",
    category: "ARMING",
    lookback: () => 24 * 3600 * 1000,
    evaluate: evaluateA4DormancyWake,
  },
  A5: {
    id: "A5",
    title: "Cluster Arming",
    category: "ARMING",
    lookback: (t) => t.a5WindowHours * 3600 * 1000,
    evaluate: evaluateA5ClusterArming,
  },
  A6: {
    id: "A6",
    title: "Consolidation",
    category: "ARMING",
    lookback: (t) => t.a6WindowHours * 3600 * 1000,
    evaluate: evaluateA6Consolidation,
  },
  T1: {
    id: "T1",
    title: "Armed Entry",
    category: "TRIGGER",
    lookback: () => 24 * 3600 * 1000,
    evaluate: evaluateT1ArmedEntry,
  },
  T2: {
    id: "T2",
    title: "Independent Co-Entry",
    category: "TRIGGER",
    lookback: (t) => t.t2WindowHours * 3600 * 1000,
    evaluate: evaluateT2IndependentCoEntry,
  },
  T3: {
    id: "T3",
    title: "Fresh-Launch Entry",
    category: "TRIGGER",
    lookback: () => 24 * 3600 * 1000,
    evaluate: evaluateT3FreshLaunch,
  },
  T4: {
    id: "T4",
    title: "Add-On-Retrace",
    category: "TRIGGER",
    lookback: () => 24 * 3600 * 1000,
    evaluate: evaluateT4AddOnRetrace,
  },
  T5: {
    id: "T5",
    title: "Cluster Co-Entry",
    category: "TRIGGER",
    lookback: (t) => t.t5WindowHours * 3600 * 1000,
    evaluate: evaluateT5ClusterCoEntry,
  },
  C1: {
    id: "C1",
    title: "Distribution Prep",
    category: "EXIT_RISK",
    lookback: () => 24 * 3600 * 1000,
    evaluate: evaluateC1DistributionPrep,
  },
  C2: {
    id: "C2",
    title: "Co-Distribution",
    category: "EXIT_RISK",
    lookback: (t) => t.c2WindowHours * 3600 * 1000,
    evaluate: evaluateC2CoDistribution,
  },
  C3: {
    id: "C3",
    title: "Moon Discipline",
    category: "EXIT_RISK",
    lookback: (t) => t.c3MinAgeDays * 86400 * 1000,
    evaluate: evaluateC3MoonDiscipline,
  },
  C4: {
    id: "C4",
    title: "Campaign Spent",
    category: "EXIT_RISK",
    lookback: (t) => t.c4WindowHours * 3600 * 1000,
    evaluate: evaluateC4CampaignSpent,
  },
};
