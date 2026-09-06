// src/lib/rules/a5-cluster-arming.ts
import type { RuleContext, RuleFinding } from "./types";
import { buildDedupeKey } from "./dedupe";
import { ALERT_RULES_METADATA, getTxExplorerUrl } from "./evidence";

/**
 * A5 Cluster Arming (Escalated):
 * >= a5MinWallets (default 2) in the same cluster funded by the same funder within a5WindowHours (default 48h).
 * Emits a single cluster-level ARMED alert flagged for escalated, highest-priority treatment.
 * Deduped per (cluster, funder, window bucket) so one coordinated funding wave produces one alert, not one per member.
 */
export function evaluateA5ClusterArming(ctx: RuleContext): RuleFinding[] {
  if (!ctx.cluster || !ctx.cluster.memberAddresses || ctx.cluster.memberAddresses.length === 0) {
    return [];
  }

  const windowHours = ctx.thresholds.a5WindowHours;
  const windowMs = windowHours * 3600 * 1000;
  const minWallets = ctx.thresholds.a5MinWallets;

  const clusterMemberSet = new Set(
    ctx.cluster.memberAddresses.map((m) => m.address.toLowerCase())
  );

  // Group funding events by funder
  const funderMap = new Map<
    string,
    Array<{
      recipient: string;
      at: Date;
      amountUsd: string | null;
      txHash?: string;
    }>
  >();

  for (const f of ctx.fundingEvents) {
    const recipient = (f.to ?? ctx.wallet.address).toLowerCase();
    // Must be a member of this cluster
    if (!clusterMemberSet.has(recipient)) continue;

    const t = f.at.getTime();
    if (t < ctx.now.getTime() - windowMs || t > ctx.now.getTime()) continue;

    const funderKey = f.from.toLowerCase();
    const list = funderMap.get(funderKey) ?? [];
    list.push({
      recipient,
      at: f.at,
      amountUsd: f.amountUsd,
      txHash: f.txHash,
    });
    funderMap.set(funderKey, list);
  }

  const findings: RuleFinding[] = [];

  for (const [funder, fundings] of funderMap.entries()) {
    // Sort chronologically
    fundings.sort((a, b) => a.at.getTime() - b.at.getTime());

    // Check if time gap between first and last within window <= windowMs
    const distinctMembers = new Set(fundings.map((f) => f.recipient));
    if (distinctMembers.size < minWallets) {
      continue;
    }

    const minTime = fundings[0].at.getTime();
    const maxTime = fundings[fundings.length - 1].at.getTime();
    if (maxTime - minTime > windowMs) {
      // Gap between events exceeds window
      continue;
    }

    const latestEvent = fundings[fundings.length - 1];
    const occurredAt = latestEvent.at;
    const meta = ALERT_RULES_METADATA.A5;

    const txLinks = fundings
      .filter((f) => Boolean(f.txHash))
      .map((f) => ({
        hash: f.txHash!,
        url: getTxExplorerUrl(f.txHash!, ctx.wallet.chain),
        label: `Funding to ${f.recipient.slice(0, 8)}... by ${funder.slice(0, 8)}...`,
      }));

    if (txLinks.length === 0) {
      txLinks.push({
        hash: "0xclusterfunding",
        url: getTxExplorerUrl("0xclusterfunding", ctx.wallet.chain),
        label: `Cluster arming: ${distinctMembers.size} members funded by ${funder.slice(0, 8)}...`,
      });
    }

    // Dedupe key keyed on cluster ID and funder so that all member evaluations yield the same dedupeKey
    const dedupeKey = buildDedupeKey({
      type: "A5",
      walletAddress: ctx.cluster.id,
      chain: ctx.wallet.chain,
      tokenAddress: funder,
      occurredAt,
      windowHours,
    });

    findings.push({
      type: "A5",
      state: "ARMED",
      occurredAt,
      token: null,
      amountUsd: null,
      clusterId: ctx.cluster.id,
      payload: {
        escalated: true,
        highestPriority: true,
        clusterId: ctx.cluster.id,
        clusterName: ctx.cluster.name,
        sharedFunder: funder,
        fundedMemberCount: distinctMembers.size,
        fundedMembers: Array.from(distinctMembers),
        windowHours,
      },
      evidence: {
        ruleId: "A5",
        ruleText: meta.fullRuleText,
        thresholds: {
          minWallets,
          windowHours,
        },
        observed: {
          clusterId: ctx.cluster.id,
          sharedFunder: funder,
          fundedMemberCount: distinctMembers.size,
          fundedMembers: Array.from(distinctMembers).join(", "),
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
