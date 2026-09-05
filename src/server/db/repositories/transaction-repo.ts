import type { PrismaClient, Chain } from "@/generated/prisma/client";
import type { ChainSlug, Address } from "@/lib/chains/types";
import type { NormalizedTxRow, TokenStub } from "@/server/services/ingestion/normalize";
import { chainSlugToPrisma, normalizeAddress } from "@/server/services/wallet/normalize";

export interface UpsertTransactionsResult {
  inserted: number;
  updated: number;
  total: number;
}

export function createTransactionRepository(prisma: PrismaClient) {
  return {
    async upsertTokens(stubs: TokenStub[]): Promise<number> {
      let count = 0;
      for (const stub of stubs) {
        const prismaChain = chainSlugToPrisma(stub.chain);
        await prisma.token.upsert({
          where: {
            address_chain: {
              address: stub.address,
              chain: prismaChain,
            },
          },
          create: {
            address: stub.address,
            chain: prismaChain,
            symbol: stub.symbol,
            name: stub.name,
            decimals: stub.decimals,
          },
          update: {
            symbol: stub.symbol ?? undefined,
            name: stub.name ?? undefined,
            decimals: stub.decimals ?? undefined,
          },
        });
        count++;
      }
      return count;
    },

    async upsertTransactions(rows: NormalizedTxRow[]): Promise<UpsertTransactionsResult> {
      let inserted = 0;
      let updated = 0;

      for (const row of rows) {
        const prismaChain = chainSlugToPrisma(row.chain);
        const res = await prisma.transaction.upsert({
          where: {
            tx_natural_key: {
              chain: prismaChain,
              hash: row.hash,
              kind: row.kind,
              ordinal: row.ordinal,
            },
          },
          create: {
            chain: prismaChain,
            hash: row.hash,
            blockNumber: row.blockNumber,
            timestamp: row.timestamp,
            fromAddress: row.fromAddress,
            toAddress: row.toAddress,
            tokenAddress: row.tokenAddress,
            kind: row.kind,
            amountRaw: row.amountRaw,
            txType: row.txType,
            ordinal: row.ordinal,
            logIndex: row.logIndex,
            traceId: row.traceId,
            tokenDecimals: row.tokenDecimals,
            tokenSymbol: row.tokenSymbol,
            gasUsed: row.gasUsed,
            gasPriceWei: row.gasPriceWei,
            isError: row.isError,
            methodId: row.methodId,
            functionName: row.functionName,
            contractCreated: row.contractCreated,
          },
          update: {
            toAddress: row.toAddress !== undefined ? row.toAddress : undefined,
            isError: row.isError,
            tokenDecimals: row.tokenDecimals ?? undefined,
            tokenSymbol: row.tokenSymbol ?? undefined,
          },
        });

        // If returned row has isNew or if created
        if ((res as any).isNew !== false) {
          inserted++;
        } else {
          updated++;
        }
      }

      return {
        inserted,
        updated,
        total: rows.length,
      };
    },

    async findByHash(chain: ChainSlug, hash: string) {
      return prisma.transaction.findMany({
        where: {
          chain: chainSlugToPrisma(chain),
          hash: hash.toLowerCase(),
        },
        orderBy: [{ ordinal: "asc" }],
      });
    },

    async findInboundValue(
      address: Address | string,
      chain: ChainSlug,
      opts?: { from?: Date; to?: Date }
    ) {
      const normalized = normalizeAddress(address);
      const where: any = {
        chain: chainSlugToPrisma(chain),
        toAddress: normalized,
        isError: false,
      };
      if (opts?.from || opts?.to) {
        where.timestamp = {};
        if (opts.from) where.timestamp.gte = opts.from;
        if (opts.to) where.timestamp.lte = opts.to;
      }
      return prisma.transaction.findMany({
        where,
        orderBy: [{ timestamp: "asc" }],
      });
    },

    async findOutboundValue(
      address: Address | string,
      chain: ChainSlug,
      opts?: { from?: Date; to?: Date }
    ) {
      const normalized = normalizeAddress(address);
      const where: any = {
        chain: chainSlugToPrisma(chain),
        fromAddress: normalized,
        isError: false,
      };
      if (opts?.from || opts?.to) {
        where.timestamp = {};
        if (opts.from) where.timestamp.gte = opts.from;
        if (opts.to) where.timestamp.lte = opts.to;
      }
      return prisma.transaction.findMany({
        where,
        orderBy: [{ timestamp: "asc" }],
      });
    },
  };
}
