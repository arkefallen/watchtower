// src/lib/rules/t2-independent-co-entry.ts
import type { RuleContext, RuleFinding } from "./types";
import { buildDedupeKey } from "./dedupe";
import { ALERT_RULES_METADATA, getTxExplorerUrl } from "./evidence";
import { parseUsd } from "./guards";
import { isWalletGraded } from "./graded";

/**
 * T2 Independent Co-Entry:
 * >= t2MinWallets (default 2) mutually independent graded wallets buy the same token within t2WindowHours (default 24h).
 * Uses gradedDefinition to verify wallet qualification.
 * Cross-references the co-accumulation group id.
 * Fires TRIGGERED.
 */
export function evaluateT2IndependentCoEntry(ctx: RuleContext): RuleFinding[] {
  const gradedDef = ctx.gradedDefinition ?? ctx.thresholds.gradedDefinition ?? "ANY_TAG_OR_COMPUTED";
  // Subject wallet must qualify as graded
  if (!isWalletGraded(ctx.wallet, gradedDef)) {
    return [];
  }

  const windowHours = ctx.thresholds.t2WindowHours;
  const windowMs = windowHours * 3600 * 1000;
  const minWallets = ctx.thresholds.t2MinWallets;

  // Find subject BUY events in lookback
  const subjectBuys = ctx.events.filter((e) => {
    if (e.kind !== "BUY" || !e.tokenAddress) return false;
    const t = e.timestamp.getTime();
    return t >= ctx.now.getTime() - windowMs && t <= ctx.now.getTime();
  });

  if (subjectBuys.length === 0) {
    return [];
  }

  const findings: RuleFinding[] = [];

  // Group by token address
  const buysByToken = new Map<string, typeof subjectBuys>();
  for (const b of subjectBuys) {
    const tokenKey = b.tokenAddress!.toLowerCase();
    const list = buysByToken.get(tokenKey) ?? [];
    list.push(b);
    buysByToken.set(tokenKey, list);
  }

  for (const [tokenAddress, buys] of buysByToken.entries()) {
    // Look for matching independent graded peers buying this token in window
    const eligiblePeers = ctx.peerActivity.filter((p) => {
      if (p.tokenAddress.toLowerCase() !== tokenAddress) return false;
      if (p.kind !== "BUY") return false;
      // Peer must be graded
      if (!p.hasGrade) return false;
      // Peer must be mutually independent of subject (no shared funder, direct transfer, or same cluster)
      if (!p.independentOfSubject || p.sameCluster) return false;
      const t = p.at.getTime();
      return t >= ctx.now.getTime() - windowMs && t <= ctx.now.getTime();
    });

    // Unique independent graded peer wallets
    const peerWallets = new Set(eligiblePeers.map((p) => p.wallet.address.toLowerCase()));
    const totalParticipantCount = 1 + peerWallets.size; // Subject + distinct independent peers

    if (totalParticipantCount < minWallets) {
      continue;
    }

    const latestSubjectBuy = buys.reduce((latest, current) =>
      current.timestamp.getTime() > latest.timestamp.getTime() ? current : latest
    );
    const occurredAt = latestSubjectBuy.timestamp;
    const meta = ALERT_RULES_METADATA.T2;
    const txHash = latestSubjectBuy.txHash ?? "0xt2coentry";

    const windowBucket = Math.floor(occurredAt.getTime() / windowMs);
    const coAccGroupId = `co_acc_${tokenAddress}_${windowBucket}`;

    const dedupeKey = buildDedupeKey({
      type: "T2",
      walletAddress: ctx.wallet.address,
      chain: ctx.wallet.chain,
      tokenAddress,
      occurredAt,
      windowHours,
    });

    const txLinks = buys
      .filter((b) => Boolean(b.txHash))
      .map((b) => ({
        hash: b.txHash!,
        url: getTxExplorerUrl(b.txHash!, b.chain ?? ctx.wallet.chain),
        label: `Co-entry buy on ${b.tokenSymbol ?? "token"} ($${parseUsd(b.amountUsd)?.toFixed(2) ?? "0"})`,
      }));

    if (txLinks.length === 0) {
      txLinks.push({
        hash: txHash,
        url: getTxExplorerUrl(txHash, ctx.wallet.chain),
        label: `Independent co-entry buy on ${latestSubjectBuy.tokenSymbol ?? "token"}`,
      });
    }

    findings.push({
      type: "T2",
      state: "TRIGGERED",
      occurredAt,
      token: {
        address: tokenAddress,
        chain: latestSubjectBuy.chain ?? ctx.wallet.chain,
        symbol: latestSubjectBuy.tokenSymbol ?? null,
      },
      amountUsd: latestSubjectBuy.amountUsd ?? null,
      clusterId: ctx.cluster?.id ?? null,
      payload: {
        tokenAddress,
        participantCount: totalParticipantCount,
        minWallets,
        windowHours,
        coAccumulationGroupId: coAccGroupId,
        participants: [ctx.wallet.address.toLowerCase(), ...Array.from(peerWallets)],
      },
      evidence: {
        ruleId: "T2",
        ruleText: meta.fullRuleText,
        thresholds: {
          minWallets,
          windowHours,
        },
        observed: {
          tokenAddress,
          participantCount: totalParticipantCount,
          participants: [ctx.wallet.address.toLowerCase(), ...Array.from(peerWallets)].join(", "),
          coAccumulationGroupId: coAccGroupId,
        },
        txLinks,
        windows: {
          window: `${windowHours}h`,
        },
      },
      dedupeKey,
    });
  }

  return findings;
}
