import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";

const schemaPath = resolve(process.cwd(), "prisma/schema.prisma");
const migrationPath = resolve(process.cwd(), "prisma/migrations/0001_phase0_initial/migration.sql");
const generatedClientPath = resolve(process.cwd(), "src/generated/prisma/client.ts");

const schema = readFileSync(schemaPath, "utf8");
const migration = readFileSync(migrationPath, "utf8");
const generatedClient = readFileSync(generatedClientPath, "utf8");

const compileEveryModelQuery = (client: PrismaClient) => ({
  wallet: client.wallet.findFirst(),
  walletProfile: client.walletProfile.findFirst(),
  entityLabel: client.entityLabel.findFirst(),
  transaction: client.transaction.findFirst(),
  token: client.token.findFirst(),
  priceSnapshot: client.priceSnapshot.findFirst(),
  nativePriceSnapshot: client.nativePriceSnapshot.findFirst(),
  syncState: client.syncState.findFirst(),
  balanceSnapshot: client.balanceSnapshot.findFirst(),
  dailyFlow: client.dailyFlow.findFirst(),
  fundingEdge: client.fundingEdge.findFirst(),
  fundingNode: client.fundingNode.findFirst(),
  cluster: client.cluster.findFirst(),
  clusterMember: client.clusterMember.findFirst(),
  clusterRotation: client.clusterRotation.findFirst(),
  interactionEdge: client.interactionEdge.findFirst(),
  interactionEdgeToken: client.interactionEdgeToken.findFirst(),
  walletRelation: client.walletRelation.findFirst(),
  movementEvent: client.movementEvent.findFirst(),
  movementGroup: client.movementGroup.findFirst(),
  movementGroupMember: client.movementGroupMember.findFirst(),
  walletState: client.walletState.findFirst(),
  alertEvent: client.alertEvent.findFirst(),
  position: client.position.findFirst(),
  userTrade: client.userTrade.findFirst(),
  setting: client.setting.findFirst(),
  jobRun: client.jobRun.findFirst(),
  apiUsageDaily: client.apiUsageDaily.findFirst(),
  providerCacheEntry: client.providerCacheEntry.findFirst(),
});

void compileEveryModelQuery;

const modelNames = [
  "Wallet", "WalletProfile", "EntityLabel", "Transaction", "Token", "PriceSnapshot",
  "NativePriceSnapshot", "SyncState", "BalanceSnapshot", "DailyFlow", "FundingEdge",
  "FundingNode", "Cluster", "ClusterMember", "ClusterRotation", "InteractionEdge",
  "InteractionEdgeToken", "WalletRelation", "MovementEvent", "MovementGroup",
  "MovementGroupMember", "WalletState", "AlertEvent", "Position", "UserTrade", "Setting",
  "JobRun", "ApiUsageDaily", "ProviderCacheEntry",
] as const;

describe("Prisma schema contract", () => {
  it("exports every SRS entity from the generated client with documented fields", () => {
    for (const modelName of modelNames) {
      expect(generatedClient).toContain(`export type ${modelName} = Prisma.${modelName}Model`);
      const model = schema.match(new RegExp(`model ${modelName} \\{([\\s\\S]*?)\\n\\}`))?.[1];
      expect(model, `${modelName} model is present`).toBeDefined();
      expect(model?.split("\n").some((line) => /^\s+[A-Za-z][A-Za-z0-9]*\s+/.test(line))).toBe(true);
    }
  });

  it("preserves the Transaction natural key", () => {
    expect(schema).toContain("@@unique([chain, hash, kind, ordinal], name: \"tx_natural_key\")");
    expect(migration).toContain('"Transaction_chain_hash_kind_ordinal_key"');
  });

  it("contains all five mandated indexes", () => {
    const indexes = [
      '"Transaction_fromAddress_timestamp_idx"',
      '"Transaction_toAddress_timestamp_idx"',
      '"Transaction_tokenAddress_timestamp_idx"',
      '"AlertEvent_createdAt_idx"',
      '"MovementGroup_tokenAddress_windowStart_idx"',
    ];
    for (const index of indexes) expect(migration).toContain(index);
  });

  it("uses the Wallet composite primary key and no Float columns", () => {
    expect(schema).toContain("@@id([address, chain])");
    expect(schema).not.toMatch(/\bFloat\b/);
  });
});
