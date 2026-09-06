import { z } from "zod";
import { CHAIN_REGISTRY } from "@/lib/chains/registry";
import type { ChainSlug } from "@/lib/chains/types";

export interface RuleMetadata {
  id: string;
  name: string;
  category: "ARMING" | "TRIGGER" | "EXIT_RISK";
  shortDescription: string;
  fullRuleText: string;
}

export const ALERT_RULES_METADATA: Record<string, RuleMetadata> = {
  A1: {
    id: "A1",
    name: "Stablecoin Arming",
    category: "ARMING",
    shortDescription: "Stablecoin inflow >= max(floor $1,000, 3x 30d median)",
    fullRuleText: "Wallet receives single-day stablecoin inflow >= max($1,000 floor, 3.0x 30-day median single-day inflow).",
  },
  A2: {
    id: "A2",
    name: "Gas Arming",
    category: "ARMING",
    shortDescription: "Native token inflow >= max(floor $100, 3x 30d median)",
    fullRuleText: "Wallet receives single-day native token inflow >= max($100 floor, 3.0x 30-day median single-day inflow). Cold-start rule: floor-only ($100) binds until 7 qualifying daily flow days exist.",
  },
  A3: {
    id: "A3",
    name: "CEX Withdrawal",
    category: "ARMING",
    shortDescription: "Direct withdrawal from CEX entity >= $1,000",
    fullRuleText: "Direct withdrawal from labeled CEX entity >= $1,000 USD value.",
  },
  A4: {
    id: "A4",
    name: "Dormancy Wake",
    category: "ARMING",
    shortDescription: "Wallet inactive >= 30 days receives funding >= $500",
    fullRuleText: "Wallet inactive >= 30 days receives inbound funding >= $500 USD value.",
  },
  A5: {
    id: "A5",
    name: "Cluster Arming [ESCALATED]",
    category: "ARMING",
    shortDescription: ">= 2 cluster members armed within 48h (High Priority)",
    fullRuleText: ">= 2 wallets in the same cluster armed within a 48-hour window. Emits high-priority escalated cluster arming.",
  },
  A6: {
    id: "A6",
    name: "Consolidation",
    category: "ARMING",
    shortDescription: "Outflows from >= 2 tracked wallets converge to single address",
    fullRuleText: "Outflows from >= 2 tracked wallets converge to a single unlabelled recipient address within 24h.",
  },
  T1: {
    id: "T1",
    name: "Armed Entry",
    category: "TRIGGER",
    shortDescription: "Armed wallet buys memecoin <= 7 days old with >= $500",
    fullRuleText: "Armed wallet enters a memecoin position <= 7 days old with >= $500 USD position size.",
  },
  T2: {
    id: "T2",
    name: "Independent Co-Entry",
    category: "TRIGGER",
    shortDescription: ">= 2 independent wallets buy same token within 24h",
    fullRuleText: ">= 2 independent (unrelated) tracked wallets enter the same token within 24 hours.",
  },
  T3: {
    id: "T3",
    name: "Fresh-Launch Entry",
    category: "TRIGGER",
    shortDescription: "Entry into token within 1h of pair creation",
    fullRuleText: "Tracked wallet enters token within 1 hour of liquidity pair creation.",
  },
  T4: {
    id: "T4",
    name: "Add-On-Retrace",
    category: "TRIGGER",
    shortDescription: "Adding to position >= 20% down from local high",
    fullRuleText: "Wallet adds to an existing winning position >= 20% down from its local high.",
  },
  T5: {
    id: "T5",
    name: "Cluster Co-Entry",
    category: "TRIGGER",
    shortDescription: ">= 2 cluster members enter same token within 2h",
    fullRuleText: ">= 2 members of the same cluster enter the same token within a 2-hour window.",
  },
  C1: {
    id: "C1",
    name: "Distribution Prep",
    category: "EXIT_RISK",
    shortDescription: "Memecoin deposit to CEX by graded wallet",
    fullRuleText: "Graded wallet deposits a memecoin to a labeled CEX address (signals distribution preparation).",
  },
  C2: {
    id: "C2",
    name: "Co-Distribution",
    category: "EXIT_RISK",
    shortDescription: ">= 2 graded wallets selling same token within 12h",
    fullRuleText: ">= 2 graded wallets exit or sell the same token within a 12-hour window.",
  },
  C3: {
    id: "C3",
    name: "Moon Discipline",
    category: "EXIT_RISK",
    shortDescription: "Position >= 10x unrealized held > 3 days",
    fullRuleText: "Position reaches >= 10.0x unrealized multiple and is held > 3 days without taking profit.",
  },
  C4: {
    id: "C4",
    name: "Campaign Spent",
    category: "EXIT_RISK",
    shortDescription: "> 70% drop in stable balance from recent peak within 48h of trigger",
    fullRuleText: "Stablecoin balance drops > 70% from its post-arming peak within 48 hours of trigger.",
  },
};

