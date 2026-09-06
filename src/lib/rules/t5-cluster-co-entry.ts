// src/lib/rules/t5-cluster-co-entry.ts
import type { RuleContext, RuleFinding } from "./types";
import { buildDedupeKey } from "./dedupe";
import { ALERT_RULES_METADATA, getTxExplorerUrl } from "./evidence";
import { parseUsd } from "./guards";

/**
 * T5 Cluster Co-Entry:
 * >= t5MinWallets (default 2) wallets of the same cluster buy the same token within t5WindowHours (default 1h).
 * Fires TRIGGERED with payload flagged warningStyle: true and cross-referencing CLUSTER_CO_ENTRY group.
 */
export function evaluateT5ClusterCoEntry(ctx: RuleContext): RuleFinding[] {
  if (!ctx.cluster || !ctx.cluster.memberAddresses || ctx.cluster.memberAddresses.length === 0) {
    return [];
  }

  const windowHours = ctx.thresholds.t5WindowHours;
  const windowMs = windowHours * 3600 * 1000;
  const minWallets = ctx.thresholds.t5MinWallets;

  const clusterMemberSet = new Set(
    ctx.cluster.memberAddresses.map((m) => m.address.toLowerCase())
  );

  // Subject buys
  const subjectBuys = ctx.events.filter((e) => {
    if (e.kind !== "BUY" || !e.tokenAddress) return false;
    const t = e.timestamp.getTime();
    return t >= ctx.now.getTime() - windowMs && t <= ctx.now.getTime();
  });

  if (subjectBuys.length === 0) {
    return [];
  }

  const findings: RuleFinding[] = [];

  // Group subject buys by token
  const buysByToken = new Map<string, typeof subjectBuys>();
  for (const b of subjectBuys) {
    const tokenKey = b.tokenAddress!.toLowerCase();
    const list = buysByToken.get(tokenKey) ?? [];
    list.push(b);
    buysByToken.set(tokenKey, list);
  }

  for (const [tokenAddress, buys] of buysByToken.entries()) {
    // Look for cluster peers buying this token within window
    const clusterPeers = ctx.peerActivity.filter((p) => {
      if (p.tokenAddress.toLowerCase() !== tokenAddress) return false;
      if (p.kind !== "BUY") return false;
      const isMember =
        p.sameCluster || clusterMemberSet.has(p.wallet.address.toLowerCase());
      if (!isMember) return false;
      const t = p.at.getTime();
      return t >= ctx.now.getTime() - windowMs && t <= ctx.now.getTime();
    });

    const peerWallets = new Set(clusterPeers.map((p) => p.wallet.address.toLowerCase()));
    // Total distinct cluster wallets entering
    const totalClusterWallets = new Set([
      ctx.wallet.address.toLowerCase(),
      ...Array.from(peerWallets),
    ]);

    if (totalClusterWallets.size < minWallets) {
      continue;
    }

    const latestSubjectBuy = buys.reduce((latest, current) =>
      current.timestamp.getTime() > latest.timestamp.getTime() ? current : latest
    );
    const occurredAt = latestSubjectBuy.timestamp;
    const meta = ALERT_RULES_METADATA.T5;
    const txHash = latestSubjectBuy.txHash ?? "0xt5clustercoentry";

    const windowBucket = Math.floor(occurredAt.getTime() / windowMs);
    const clusterCoEntryGroupId = `cluster_co_entry_${tokenAddress}_${windowBucket}`;

    const dedupeKey = buildDedupeKey({
      type: "T5",
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
        label: `Cluster buy on ${b.tokenSymbol ?? "token"} ($${parseUsd(b.amountUsd)?.toFixed(2) ?? "0"})`,
      }));

    if (txLinks.length === 0) {
      txLinks.push({
        hash: txHash,
        url: getTxExplorerUrl(txHash, ctx.wallet.chain),
        label: `Cluster co-entry on ${latestSubjectBuy.tokenSymbol ?? "token"}`,
      });
    }

    findings.push({
      type: "T5",
      state: "TRIGGERED",
      occurredAt,
      token: {
        address: tokenAddress,
        chain: latestSubjectBuy.chain ?? ctx.wallet.chain,
        symbol: latestSubjectBuy.tokenSymbol ?? null,
      },
      amountUsd: latestSubjectBuy.amountUsd ?? null,
      clusterId: ctx.cluster.id,
      payload: {
        warningStyle: true,
        clusterId: ctx.cluster.id,
        clusterName: ctx.cluster.name,
        groupKind: "CLUSTER_CO_ENTRY",
        clusterCoEntryGroupId,
        tokenAddress,
        memberCount: totalClusterWallets.size,
        minWallets,
        windowHours,
        participants: Array.from(totalClusterWallets),
      },
      evidence: {
        ruleId: "T5",
        ruleText: meta.fullRuleText,
        thresholds: {
          minWallets,
          windowHours,
        },
        observed: {
          tokenAddress,
          clusterId: ctx.cluster.id,
          memberCount: totalClusterWallets.size,
          participants: Array.from(totalClusterWallets).join(", "),
          clusterCoEntryGroupId,
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
