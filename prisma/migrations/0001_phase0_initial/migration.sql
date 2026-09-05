-- CreateEnum
CREATE TYPE "Chain" AS ENUM ('BASE', 'BSC', 'ROBINHOOD');

-- CreateEnum
CREATE TYPE "WalletEdgeTag" AS ENUM ('SMART', 'INSIDER', 'EARLY', 'BOT', 'KOL', 'DEGEN', 'FRESH', 'DEV');

-- CreateEnum
CREATE TYPE "WalletStyleTag" AS ENUM ('SNIPER', 'JEET', 'RIDER', 'SWING', 'DIAMOND');

-- CreateEnum
CREATE TYPE "WalletSizeTag" AS ENUM ('W', 'M', 'S');

-- CreateEnum
CREATE TYPE "WatchPriority" AS ENUM ('HIGH', 'NORMAL');

-- CreateEnum
CREATE TYPE "EntityKind" AS ENUM ('CEX', 'BRIDGE', 'ROUTER', 'CONTRACT', 'HUMAN');

-- CreateEnum
CREATE TYPE "LabelSource" AS ENUM ('BUNDLED', 'USER');

-- CreateEnum
CREATE TYPE "TxKind" AS ENUM ('NATIVE', 'ERC20', 'INTERNAL');

-- CreateEnum
CREATE TYPE "TxType" AS ENUM ('TRANSFER', 'SWAP', 'DEPLOY');

-- CreateEnum
CREATE TYPE "UsdSource" AS ENUM ('SWAP_LEG_STABLE', 'SWAP_LEG_NATIVE', 'DEXSCREENER', 'COINGECKO', 'STABLE_PAR', 'NATIVE_PRICE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PriceConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "FundingEdgeKind" AS ENUM ('INITIAL', 'REPEATED', 'PROFIT_SINK', 'PRIMARY');

-- CreateEnum
CREATE TYPE "TraceStopReason" AS ENUM ('TERMINAL_ENTITY', 'DEPTH_LIMIT', 'NO_INBOUND', 'SELF_REFERENCE', 'BUDGET_EXHAUSTED', 'NOT_STOPPED');

-- CreateEnum
CREATE TYPE "WalletAlertState" AS ENUM ('IDLE', 'ARMED', 'TRIGGERED');

-- CreateEnum
CREATE TYPE "AlertState" AS ENUM ('ARMED', 'TRIGGERED', 'EXIT_RISK');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'T1', 'T2', 'T3', 'T4', 'T5', 'C1', 'C2', 'C3', 'C4');

-- CreateEnum
CREATE TYPE "MovementGroupKind" AS ENUM ('CO_ACCUMULATION', 'CO_DISTRIBUTION', 'CLUSTER_CO_ENTRY');

-- CreateEnum
CREATE TYPE "MovementKind" AS ENUM ('BUY', 'SELL', 'STABLE_PARK', 'STABLE_SPEND', 'CEX_DEPOSIT', 'CEX_WITHDRAWAL', 'NEW_TOKEN_ENTRY', 'NATIVE_FUNDING_IN', 'NATIVE_FUNDING_OUT');

-- CreateEnum
CREATE TYPE "TradeSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "TradeSource" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "RelationKind" AS ENUM ('SHARED_FUNDER', 'DIRECT_TRANSFER', 'CO_ENTRY', 'SAME_CLUSTER');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('NEVER_SYNCED', 'QUEUED', 'RUNNING', 'IDLE', 'FAILED');

-- CreateEnum
CREATE TYPE "SyncEndpoint" AS ENUM ('NORMAL_TX', 'INTERNAL_TX', 'ERC20_TRANSFER');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "FlowDirection" AS ENUM ('IN', 'OUT');

-- CreateTable
CREATE TABLE "Wallet" (
    "address" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "ensName" TEXT,
    "label" TEXT,
    "edge" "WalletEdgeTag",
    "style" "WalletStyleTag",
    "size" "WalletSizeTag",
    "notes" TEXT,
    "isBlacklisted" BOOLEAN NOT NULL DEFAULT false,
    "isSelf" BOOLEAN NOT NULL DEFAULT false,
    "watchPriority" "WatchPriority" NOT NULL DEFAULT 'NORMAL',
    "firstTxAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("address","chain")
);

-- CreateTable
CREATE TABLE "WalletProfile" (
    "walletAddress" TEXT NOT NULL,
    "walletChain" "Chain" NOT NULL,
    "firstTxAt" TIMESTAMP(3),
    "firstMemecoinTradeAt" TIMESTAMP(3),
    "walletAgeDaysAtFirstMemecoinTrade" INTEGER,
    "txCount" INTEGER NOT NULL DEFAULT 0,
    "distinctTokenCount" INTEGER NOT NULL DEFAULT 0,
    "stableBalanceUsd" DECIMAL(38,8) NOT NULL DEFAULT 0,
    "nativeBalanceRaw" TEXT NOT NULL DEFAULT '0',
    "nativeBalanceUsd" DECIMAL(38,8),
    "lastActivityAt" TIMESTAMP(3),
    "dormantSince" TIMESTAMP(3),
    "heatmapJson" JSONB NOT NULL,
    "gradeJson" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletProfile_pkey" PRIMARY KEY ("walletAddress","walletChain")
);