export const EvidenceTxLinkObjectSchema = z.object({
  hash: z.string(),
  chain: z.string().optional(),
  url: z.string().optional(),
  label: z.string().optional(),
});

export const EvidenceTxLinkSchema = z.union([
  z.string(),
  EvidenceTxLinkObjectSchema,
]);

export const AlertEvidenceSchema = z.object({
  ruleId: z.string().min(1),
  ruleName: z.string().optional(),
  ruleText: z.string().min(1),
  thresholds: z.record(z.string(), z.unknown()).optional(),
  bindingArm: z.string().optional(),
  observed: z.record(z.string(), z.unknown()).optional(),
  windows: z.record(z.string(), z.unknown()).optional(),
  clusterContext: z
    .object({
      clusterId: z.string().optional(),
      clusterName: z.string().optional(),
      memberCount: z.number().optional(),
      sharedFunder: z.string().optional(),
    })
    .optional(),
  txLinks: z.array(EvidenceTxLinkSchema),
});

export const EVENT_DERIVED_RULES = new Set([
  "A1", "A2", "A3", "A4", "A5", "A6",
  "T1", "T2", "T3", "T4", "T5",
  "C1", "C2",
]);

export function isEventDerivedRule(ruleId: string): boolean {
  return EVENT_DERIVED_RULES.has(ruleId.toUpperCase());
}

export const EventAlertEvidenceSchema = AlertEvidenceSchema.extend({
  txLinks: z.array(EvidenceTxLinkSchema).min(1, "Event rules require at least 1 tx link"),
});

export type AlertEvidence = z.infer<typeof AlertEvidenceSchema>;

export type EvidenceValidationResult =
  | { success: true; data: AlertEvidence }
  | { success: false; error: string };

/**
 * Validates an alert evidence JSON blob.
 * FR-5.5 & P4-T09: requires ruleText and txLinks.
 * For event-derived rules, requires >= 1 txLink.
 * If missing ruleText or txLinks, returns failure with descriptive message.
 */
export function validateEvidence(raw: unknown): EvidenceValidationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, error: "missing ruleText / txLinks" };
  }

  const record = raw as Record<string, unknown>;
  if (!record.ruleText || typeof record.ruleText !== "string" || record.ruleText.trim() === "") {
    return { success: false, error: "missing ruleText / txLinks" };
  }

  if (!Array.isArray(record.txLinks)) {
    return { success: false, error: "missing ruleText / txLinks" };
  }

  const ruleId = typeof record.ruleId === "string" ? record.ruleId : "";
  if (ruleId && isEventDerivedRule(ruleId) && record.txLinks.length === 0) {
    return { success: false, error: "missing ruleText / txLinks: event rules require at least one txLink" };
  }

  const result = AlertEvidenceSchema.safeParse(raw);
  if (!result.success) {
    return { success: false, error: "missing ruleText / txLinks" };
  }

  return { success: true, data: result.data };
}

/**
 * Resolves an explorer URL for a given transaction hash or URL string.
 */
export function getTxExplorerUrl(hashOrUrl: string, chain: string = "base"): string {
  if (hashOrUrl.startsWith("http://") || hashOrUrl.startsWith("https://")) {
    return hashOrUrl;
  }
  const norm = chain.toLowerCase() as ChainSlug;
  const meta = CHAIN_REGISTRY[norm] ?? CHAIN_REGISTRY.base;
  return `${meta.explorerBaseUrl}/tx/${hashOrUrl}`;
}
