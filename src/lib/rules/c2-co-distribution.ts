// src/lib/rules/c2-co-distribution.ts
import type { RuleContext, RuleFinding } from "./types";
import { buildDedupeKey } from "./dedupe";
import { ALERT_RULES_METADATA, getTxExplorerUrl } from "./evidence";
import { parseUsd } from "./guards";
import { isWalletGraded } from "./graded";

/**
 * C2 Co-Distribution:
 * >= c2MinWallets (default 2) graded wallets produce SELL or CEX_DEPOSIT on the same token within c2WindowHours (default 12h).
 * Emits EXIT_RISK for each participant, cross-referencing CO_DISTRIBUTION group.
 */
export function evaluateC2CoDistribution(ctx: RuleContext): RuleFinding[] {
  const gradedDef = ctx.gradedDefinition ?? ctx.thresholds.gradedDefinition ?? "ANY_TAG_OR_COMPUTED";
  if (!isWalletGraded(ctx.wallet, gradedDef)) {
    return [];
  }

  const windowHours = ctx.thresholds.c2WindowHours;
  const windowMs = windowHours * 3600 * 1000;
  const minWallets = ctx.thresholds.c2MinWallets;

  // Subject exit events (SELL or CEX_DEPOSIT)
  const subjectExits = ctx.events.filter((e) => {
    if (e.kind !== "SELL" && e.kind !== "CEX_DEPOSIT") return false;
    if (!e.tokenAddress) return false;
    const t = e.timestamp.getTime();
    return t >= ctx.now.getTime() - windowMs && t <= ctx.now.getTime();
  });

  if (subjectExits.length === 0) {
    return [];
  }

  const findings: RuleFinding[] = [];

  // Group by token
  const exitsByToken = new Map<string, typeof subjectExits>();
  for (const x of subjectExits) {
    const tokenKey = x.tokenAddress!.toLowerCase();
    const list = exitsByToken.get(tokenKey) ?? [];
    list.push(x);
    exitsByToken.set(tokenKey, list);
  }

  for (const [tokenAddress, exits] of exitsByToken.entries()) {
    // Peers exiting this token within window
    const exitPeers = ctx.peerActivity.filter((p) => {
      if (p.tokenAddress.toLowerCase() !== tokenAddress) return false;
      if (p.kind !== "SELL" && p.kind !== "CEX_DEPOSIT") return false;
      if (!p.hasGrade) return false;
      const t = p.at.getTime();
      return t >= ctx.now.getTime() - windowMs && t <= ctx.now.getTime();
    });

    const peerWallets = new Set(exitPeers.map((p) => p.wallet.address.toLowerCase()));
    const totalParticipantCount = 1 + peerWallets.size;

    if (totalParticipantCount < minWallets) {
      continue;
    }

    const latestSubjectExit = exits.reduce((latest, current) =>
      current.timestamp.getTime() > latest.timestamp.getTime() ? current : latest
    );
    const occurredAt = latestSubjectExit.timestamp;
    const meta = ALERT_RULES_METADATA.C2;
    const txHash = latestSubjectExit.txHash ?? "0xc2codistribution";

    const windowBucket = Math.floor(occurredAt.getTime() / windowMs);
    const coDistGroupId = `co_dist_${tokenAddress}_${windowBucket}`;

    const dedupeKey = buildDedupeKey({
      type: "C2",
      walletAddress: ctx.wallet.address,
      chain: ctx.wallet.chain,
      tokenAddress,
      occurredAt,
      windowHours,
    });

    const txLinks = exits
      .filter((x) => Boolean(x.txHash))
      .map((x) => ({
        hash: x.txHash!,
        url: getTxExplorerUrl(x.txHash!, x.chain ?? ctx.wallet.chain),
        label: `Exit (${x.kind}) on ${x.tokenSymbol ?? "token"} ($${parseUsd(x.amountUsd)?.toFixed(2) ?? "0"})`,
      }));

    if (txLinks.length === 0) {
      txLinks.push({
        hash: txHash,
        url: getTxExplorerUrl(txHash, ctx.wallet.chain),
        label: `Co-distribution exit on ${latestSubjectExit.tokenSymbol ?? "token"}`,
      });
    }

    findings.push({
      type: "C2",
      state: "EXIT_RISK",
      occurredAt,
      token: {
        address: tokenAddress,
        chain: latestSubjectExit.chain ?? ctx.wallet.chain,
        symbol: latestSubjectExit.tokenSymbol ?? null,
      },
      amountUsd: latestSubjectExit.amountUsd ?? null,
      clusterId: ctx.cluster?.id ?? null,
      payload: {
        tokenAddress,
        participantCount: totalParticipantCount,
        minWallets,
        windowHours,
        coDistributionGroupId: coDistGroupId,
        participants: [ctx.wallet.address.toLowerCase(), ...Array.from(peerWallets)],
      },
      evidence: {
        ruleId: "C2",
        ruleText: meta.fullRuleText,
        thresholds: {
          minWallets,
          windowHours,
        },
        observed: {
          tokenAddress,
          participantCount: totalParticipantCount,
          participants: [ctx.wallet.address.toLowerCase(), ...Array.from(peerWallets)].join(", "),
          coDistributionGroupId: coDistGroupId,
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