-- CreateTable
CREATE TABLE "EntityLabel" (
    "address" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "kind" "EntityKind" NOT NULL,
    "name" TEXT NOT NULL,
    "source" "LabelSource" NOT NULL,
    "isTerminal" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntityLabel_pkey" PRIMARY KEY ("address","chain")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" BIGSERIAL NOT NULL,
    "hash" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT,
    "tokenAddress" TEXT,
    "kind" "TxKind" NOT NULL,
    "amountRaw" TEXT NOT NULL,
    "amountUsd" DECIMAL(38,8),
    "txType" "TxType" NOT NULL DEFAULT 'TRANSFER',
    "ordinal" INTEGER NOT NULL DEFAULT 0,
    "logIndex" INTEGER,
    "traceId" TEXT,
    "tokenDecimals" INTEGER,
    "tokenSymbol" TEXT,
    "gasUsed" TEXT,
    "gasPriceWei" TEXT,
    "feeUsd" DECIMAL(38,8),
    "isError" BOOLEAN NOT NULL DEFAULT false,
    "methodId" TEXT,
    "functionName" TEXT,
    "contractCreated" TEXT,
    "usdSource" "UsdSource" NOT NULL DEFAULT 'UNKNOWN',
    "usdConfidence" "PriceConfidence",
    "priceUsdUsed" DECIMAL(38,18),
    "swapGroupKey" TEXT,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Token" (
    "address" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "symbol" TEXT,
    "name" TEXT,
    "decimals" INTEGER,
    "deployedAt" TIMESTAMP(3),
    "deployerAddress" TEXT,
    "pairCreatedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isStable" BOOLEAN NOT NULL DEFAULT false,
    "isNative" BOOLEAN NOT NULL DEFAULT false,
    "primaryPairAddress" TEXT,
    "redFlagJson" JSONB,
    "redFlagCheckedAt" TIMESTAMP(3),
    "latestPriceUsd" DECIMAL(38,18),
    "latestMarketCap" DECIMAL(38,8),
    "latestPriceAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("address","chain")
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" BIGSERIAL NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "priceUsd" DECIMAL(38,18) NOT NULL,
    "marketCap" DECIMAL(38,8),
    "liquidityUsd" DECIMAL(38,8),
    "fdvUsd" DECIMAL(38,8),
    "source" "UsdSource" NOT NULL,
    "confidence" "PriceConfidence" NOT NULL,
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NativePriceSnapshot" (
    "id" BIGSERIAL NOT NULL,
    "chain" "Chain" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "priceUsd" DECIMAL(38,18) NOT NULL,
    "source" "UsdSource" NOT NULL,
    "confidence" "PriceConfidence" NOT NULL,

    CONSTRAINT "NativePriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncState" (
    "walletAddress" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "lastSyncedBlock" BIGINT NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3),
    "status" "SyncStatus" NOT NULL DEFAULT 'NEVER_SYNCED',
    "lastError" TEXT,
    "cursorsJson" JSONB,
    "fullSyncDoneAt" TIMESTAMP(3),
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("walletAddress","chain")
);

