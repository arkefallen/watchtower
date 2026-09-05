import { describe, expect, it } from "vitest";

import {
  createEntityService,
  type EntityLabelRow,
  type EntityServiceDependencies,
} from "@/server/services/entity";

const baseRow = (overrides: Partial<EntityLabelRow> = {}): EntityLabelRow => ({
  address: "0x0000000000000000000000000000000000000001",
  chain: "BASE",
  kind: "CEX",
  name: "Example CEX",
  source: "BUNDLED",
  isTerminal: true,
  notes: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  ...overrides,
});

function fakeDependencies(rows: EntityLabelRow[]): EntityServiceDependencies {
  return {
    entityLabel: {
      findUnique: async ({ where }) => rows.find((row) => row.address === where.address_chain.address && row.chain === where.address_chain.chain) ?? null,
      findMany: async ({ where }) => rows.filter((row) => where.OR.some((item) => row.address === item.address && row.chain === item.chain)),
      upsert: async ({ where, create, update }) => {
        const existing = rows.find((row) => row.address === where.address_chain.address && row.chain === where.address_chain.chain);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const created = baseRow({ ...create, notes: create.notes ?? null });
        rows.push(created);
        return created;
      },
    },
  };
}

describe("entity service", () => {
  it("batches lookupMany and returns keyed rows", async () => {
    const rows = [baseRow()];
    const service = createEntityService(fakeDependencies(rows));
    const result = await service.lookupMany([{ address: rows[0].address, chain: "base" }]);
    expect(result.get(`base:${rows[0].address}`)?.name).toBe("Example CEX");
  });

  it("does not overwrite USER rows during bundled seeding", async () => {
    const rows = [baseRow({ source: "USER", name: "My Label" })];
    const service = createEntityService(fakeDependencies(rows));
    await service.seedBundled([{ address: rows[0].address, chain: "base", kind: "ROUTER", name: "Bundled", isTerminal: true }]);
    expect(rows[0].name).toBe("My Label");
  });

  it("forces HUMAN labels to remain non-terminal", async () => {
    const rows: EntityLabelRow[] = [];
    const service = createEntityService(fakeDependencies(rows));
    const row = await service.upsertUserLabel({ address: "0x0000000000000000000000000000000000000002", chain: "base", kind: "HUMAN", name: "Person", isTerminal: true });
    expect(row.isTerminal).toBe(false);
  });
});
