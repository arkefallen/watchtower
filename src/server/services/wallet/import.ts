import crypto from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import type { ChainSlug } from "@/lib/chains/types";
import { normalizeAddress, normalizeChain, chainSlugToPrisma, InvalidAddressError } from "./normalize";

export interface ParsedImportEntry {
  lineNumber: number;
  address: `0x${string}`;
  chain: ChainSlug;
  label?: string;
}

export interface ParseImportBatchResult {
  entries: ParsedImportEntry[];
  duplicates: Array<{ lineNumber: number; address: string; chain: string; reason: string }>;
  invalid: Array<{ lineNumber: number; line: string; reason: string }>;
  acceptedCount: number;
}

export function parseImportBatch(rawText: string, defaultChain: string = "base"): ParseImportBatchResult {
  const lines = rawText.split(/\r?\n/);
  const entries: ParsedImportEntry[] = [];
  const duplicates: Array<{ lineNumber: number; address: string; chain: string; reason: string }> = [];
  const invalid: Array<{ lineNumber: number; line: string; reason: string }> = [];
  const seenKeys = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const line = lines[i].trim();

    // Skip empty lines and comment lines
    if (!line || line.startsWith("#") || line.startsWith("//")) {
      continue;
    }

    const parts = line.split(",").map((s) => s.trim());
    const rawAddress = parts[0];
    const rawChain = parts[1] ? parts[1] : defaultChain;
    const label = parts.slice(2).join(",").trim() || undefined;

    let address: `0x${string}`;
    try {
      address = normalizeAddress(rawAddress);
    } catch (err: any) {
      invalid.push({
        lineNumber,
        line,
        reason: err?.message ?? String(err),
      });
      continue;
    }

    let chain: ChainSlug;
    try {
      chain = normalizeChain(rawChain);
    } catch (err: any) {
      invalid.push({
        lineNumber,
        line,
        reason: err?.message ?? String(err),
      });
      continue;
    }

    const dedupeKey = `${chain}:${address}`;
    if (seenKeys.has(dedupeKey)) {
      duplicates.push({
        lineNumber,
        address,
        chain,
        reason: "Duplicate address and chain in same import batch",
      });
      continue;
    }

    seenKeys.add(dedupeKey);
    entries.push({
      lineNumber,
      address,
      chain,
      label,
    });
  }

  return {
    entries,
    duplicates,
    invalid,
    acceptedCount: entries.length,
  };
}

export interface ProcessImportBatchDeps {
  prisma: PrismaClient;
  defaultChain?: string;
  batchId?: string;
  queues?: {
    intake?: {
      add: (name: string, data: any, opts?: any) => Promise<any>;
    };
    sync?: {
      add: (name: string, data: any, opts?: any) => Promise<any>;
    };
  };
}

export interface ProcessImportBatchResult {
  batchId: string;
  total: number;
  accepted: number;
  existing: number;
  duplicates: number;
  invalid: number;
  errors: Array<{ lineNumber: number; line: string; reason: string }>;
}

export async function processImportBatch(
  rawText: string,
  deps: ProcessImportBatchDeps
): Promise<ProcessImportBatchResult> {
  const { prisma, defaultChain = "base", queues } = deps;
  const batchId = deps.batchId ?? `import_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  const parsed = parseImportBatch(rawText, defaultChain);
  if (parsed.entries.length === 0) {
    return {
      batchId,
      total: parsed.entries.length + parsed.duplicates.length + parsed.invalid.length,
      accepted: 0,
      existing: 0,
      duplicates: parsed.duplicates.length,
      invalid: parsed.invalid.length,
      errors: parsed.invalid,
    };
  }

  // Check which wallets already exist in database
  const queryConditions = parsed.entries.map((e) => ({
    address: e.address,
    chain: chainSlugToPrisma(e.chain),
  }));

  const existingWallets = await prisma.wallet.findMany({
    where: {
      OR: queryConditions,
    },
    select: {
      address: true,
      chain: true,
    },
  });

  const existingSet = new Set(
    existingWallets.map((w) => `${w.chain.toLowerCase()}:${w.address.toLowerCase()}`)
  );

  let existingCount = 0;

  for (const entry of parsed.entries) {
    const prismaChain = chainSlugToPrisma(entry.chain);
    const isExisting = existingSet.has(`${entry.chain}:${entry.address}`);

    if (isExisting) {
      existingCount++;
      if (entry.label) {
        await prisma.wallet.update({
          where: {
            address_chain: {
              address: entry.address,
              chain: prismaChain,
            },
          },
          data: { label: entry.label },
        });
      }

      // Existing wallet triggers incremental sync, not intake
      const syncJobId = `sync:${entry.chain}:${entry.address}:${Date.now()}`;
      if (queues?.sync) {
        await queues.sync.add(
          "walletSync",
          {
            address: entry.address,
            chain: entry.chain,
            reason: "USER",
          },
          { jobId: syncJobId }
        );

        await prisma.jobRun.upsert({
          where: { id: syncJobId },
          create: {
            id: syncJobId,
            queueName: "watchtower.sync",
            jobName: "walletSync",
            payloadJson: {
              address: entry.address,
              chain: entry.chain,
              reason: "USER",
              importBatchId: batchId,
            },
            status: "QUEUED",
          },
          update: {},
        });
      }
    } else {
      // New wallet: create wallet + syncState + enqueue intake
      await prisma.wallet.upsert({
        where: {
          address_chain: {
            address: entry.address,
            chain: prismaChain,
          },
        },
        create: {
          address: entry.address,
          chain: prismaChain,
          label: entry.label,
        },
        update: {
          label: entry.label !== undefined ? entry.label : undefined,
        },
      });

      await prisma.syncState.upsert({
        where: {
          walletAddress_chain: {
            walletAddress: entry.address,
            chain: prismaChain,
          },
        },
        create: {
          walletAddress: entry.address,
          chain: prismaChain,
          status: "NEVER_SYNCED",
        },
        update: {},
      });

      const intakeJobId = `intake:${entry.chain}:${entry.address}`;
      if (queues?.intake) {
        await queues.intake.add(
          "walletIntake",
          {
            address: entry.address,
            chain: entry.chain,
            requestedBy: "IMPORT",
            importBatchId: batchId,
            forceFullResync: false,
          },
          { jobId: intakeJobId }
        );

        await prisma.jobRun.upsert({
          where: { id: intakeJobId },
          create: {
            id: intakeJobId,
            queueName: "watchtower.intake",
            jobName: "walletIntake",
            payloadJson: {
              address: entry.address,
              chain: entry.chain,
              requestedBy: "IMPORT",
              importBatchId: batchId,
            },
            status: "QUEUED",
          },
          update: {
            status: "QUEUED",
            error: null,
          },
        });
      }
    }
  }

  return {
    batchId,
    total: parsed.entries.length + parsed.duplicates.length + parsed.invalid.length,
    accepted: parsed.entries.length,
    existing: existingCount,
    duplicates: parsed.duplicates.length,
    invalid: parsed.invalid.length,
    errors: parsed.invalid,
  };
}