-- CreateTable
CREATE TABLE "BalanceSnapshot" (
    "id" BIGSERIAL NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "tokenAddress" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "balanceRaw" TEXT NOT NULL,
    "balanceUsd" DECIMAL(38,8),
    "isStable" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BalanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyFlow" (
    "id" BIGSERIAL NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "tokenAddress" TEXT,
    "day" DATE NOT NULL,
    "direction" "FlowDirection" NOT NULL,
    "amountUsd" DECIMAL(38,8) NOT NULL DEFAULT 0,
    "amountRaw" TEXT NOT NULL DEFAULT '0',
    "eventsCount" INTEGER NOT NULL DEFAULT 0,
    "isStable" BOOLEAN NOT NULL DEFAULT false,
    "isCexCounterparty" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DailyFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingEdge" (
    "id" BIGSERIAL NOT NULL,
    "childAddress" TEXT NOT NULL,
    "childChain" "Chain" NOT NULL,
    "parentAddress" TEXT NOT NULL,
    "parentChain" "Chain" NOT NULL,
    "totalUsd" DECIMAL(38,8) NOT NULL DEFAULT 0,
    "eventsCount" INTEGER NOT NULL DEFAULT 0,
    "firstAt" TIMESTAMP(3),
    "lastAt" TIMESTAMP(3),
    "kind" "FundingEdgeKind" NOT NULL DEFAULT 'INITIAL',
    "depth" INTEGER NOT NULL DEFAULT 1,
    "rootAddress" TEXT NOT NULL,
    "rootChain" "Chain" NOT NULL,
    "internalEventsCount" INTEGER NOT NULL DEFAULT 0,
    "nativeEventsCount" INTEGER NOT NULL DEFAULT 0,
    "isRepeatedFunder" BOOLEAN NOT NULL DEFAULT false,
    "fundedFirstGas" BOOLEAN NOT NULL DEFAULT false,
    "isProfitSink" BOOLEAN NOT NULL DEFAULT false,
    "profitSinkRatio" DECIMAL(18,8),
    "isLargestOutflowDestination" BOOLEAN NOT NULL DEFAULT false,
    "isPrimaryWallet" BOOLEAN NOT NULL DEFAULT false,
    "isTerminalEntity" BOOLEAN NOT NULL DEFAULT false,
    "entityName" TEXT,
    "stopReason" "TraceStopReason" NOT NULL DEFAULT 'NOT_STOPPED',
    "deepTracedAt" TIMESTAMP(3),
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundingEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingNode" (
    "address" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "isTracked" BOOLEAN NOT NULL DEFAULT false,
    "entityKind" "EntityKind",
    "entityName" TEXT,
    "isTerminal" BOOLEAN NOT NULL DEFAULT false,
    "maxExpandedDepth" INTEGER NOT NULL DEFAULT 0,
    "lastExpandedAt" TIMESTAMP(3),
    "stopReason" "TraceStopReason" NOT NULL DEFAULT 'NOT_STOPPED',
    "inboundFetchedAt" TIMESTAMP(3),

    CONSTRAINT "FundingNode_pkey" PRIMARY KEY ("address","chain")
);

-- CreateTable
CREATE TABLE "Cluster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "funderAddress" TEXT NOT NULL,
    "funderChain" "Chain" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "colorHex" TEXT NOT NULL,
    "combinedStableUsd" DECIMAL(38,8) NOT NULL DEFAULT 0,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3),
    "isArmed" BOOLEAN NOT NULL DEFAULT false,
    "armedAt" TIMESTAMP(3),

    CONSTRAINT "Cluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClusterMember" (
    "clusterId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "walletChain" "Chain" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClusterMember_pkey" PRIMARY KEY ("clusterId","walletAddress","walletChain")
);

