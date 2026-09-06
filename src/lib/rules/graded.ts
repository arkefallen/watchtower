// src/lib/rules/graded.ts
import type { GradedDefinition } from "@/lib/settings-schema";

export interface GradedWalletCandidate {
  hasGrade?: boolean;
  edgeTags?: string[];
  styleTags?: string[];
  sizeTags?: string[];
  tags?: string[];
  computedGrade?: string | null;
  gradeLabel?: string | null;
  sampleCount?: number;
  minSample?: number;
}

/**
 * Resolves whether a wallet qualifies as 'graded' under the active GradedDefinition setting:
 * - ANY_TAG_OR_COMPUTED (default): Any manual edge/style/size tag, or a computed grade with sufficient sample.
 * - EDGE_TAG_ONLY: Requires a manual edge tag only; rejects style-only, size-only, and computed-only wallets.
 */
export function isWalletGraded(
  wallet: GradedWalletCandidate,
  definition: GradedDefinition = "ANY_TAG_OR_COMPUTED"
): boolean {
  const edgeTags = [
    ...(wallet.edgeTags ?? []),
    ...(wallet.tags?.filter((t) => t.startsWith("edge:") || ["INSIDER", "KOL", "DEV", "SNIPER", "SMART_MONEY"].includes(t.toUpperCase())) ?? []),
  ];
  const hasEdgeTag = edgeTags.length > 0;

  if (definition === "EDGE_TAG_ONLY") {
    return hasEdgeTag;
  }

  // ANY_TAG_OR_COMPUTED
  const styleTags = [
    ...(wallet.styleTags ?? []),
    ...(wallet.tags?.filter((t) => t.startsWith("style:") || ["SCALPER", "SWING", "HODLER", "ROTATOR"].includes(t.toUpperCase())) ?? []),
  ];
  const hasStyleTag = styleTags.length > 0;

  const sizeTags = [
    ...(wallet.sizeTags ?? []),
    ...(wallet.tags?.filter((t) => t.startsWith("size:") || ["WHALE", "SHARK", "DOLPHIN", "FISH"].includes(t.toUpperCase())) ?? []),
  ];
  const hasSizeTag = sizeTags.length > 0;

  const hasAnyManualTag = hasEdgeTag || hasStyleTag || hasSizeTag;

  const minSample = wallet.minSample ?? 10;
  const sampleCount = wallet.sampleCount ?? 0;
  const hasComputed = Boolean(wallet.computedGrade || wallet.gradeLabel);
  const hasComputedGradeWithSample = hasComputed && sampleCount >= minSample;

  if (hasAnyManualTag || hasComputedGradeWithSample) {
    return true;
  }

  return Boolean(wallet.hasGrade);
}
