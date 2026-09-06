import { prisma as defaultPrisma } from "@/server/db/client";
import { Prisma, type PrismaClient, type AlertEvent } from "@/generated/prisma/client";
import type { RuleFinding } from "@/lib/rules/types";
import { validateEvidence } from "@/lib/rules/evidence";
import { chainSlugToPrisma, normalizeAddress } from "@/server/services/wallet/normalize";

export interface PersistAlertsResult {
  alertsCreated: number;
  alertsSuppressed: number;
  createdAlerts: AlertEvent[];
}

/**
 * Persists rule findings idempotently into AlertEvent.
 * Deduplicates both within the batch and against existing rows by dedupeKey.
 * Validates each finding's evidence against AlertEvidenceSchema.
 */
export async function persistAlerts(
  findings: RuleFinding[],
  injectedPrisma?: PrismaClient
): Promise<PersistAlertsResult> {
  if (findings.length === 0) {
    return {
      alertsCreated: 0,
      alertsSuppressed: 0,
      createdAlerts: [],
    };
  }

  const prisma = injectedPrisma ?? defaultPrisma;

  // 1. Validate evidence for all findings
  for (const finding of findings) {
    const valResult = validateEvidence(finding.evidence);
    if (!valResult.success) {
      throw new Error(
        `Invalid evidence for alert ${finding.type} (${finding.dedupeKey}): ${valResult.error}`
      );
    }
  }

  // 2. Dedupe within batch
  const uniqueInBatch: RuleFinding[] = [];
  const seenBatchKeys = new Set<string>();
  let batchSuppressed = 0;

  for (const f of findings) {
    if (seenBatchKeys.has(f.dedupeKey)) {
      batchSuppressed++;
    } else {
      seenBatchKeys.add(f.dedupeKey);
      uniqueInBatch.push(f);
    }
  }

  // 3. Find existing alerts in DB matching candidate dedupeKeys
  const candidateKeys = uniqueInBatch.map((f) => f.dedupeKey);
  const existingAlerts = await prisma.alertEvent.findMany({
    where: {
      dedupeKey: { in: candidateKeys },
    },
    select: {
      dedupeKey: true,
    },
  });

  const existingKeySet = new Set(existingAlerts.map((a) => a.dedupeKey));
  const toInsert = uniqueInBatch.filter((f) => !existingKeySet.has(f.dedupeKey));
  const dbSuppressed = uniqueInBatch.length - toInsert.length;
  const alertsSuppressed = batchSuppressed + dbSuppressed;

  if (toInsert.length === 0) {
    return {
      alertsCreated: 0,
      alertsSuppressed,
      createdAlerts: [],
    };
  }

  // 4. Prepare data payloads
  const dataRows: Prisma.AlertEventCreateManyInput[] = toInsert.map((f) => {
    const rawWallet = (typeof f.payload.walletAddress === "string" ? f.payload.walletAddress : f.dedupeKey.split(":")[1]) || "0x0000000000000000000000000000000000000000";
    const rawChain = f.token?.chain ?? f.dedupeKey.split(":")[2] ?? "base";
    return {
      walletAddress: normalizeAddress(rawWallet),
      walletChain: chainSlugToPrisma(rawChain),
      type: f.type,
      state: f.state,
      tokenAddress: f.token?.address ? normalizeAddress(f.token.address) : null,
      tokenChain: f.token?.chain ? chainSlugToPrisma(f.token.chain) : null,
      tokenSymbol: f.token?.symbol ?? null,
      amountUsd: f.amountUsd ? new Prisma.Decimal(f.amountUsd) : null,
      clusterId: f.clusterId ?? null,
      payloadJson: f.payload as Prisma.InputJsonValue,
      evidenceJson: f.evidence as unknown as Prisma.InputJsonValue,
      dedupeKey: f.dedupeKey,
      occurredAt: f.occurredAt,
    };
  });

  // 5. Insert with ON CONFLICT DO NOTHING (skipDuplicates: true)
  if (typeof prisma.alertEvent.createMany === "function") {
    await prisma.alertEvent.createMany({
      data: dataRows,
      skipDuplicates: true,
    });
  } else {
    // Fallback for in-memory mocks that only support create
    for (const row of dataRows) {
      await prisma.alertEvent.create({
        data: row as unknown as Prisma.AlertEventCreateInput,
      });
    }
  }

  // 6. Query newly created rows
  const createdAlerts = await prisma.alertEvent.findMany({
    where: {
      dedupeKey: { in: toInsert.map((f) => f.dedupeKey) },
    },
  });

  return {
    alertsCreated: toInsert.length,
    alertsSuppressed,
    createdAlerts,
  };
}