-- CreateTable
CREATE TABLE "ClusterRotation" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "exitedJson" JSONB NOT NULL,
    "enteredJson" JSONB NOT NULL,
    "exitedUsd" DECIMAL(38,8) NOT NULL DEFAULT 0,
    "enteredUsd" DECIMAL(38,8) NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClusterRotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InteractionEdge" (
    "id" BIGSERIAL NOT NULL,
    "addressA" TEXT NOT NULL,
    "chainA" "Chain" NOT NULL,
    "addressB" TEXT NOT NULL,
    "chainB" "Chain" NOT NULL,
    "totalUsd" DECIMAL(38,8) NOT NULL DEFAULT 0,
    "txCount" INTEGER NOT NULL DEFAULT 0,
    "usdAToB" DECIMAL(38,8) NOT NULL DEFAULT 0,
    "usdBToA" DECIMAL(38,8) NOT NULL DEFAULT 0,
    "countAToB" INTEGER NOT NULL DEFAULT 0,
    "countBToA" INTEGER NOT NULL DEFAULT 0,
    "firstAt" TIMESTAMP(3),
    "lastAt" TIMESTAMP(3),
    "topTokenAddress" TEXT,
    "topTokenSymbol" TEXT,
    "topTokenUsd" DECIMAL(38,8),
    "distinctTokenCount" INTEGER NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InteractionEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InteractionEdgeToken" (
    "id" BIGSERIAL NOT NULL,
    "edgeId" BIGINT NOT NULL,
    "tokenAddress" TEXT,
    "chain" "Chain" NOT NULL,
    "tokenSymbol" TEXT,
    "totalUsd" DECIMAL(38,8) NOT NULL DEFAULT 0,
    "txCount" INTEGER NOT NULL DEFAULT 0,
    "usdAToB" DECIMAL(38,8) NOT NULL DEFAULT 0,
    "usdBToA" DECIMAL(38,8) NOT NULL DEFAULT 0,
    "firstAt" TIMESTAMP(3),
    "lastAt" TIMESTAMP(3),
    "sampleTxsJson" JSONB,

    CONSTRAINT "InteractionEdgeToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletRelation" (
    "id" BIGSERIAL NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "fromChain" "Chain" NOT NULL,
    "toAddress" TEXT NOT NULL,
    "toChain" "Chain" NOT NULL,
    "kind" "RelationKind" NOT NULL,
    "statement" TEXT NOT NULL,
    "detailJson" JSONB NOT NULL,
    "strengthUsd" DECIMAL(38,8),
    "eventsCount" INTEGER NOT NULL DEFAULT 0,
    "firstAt" TIMESTAMP(3),
    "lastAt" TIMESTAMP(3),
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovementEvent" (
    "id" BIGSERIAL NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "walletChain" "Chain" NOT NULL,
    "kind" "MovementKind" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "tokenAddress" TEXT,
    "tokenChain" "Chain",
    "tokenSymbol" TEXT,
    "amountRaw" TEXT NOT NULL,
    "amountUsd" DECIMAL(38,8),
    "marketCapAtAction" DECIMAL(38,8),
    "priceUsdAtAction" DECIMAL(38,18),
    "tokenAgeSeconds" BIGINT,
    "counterpartyAddress" TEXT,
    "counterpartyEntityName" TEXT,
    "isFirstEntryForWallet" BOOLEAN NOT NULL DEFAULT false,
    "transactionId" BIGINT NOT NULL,
    "txHash" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "usdSource" "UsdSource" NOT NULL DEFAULT 'UNKNOWN',
    "usdConfidence" "PriceConfidence",
    "radarEvaluatedAt" TIMESTAMP(3),
    "alertEvaluatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovementEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovementGroup" (
    "id" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "kind" "MovementGroupKind" NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "combinedUsd" DECIMAL(38,8) NOT NULL DEFAULT 0,
    "walletCount" INTEGER NOT NULL DEFAULT 0,
    "windowLabel" TEXT NOT NULL,
    "supplySharePct" DECIMAL(18,8),
    "timeSpanSeconds" INTEGER NOT NULL DEFAULT 0,
    "clusterId" TEXT,
    "evidenceJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MovementGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovementGroupMember" (
    "groupId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "walletChain" "Chain" NOT NULL,
    "movementId" BIGINT NOT NULL,
    "amountUsd" DECIMAL(38,8),
    "actedAt" TIMESTAMP(3) NOT NULL,
    "gradeLabel" TEXT,

    CONSTRAINT "MovementGroupMember_pkey" PRIMARY KEY ("groupId","walletAddress","walletChain","movementId")
);

-- CreateTable
CREATE TABLE "WalletState" (
    "walletAddress" TEXT NOT NULL,
    "walletChain" "Chain" NOT NULL,
    "state" "WalletAlertState" NOT NULL DEFAULT 'IDLE',
    "armedAt" TIMESTAMP(3),
    "triggeredAt" TIMESTAMP(3),
    "stateReason" "AlertType",
    "stablePeakUsd" DECIMAL(38,8),
    "stablePeakAt" TIMESTAMP(3),
    "baselineStableUsd" DECIMAL(38,8),
    "baselineNativeUsd" DECIMAL(38,8),
    "deArmStreakDays" INTEGER NOT NULL DEFAULT 0,
    "lastEvaluatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletState_pkey" PRIMARY KEY ("walletAddress","walletChain")
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "walletChain" "Chain" NOT NULL,
    "type" "AlertType" NOT NULL,
    "state" "AlertState" NOT NULL,
    "tokenAddress" TEXT,
    "tokenChain" "Chain",
    "tokenSymbol" TEXT,
    "amountUsd" DECIMAL(38,8),
    "clusterId" TEXT,
    "payloadJson" JSONB NOT NULL,
    "evidenceJson" JSONB NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "deliveryError" TEXT,

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" BIGSERIAL NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "walletChain" "Chain" NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "tokenChain" "Chain" NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "amountRaw" TEXT NOT NULL DEFAULT '0',
    "costUsd" DECIMAL(38,8) NOT NULL DEFAULT 0,
    "realizedUsd" DECIMAL(38,8) NOT NULL DEFAULT 0,
    "avgEntryPriceUsd" DECIMAL(38,18),
    "entryMarketCap" DECIMAL(38,8),
    "peakPriceUsd" DECIMAL(38,18),
    "peakPriceAt" TIMESTAMP(3),
    "unrealizedUsd" DECIMAL(38,8),
    "unrealizedMultiple" DECIMAL(18,8),
    "buyCount" INTEGER NOT NULL DEFAULT 0,
    "sellCount" INTEGER NOT NULL DEFAULT 0,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "cexDepositedUsd" DECIMAL(38,8) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTrade" (
    "id" TEXT NOT NULL,
    "ownWalletAddress" TEXT NOT NULL,
    "ownChain" "Chain" NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "tokenChain" "Chain" NOT NULL,
    "side" "TradeSide" NOT NULL,
    "amountUsd" DECIMAL(38,8) NOT NULL,
    "entryAt" TIMESTAMP(3) NOT NULL,
    "exitAt" TIMESTAMP(3),
    "roiPct" DECIMAL(18,8),
    "followedWalletAddress" TEXT,
    "followedWalletChain" "Chain",
    "lagMinutes" INTEGER,
    "lagMcDelta" DECIMAL(38,8),
    "thesis" TEXT,
    "source" "TradeSource" NOT NULL,
    "walletRoiPct" DECIMAL(18,8),
    "entryMarketCap" DECIMAL(38,8),
    "followedEntryMarketCap" DECIMAL(38,8),
    "amountRaw" TEXT,
    "lagBucket" TEXT,
    "linkEvidenceJson" JSONB,
    "linkedAt" TIMESTAMP(3),
    "isLinkPinned" BOOLEAN NOT NULL DEFAULT false,
    "movementId" BIGINT,
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "valueJson" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "queueName" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "progressPct" INTEGER NOT NULL DEFAULT 0,
    "progressJson" JSONB,
    "payloadJson" JSONB NOT NULL,
    "resultJson" JSONB,
    "error" TEXT,
    "attemptsMade" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiUsageDaily" (
    "provider" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "callCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "rateLimitHits" INTEGER NOT NULL DEFAULT 0,
    "recordsFetched" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiUsageDaily_pkey" PRIMARY KEY ("provider","day")
);

-- CreateTable
CREATE TABLE "ProviderCacheEntry" (
    "cacheKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "paramsJson" JSONB NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ProviderCacheEntry_pkey" PRIMARY KEY ("cacheKey")
);

-- CreateIndex
CREATE INDEX "Wallet_chain_idx" ON "Wallet"("chain");

-- CreateIndex
CREATE INDEX "Wallet_watchPriority_chain_idx" ON "Wallet"("watchPriority", "chain");

-- CreateIndex
CREATE INDEX "Wallet_isSelf_idx" ON "Wallet"("isSelf");

-- CreateIndex
CREATE INDEX "Wallet_isBlacklisted_idx" ON "Wallet"("isBlacklisted");

-- CreateIndex
CREATE INDEX "Wallet_updatedAt_idx" ON "Wallet"("updatedAt");

-- CreateIndex
CREATE INDEX "WalletProfile_lastActivityAt_idx" ON "WalletProfile"("lastActivityAt");

-- CreateIndex
CREATE INDEX "WalletProfile_stableBalanceUsd_idx" ON "WalletProfile"("stableBalanceUsd");

-- CreateIndex
CREATE INDEX "EntityLabel_kind_idx" ON "EntityLabel"("kind");

-- CreateIndex
CREATE INDEX "EntityLabel_source_idx" ON "EntityLabel"("source");

-- CreateIndex
CREATE INDEX "EntityLabel_address_idx" ON "EntityLabel"("address");

-- CreateIndex
CREATE INDEX "Transaction_fromAddress_timestamp_idx" ON "Transaction"("fromAddress", "timestamp");

-- CreateIndex
CREATE INDEX "Transaction_toAddress_timestamp_idx" ON "Transaction"("toAddress", "timestamp");

-- CreateIndex
CREATE INDEX "Transaction_tokenAddress_timestamp_idx" ON "Transaction"("tokenAddress", "timestamp");

-- CreateIndex
CREATE INDEX "Transaction_chain_blockNumber_idx" ON "Transaction"("chain", "blockNumber");

-- CreateIndex
CREATE INDEX "Transaction_timestamp_idx" ON "Transaction"("timestamp");

-- CreateIndex
CREATE INDEX "Transaction_swapGroupKey_idx" ON "Transaction"("swapGroupKey");

-- CreateIndex
CREATE INDEX "Transaction_chain_fromAddress_kind_timestamp_idx" ON "Transaction"("chain", "fromAddress", "kind", "timestamp");

-- CreateIndex
CREATE INDEX "Transaction_chain_toAddress_kind_timestamp_idx" ON "Transaction"("chain", "toAddress", "kind", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_chain_hash_kind_ordinal_key" ON "Transaction"("chain", "hash", "kind", "ordinal");

-- CreateIndex
CREATE INDEX "Token_symbol_idx" ON "Token"("symbol");

-- CreateIndex
CREATE INDEX "Token_deployedAt_idx" ON "Token"("deployedAt");

-- CreateIndex
CREATE INDEX "Token_isStable_idx" ON "Token"("isStable");

-- CreateIndex
CREATE INDEX "Token_deployerAddress_idx" ON "Token"("deployerAddress");

-- CreateIndex
CREATE INDEX "PriceSnapshot_tokenAddress_chain_timestamp_idx" ON "PriceSnapshot"("tokenAddress", "chain", "timestamp");

-- CreateIndex
CREATE INDEX "PriceSnapshot_timestamp_idx" ON "PriceSnapshot"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "PriceSnapshot_tokenAddress_chain_timestamp_source_key" ON "PriceSnapshot"("tokenAddress", "chain", "timestamp", "source");

-- CreateIndex
CREATE INDEX "NativePriceSnapshot_chain_timestamp_idx" ON "NativePriceSnapshot"("chain", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "NativePriceSnapshot_chain_timestamp_source_key" ON "NativePriceSnapshot"("chain", "timestamp", "source");

-- CreateIndex
CREATE INDEX "SyncState_status_idx" ON "SyncState"("status");

-- CreateIndex
CREATE INDEX "SyncState_lastSyncedAt_idx" ON "SyncState"("lastSyncedAt");

-- CreateIndex
CREATE INDEX "BalanceSnapshot_walletAddress_chain_timestamp_idx" ON "BalanceSnapshot"("walletAddress", "chain", "timestamp");

-- CreateIndex
CREATE INDEX "BalanceSnapshot_timestamp_idx" ON "BalanceSnapshot"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "BalanceSnapshot_walletAddress_chain_tokenAddress_timestamp_key" ON "BalanceSnapshot"("walletAddress", "chain", "tokenAddress", "timestamp");

-- CreateIndex
CREATE INDEX "DailyFlow_walletAddress_chain_day_idx" ON "DailyFlow"("walletAddress", "chain", "day");

-- CreateIndex
CREATE INDEX "DailyFlow_tokenAddress_chain_day_idx" ON "DailyFlow"("tokenAddress", "chain", "day");

-- CreateIndex
CREATE INDEX "DailyFlow_day_idx" ON "DailyFlow"("day");

-- CreateIndex
CREATE UNIQUE INDEX "DailyFlow_walletAddress_chain_tokenAddress_day_direction_is_key" ON "DailyFlow"("walletAddress", "chain", "tokenAddress", "day", "direction", "isCexCounterparty");

-- CreateIndex
CREATE INDEX "FundingEdge_childAddress_childChain_idx" ON "FundingEdge"("childAddress", "childChain");

-- CreateIndex
CREATE INDEX "FundingEdge_parentAddress_parentChain_idx" ON "FundingEdge"("parentAddress", "parentChain");

-- CreateIndex
CREATE INDEX "FundingEdge_rootAddress_rootChain_depth_idx" ON "FundingEdge"("rootAddress", "rootChain", "depth");

-- CreateIndex
CREATE INDEX "FundingEdge_isPrimaryWallet_idx" ON "FundingEdge"("isPrimaryWallet");

-- CreateIndex
CREATE UNIQUE INDEX "FundingEdge_rootAddress_rootChain_childAddress_childChain_p_key" ON "FundingEdge"("rootAddress", "rootChain", "childAddress", "childChain", "parentAddress", "parentChain");

-- CreateIndex
CREATE INDEX "FundingNode_isTerminal_idx" ON "FundingNode"("isTerminal");

-- CreateIndex
CREATE INDEX "FundingNode_isTracked_idx" ON "FundingNode"("isTracked");

-- CreateIndex
CREATE INDEX "Cluster_isArmed_idx" ON "Cluster"("isArmed");

-- CreateIndex
CREATE UNIQUE INDEX "Cluster_funderAddress_funderChain_key" ON "Cluster"("funderAddress", "funderChain");

-- CreateIndex
CREATE INDEX "ClusterMember_walletAddress_walletChain_idx" ON "ClusterMember"("walletAddress", "walletChain");

-- CreateIndex
CREATE INDEX "ClusterRotation_windowStart_idx" ON "ClusterRotation"("windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "ClusterRotation_clusterId_windowStart_windowEnd_key" ON "ClusterRotation"("clusterId", "windowStart", "windowEnd");

-- CreateIndex
CREATE INDEX "InteractionEdge_totalUsd_idx" ON "InteractionEdge"("totalUsd");

-- CreateIndex
CREATE INDEX "InteractionEdge_lastAt_idx" ON "InteractionEdge"("lastAt");

-- CreateIndex
CREATE UNIQUE INDEX "InteractionEdge_addressA_chainA_addressB_chainB_key" ON "InteractionEdge"("addressA", "chainA", "addressB", "chainB");

-- CreateIndex
CREATE INDEX "InteractionEdgeToken_tokenAddress_chain_idx" ON "InteractionEdgeToken"("tokenAddress", "chain");

-- CreateIndex
CREATE UNIQUE INDEX "InteractionEdgeToken_edgeId_tokenAddress_key" ON "InteractionEdgeToken"("edgeId", "tokenAddress");

-- CreateIndex
CREATE INDEX "WalletRelation_fromAddress_fromChain_idx" ON "WalletRelation"("fromAddress", "fromChain");

-- CreateIndex
CREATE INDEX "WalletRelation_kind_idx" ON "WalletRelation"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "WalletRelation_fromAddress_fromChain_toAddress_toChain_kind_key" ON "WalletRelation"("fromAddress", "fromChain", "toAddress", "toChain", "kind");

-- CreateIndex
CREATE INDEX "MovementEvent_timestamp_idx" ON "MovementEvent"("timestamp");

-- CreateIndex
CREATE INDEX "MovementEvent_walletAddress_walletChain_timestamp_idx" ON "MovementEvent"("walletAddress", "walletChain", "timestamp");

-- CreateIndex
CREATE INDEX "MovementEvent_tokenAddress_tokenChain_timestamp_idx" ON "MovementEvent"("tokenAddress", "tokenChain", "timestamp");

-- CreateIndex
CREATE INDEX "MovementEvent_kind_timestamp_idx" ON "MovementEvent"("kind", "timestamp");

-- CreateIndex
CREATE INDEX "MovementEvent_radarEvaluatedAt_idx" ON "MovementEvent"("radarEvaluatedAt");

-- CreateIndex
CREATE INDEX "MovementEvent_alertEvaluatedAt_idx" ON "MovementEvent"("alertEvaluatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MovementEvent_transactionId_kind_walletAddress_key" ON "MovementEvent"("transactionId", "kind", "walletAddress");

-- CreateIndex
CREATE INDEX "MovementGroup_tokenAddress_windowStart_idx" ON "MovementGroup"("tokenAddress", "windowStart");

-- CreateIndex
CREATE INDEX "MovementGroup_kind_windowStart_idx" ON "MovementGroup"("kind", "windowStart");

-- CreateIndex
CREATE INDEX "MovementGroup_createdAt_idx" ON "MovementGroup"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MovementGroup_tokenAddress_chain_kind_windowStart_windowLab_key" ON "MovementGroup"("tokenAddress", "chain", "kind", "windowStart", "windowLabel");

-- CreateIndex
CREATE INDEX "MovementGroupMember_walletAddress_walletChain_idx" ON "MovementGroupMember"("walletAddress", "walletChain");

-- CreateIndex
CREATE INDEX "WalletState_state_idx" ON "WalletState"("state");

-- CreateIndex
CREATE INDEX "AlertEvent_createdAt_idx" ON "AlertEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AlertEvent_walletAddress_walletChain_createdAt_idx" ON "AlertEvent"("walletAddress", "walletChain", "createdAt");

-- CreateIndex
CREATE INDEX "AlertEvent_type_createdAt_idx" ON "AlertEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "AlertEvent_state_createdAt_idx" ON "AlertEvent"("state", "createdAt");

-- CreateIndex
CREATE INDEX "AlertEvent_readAt_idx" ON "AlertEvent"("readAt");

-- CreateIndex
CREATE INDEX "AlertEvent_tokenAddress_tokenChain_idx" ON "AlertEvent"("tokenAddress", "tokenChain");

-- CreateIndex
CREATE UNIQUE INDEX "AlertEvent_dedupeKey_key" ON "AlertEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "Position_walletAddress_walletChain_isOpen_idx" ON "Position"("walletAddress", "walletChain", "isOpen");

-- CreateIndex
CREATE INDEX "Position_tokenAddress_tokenChain_isOpen_idx" ON "Position"("tokenAddress", "tokenChain", "isOpen");

-- CreateIndex
CREATE INDEX "Position_unrealizedMultiple_idx" ON "Position"("unrealizedMultiple");

-- CreateIndex
CREATE UNIQUE INDEX "Position_walletAddress_walletChain_tokenAddress_tokenChain__key" ON "Position"("walletAddress", "walletChain", "tokenAddress", "tokenChain", "openedAt");

-- CreateIndex
CREATE INDEX "UserTrade_ownWalletAddress_ownChain_entryAt_idx" ON "UserTrade"("ownWalletAddress", "ownChain", "entryAt");

-- CreateIndex
CREATE INDEX "UserTrade_followedWalletAddress_followedWalletChain_idx" ON "UserTrade"("followedWalletAddress", "followedWalletChain");

-- CreateIndex
CREATE INDEX "UserTrade_tokenAddress_tokenChain_idx" ON "UserTrade"("tokenAddress", "tokenChain");

-- CreateIndex
CREATE INDEX "UserTrade_lagBucket_idx" ON "UserTrade"("lagBucket");

-- CreateIndex
CREATE INDEX "UserTrade_entryAt_idx" ON "UserTrade"("entryAt");

-- CreateIndex
CREATE INDEX "JobRun_status_createdAt_idx" ON "JobRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "JobRun_queueName_createdAt_idx" ON "JobRun"("queueName", "createdAt");

-- CreateIndex
CREATE INDEX "JobRun_jobName_createdAt_idx" ON "JobRun"("jobName", "createdAt");

-- CreateIndex
CREATE INDEX "ApiUsageDaily_day_idx" ON "ApiUsageDaily"("day");

-- CreateIndex
CREATE INDEX "ProviderCacheEntry_provider_endpoint_idx" ON "ProviderCacheEntry"("provider", "endpoint");

-- CreateIndex
CREATE INDEX "ProviderCacheEntry_expiresAt_idx" ON "ProviderCacheEntry"("expiresAt");

-- AddForeignKey
ALTER TABLE "WalletProfile" ADD CONSTRAINT "WalletProfile_walletAddress_walletChain_fkey" FOREIGN KEY ("walletAddress", "walletChain") REFERENCES "Wallet"("address", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_tokenAddress_chain_fkey" FOREIGN KEY ("tokenAddress", "chain") REFERENCES "Token"("address", "chain") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_tokenAddress_chain_fkey" FOREIGN KEY ("tokenAddress", "chain") REFERENCES "Token"("address", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncState" ADD CONSTRAINT "SyncState_walletAddress_chain_fkey" FOREIGN KEY ("walletAddress", "chain") REFERENCES "Wallet"("address", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceSnapshot" ADD CONSTRAINT "BalanceSnapshot_walletAddress_chain_fkey" FOREIGN KEY ("walletAddress", "chain") REFERENCES "Wallet"("address", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyFlow" ADD CONSTRAINT "DailyFlow_walletAddress_chain_fkey" FOREIGN KEY ("walletAddress", "chain") REFERENCES "Wallet"("address", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyFlow" ADD CONSTRAINT "DailyFlow_tokenAddress_chain_fkey" FOREIGN KEY ("tokenAddress", "chain") REFERENCES "Token"("address", "chain") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingEdge" ADD CONSTRAINT "FundingEdge_childAddress_childChain_fkey" FOREIGN KEY ("childAddress", "childChain") REFERENCES "Wallet"("address", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingEdge" ADD CONSTRAINT "FundingEdge_parentAddress_parentChain_fkey" FOREIGN KEY ("parentAddress", "parentChain") REFERENCES "Wallet"("address", "chain") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClusterMember" ADD CONSTRAINT "ClusterMember_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClusterMember" ADD CONSTRAINT "ClusterMember_walletAddress_walletChain_fkey" FOREIGN KEY ("walletAddress", "walletChain") REFERENCES "Wallet"("address", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClusterRotation" ADD CONSTRAINT "ClusterRotation_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionEdge" ADD CONSTRAINT "InteractionEdge_addressA_chainA_fkey" FOREIGN KEY ("addressA", "chainA") REFERENCES "Wallet"("address", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionEdge" ADD CONSTRAINT "InteractionEdge_addressB_chainB_fkey" FOREIGN KEY ("addressB", "chainB") REFERENCES "Wallet"("address", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionEdgeToken" ADD CONSTRAINT "InteractionEdgeToken_edgeId_fkey" FOREIGN KEY ("edgeId") REFERENCES "InteractionEdge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletRelation" ADD CONSTRAINT "WalletRelation_fromAddress_fromChain_fkey" FOREIGN KEY ("fromAddress", "fromChain") REFERENCES "Wallet"("address", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletRelation" ADD CONSTRAINT "WalletRelation_toAddress_toChain_fkey" FOREIGN KEY ("toAddress", "toChain") REFERENCES "Wallet"("address", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementEvent" ADD CONSTRAINT "MovementEvent_walletAddress_walletChain_fkey" FOREIGN KEY ("walletAddress", "walletChain") REFERENCES "Wallet"("address", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementEvent" ADD CONSTRAINT "MovementEvent_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementEvent" ADD CONSTRAINT "MovementEvent_tokenAddress_tokenChain_fkey" FOREIGN KEY ("tokenAddress", "tokenChain") REFERENCES "Token"("address", "chain") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementGroup" ADD CONSTRAINT "MovementGroup_tokenAddress_chain_fkey" FOREIGN KEY ("tokenAddress", "chain") REFERENCES "Token"("address", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementGroupMember" ADD CONSTRAINT "MovementGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MovementGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementGroupMember" ADD CONSTRAINT "MovementGroupMember_walletAddress_walletChain_fkey" FOREIGN KEY ("walletAddress", "walletChain") REFERENCES "Wallet"("address", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementGroupMember" ADD CONSTRAINT "MovementGroupMember_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "MovementEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletState" ADD CONSTRAINT "WalletState_walletAddress_walletChain_fkey" FOREIGN KEY ("walletAddress", "walletChain") REFERENCES "Wallet"("address", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_walletAddress_walletChain_fkey" FOREIGN KEY ("walletAddress", "walletChain") REFERENCES "Wallet"("address", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_walletAddress_walletChain_fkey" FOREIGN KEY ("walletAddress", "walletChain") REFERENCES "Wallet"("address", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_tokenAddress_tokenChain_fkey" FOREIGN KEY ("tokenAddress", "tokenChain") REFERENCES "Token"("address", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTrade" ADD CONSTRAINT "UserTrade_ownWalletAddress_ownChain_fkey" FOREIGN KEY ("ownWalletAddress", "ownChain") REFERENCES "Wallet"("address", "chain") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTrade" ADD CONSTRAINT "UserTrade_followedWalletAddress_followedWalletChain_fkey" FOREIGN KEY ("followedWalletAddress", "followedWalletChain") REFERENCES "Wallet"("address", "chain") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTrade" ADD CONSTRAINT "UserTrade_tokenAddress_tokenChain_fkey" FOREIGN KEY ("tokenAddress", "tokenChain") REFERENCES "Token"("address", "chain") ON DELETE CASCADE ON UPDATE CASCADE;
