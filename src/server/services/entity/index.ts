import type { Chain, EntityKind, EntityLabel, LabelSource } from "../../../generated/prisma/client";

export type ChainSlug = "base" | "bsc" | "robinhood";
export type EntityKindSlug = "CEX" | "BRIDGE" | "ROUTER" | "CONTRACT" | "HUMAN";
export type EntityLabelRow = EntityLabel;

type EntityDelegate = {
  findUnique: (args: { where: { address_chain: { address: string; chain: Chain } } }) => Promise<EntityLabelRow | null>;
  findMany: (args: { where: { OR: Array<{ address: string; chain: Chain }> } }) => Promise<EntityLabelRow[]>;
  upsert: (args: {
    where: { address_chain: { address: string; chain: Chain } };
    create: { address: string; chain: Chain; kind: EntityKind; name: string; source: LabelSource; isTerminal: boolean; notes?: string };
    update: { kind?: EntityKind; name?: string; isTerminal?: boolean; notes?: string };
  }) => Promise<EntityLabelRow>;
};

export type EntityServiceDependencies = { entityLabel: EntityDelegate };

const chainMap: Record<ChainSlug, Chain> = {
  base: "BASE",
  bsc: "BSC",
  robinhood: "ROBINHOOD",
};

const kindMap: Record<EntityKindSlug, EntityKind> = {
  CEX: "CEX",
  BRIDGE: "BRIDGE",
  ROUTER: "ROUTER",
  CONTRACT: "CONTRACT",
  HUMAN: "HUMAN",
};

const terminalKinds = new Set<EntityKindSlug>(["CEX", "BRIDGE", "ROUTER", "CONTRACT"]);

function key(address: string, chain: ChainSlug): string {
  return `${chain}:${address.toLowerCase()}`;
}

function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

function toRowInput(input: { address: string; chain: ChainSlug; kind: EntityKindSlug; name: string; isTerminal: boolean; notes?: string }) {
  return {
    address: normalizeAddress(input.address),
    chain: chainMap[input.chain],
    kind: kindMap[input.kind],
    name: input.name,
    source: "USER" as LabelSource,
    isTerminal: input.kind === "HUMAN" ? false : input.isTerminal,
    ...(input.notes === undefined ? {} : { notes: input.notes }),
  };
}

export function createEntityService(deps: EntityServiceDependencies) {
  return {
    lookup(address: string, chain: ChainSlug): Promise<EntityLabelRow | null> {
      return deps.entityLabel.findUnique({
        where: { address_chain: { address: normalizeAddress(address), chain: chainMap[chain] } },
      });
    },

    async lookupMany(keys: Array<{ address: string; chain: ChainSlug }>): Promise<Map<string, EntityLabelRow>> {
      if (keys.length === 0) return new Map();
      const rows = await deps.entityLabel.findMany({
        where: {
          OR: keys.map((item) => ({ address: normalizeAddress(item.address), chain: chainMap[item.chain] })),
        },
      });
      const result = new Map<string, EntityLabelRow>();
      for (const row of rows) result.set(key(row.address, row.chain.toLowerCase() as ChainSlug), row);
      return result;
    },

    async isTerminal(address: string, chain: ChainSlug): Promise<boolean> {
      const row = await this.lookup(address, chain);
      return row?.isTerminal ?? false;
    },

    upsertUserLabel(input: { address: string; chain: ChainSlug; kind: EntityKindSlug; name: string; isTerminal: boolean; notes?: string }): Promise<EntityLabelRow> {
      const row = toRowInput(input);
      return deps.entityLabel.upsert({
        where: { address_chain: { address: row.address, chain: row.chain } },
        create: row,
        update: { kind: row.kind, name: row.name, isTerminal: row.isTerminal, ...(row.notes === undefined ? {} : { notes: row.notes }) },
      });
    },

    async seedBundled(labels: BundledEntityLabel[]): Promise<{ inserted: number; updated: number; warning?: string }> {
      let inserted = 0;
      let updated = 0;
      for (const label of labels) {
        const existing = await this.lookup(label.address, label.chain);
        if (existing?.source === "USER") continue;
        const row = {
          address: normalizeAddress(label.address),
          chain: chainMap[label.chain],
          kind: kindMap[label.kind],
          name: label.name,
          source: "BUNDLED" as LabelSource,
          isTerminal: label.kind === "HUMAN" ? false : label.isTerminal,
          ...(label.notes === undefined ? {} : { notes: label.notes }),
        };
        await deps.entityLabel.upsert({
          where: { address_chain: { address: row.address, chain: row.chain } },
          create: row,
          update: { kind: row.kind, name: row.name, isTerminal: row.isTerminal, ...(row.notes === undefined ? {} : { notes: row.notes }) },
        });
        if (existing) updated += 1;
        else inserted += 1;
      }
      return { inserted, updated, warning: "Robinhood has no bundled entity-label coverage beyond configured contracts." };
    },
  };
}

export type BundledEntityLabel = {
  address: string;
  chain: ChainSlug;
  kind: EntityKindSlug;
  name: string;
  isTerminal: boolean;
  notes?: string;
};

export async function createDefaultEntityService() {
  const { prisma } = await import("../../db/client");
  return createEntityService({ entityLabel: prisma.entityLabel });
}

export { terminalKinds };
