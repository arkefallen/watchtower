// src/server/services/alert/evaluate.ts
import { prisma as defaultPrisma } from "@/server/db/client";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import type {
  EvaluateAlertsInput,
  AlertEvaluateResult,
  RuleFinding,
} from "@/lib/rules/types";
import { ALERT_RULES } from "@/lib/rules/registry";
import { loadSettings } from "@/server/services/settings";
import {
  chainSlugToPrisma,
  prismaToChainSlug,
  normalizeAddress,
} from "@/server/services/wallet/normalize";
import { loadRuleContext } from "@/server/services/alert/context";
import { applyStateTransition, evaluateDeArm } from "@/server/services/alert/state-machine";
import { persistAlerts } from "@/server/services/alert/persist";
import { isTelegramEnabled, sendTelegramAlert } from "@/server/services/alert/telegram";

/**
 * Orchestrates alert evaluation for Watchtower Phase 4.
 *
 * Concurrency 1 ensures alert creation is race-free.
 * INCREMENTAL mode: selects newly ingested MovementEvent rows (alertEvaluatedAt IS NULL),
 * loads context, executes rules in ordered sequence (arming -> triggers -> exit-risk -> de-arm),
 * applies state transitions, persists findings, and updates alertEvaluatedAt.
 *
 * BACKFILL mode: replays historical daily slices in ascending order under a virtual clock.
 * Fully idempotent: re-evaluating the same historical window creates zero new alerts and
 * reports them suppressed.
 */
export async function evaluateAlerts(
  input: EvaluateAlertsInput & {
    prisma?: PrismaClient;
    now?: Date;
    ruleRegistry?: typeof ALERT_RULES;
  }
): Promise<AlertEvaluateResult> {
  const startTime = Date.now();
  const prisma = input.prisma ?? defaultPrisma;
  const settings = await loadSettings();
  const registry = input.ruleRegistry ?? ALERT_RULES;
  const evaluationNow = input.now ?? new Date();

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const telegramEnabled = isTelegramEnabled(settings);

  let totalAlertsCreated = 0;
  let totalAlertsSuppressed = 0;
  let totalStateTransitions = 0;
  const evaluatedWalletsSet = new Set<string>();

  if (input.mode === "INCREMENTAL") {
    // 1. Select newly ingested events where alertEvaluatedAt IS NULL
    const where: Prisma.MovementEventWhereInput = {
      alertEvaluatedAt: null,
    };

    if (input.scope?.address) {
      where.walletAddress = normalizeAddress(input.scope.address);
    }
    if (input.scope?.chain) {
      where.walletChain = chainSlugToPrisma(input.scope.chain);
    }
    if (input.from || input.to) {
      const timestampFilter: Prisma.DateTimeFilter = {};
      if (input.from) timestampFilter.gte = input.from;
      if (input.to) timestampFilter.lte = input.to;
      where.timestamp = timestampFilter;
    }

    const unevaluatedEvents = await prisma.movementEvent.findMany({
      where,
      orderBy: { timestamp: "asc" },
    });

    if (unevaluatedEvents.length === 0) {
      return {
        mode: "INCREMENTAL",
        walletsEvaluated: 0,
        alertsCreated: 0,
        alertsSuppressed: 0,
        stateTransitions: 0,
        durationMs: Date.now() - startTime,
      };
    }

    // Group events by wallet (address + chain)
    const walletMap = new Map<string, { address: string; chain: string }>();
    for (const event of unevaluatedEvents) {
      const key = `${event.walletAddress.toLowerCase()}:${event.walletChain}`;
      if (!walletMap.has(key)) {
        walletMap.set(key, {
          address: event.walletAddress,
          chain: event.walletChain,
        });
      }
    }

    let progressCount = 0;
    const totalWallets = walletMap.size;

    for (const [, { address, chain }] of walletMap) {
      const chainSlug = prismaToChainSlug(chain);
      evaluatedWalletsSet.add(`${address.toLowerCase()}:${chainSlug}`);

      const ctx = await loadRuleContext(address, chainSlug, {
        now: evaluationNow,
        thresholds: settings.alertThresholds,
        prisma,
        gradedDefinition: settings.gradedDefinition,
      });

      // Execute rules in ordered sequence
      const findings: RuleFinding[] = [];
      const activeRuleIds = input.rules ?? (Object.keys(registry) as Array<keyof typeof registry>);

      // 1. Arming
      for (const ruleId of activeRuleIds) {
        const rule = registry[ruleId];
        if (rule && rule.category === "ARMING") {
          findings.push(...rule.evaluate(ctx));
        }
      }

      // 2. Triggers
      for (const ruleId of activeRuleIds) {
        const rule = registry[ruleId];
        if (rule && rule.category === "TRIGGER") {
          findings.push(...rule.evaluate(ctx));
        }
      }

      // 3. Exit-risk
      for (const ruleId of activeRuleIds) {
        const rule = registry[ruleId];
        if (rule && rule.category === "EXIT_RISK") {
          findings.push(...rule.evaluate(ctx));
        }
      }

      // 4. De-arm condition
      const deArm = evaluateDeArm(ctx);

      // Apply state transitions
      const transition = applyStateTransition(ctx.state.current, findings, deArm);
      if (transition.transitionOccurred) {
        totalStateTransitions++;
        const normAddr = normalizeAddress(address);
        const pChain = chainSlugToPrisma(chainSlug);

        await prisma.walletState.upsert({
          where: {
            walletAddress_walletChain: {
              walletAddress: normAddr,
              walletChain: pChain,
            },
          },
          create: {
            walletAddress: normAddr,
            walletChain: pChain,
            state: transition.nextState,
            stateReason: transition.stateReason,
            armedAt: transition.nextState === "ARMED" ? evaluationNow : null,
            triggeredAt: transition.nextState === "TRIGGERED" ? evaluationNow : null,
            lastEvaluatedAt: evaluationNow,
          },
          update: {
            state: transition.nextState,
            stateReason: transition.stateReason,
            armedAt: transition.nextState === "ARMED" ? (ctx.state.current === "ARMED" ? ctx.state.armedAt : evaluationNow) : (transition.nextState === "IDLE" ? null : ctx.state.armedAt),
            triggeredAt: transition.nextState === "TRIGGERED" ? (ctx.state.current === "TRIGGERED" ? ctx.state.triggeredAt : evaluationNow) : (transition.nextState === "IDLE" ? null : ctx.state.triggeredAt),
            lastEvaluatedAt: evaluationNow,
          },
        });
      }

      // Persist findings
      const persistRes = await persistAlerts(findings, prisma);
      totalAlertsCreated += persistRes.alertsCreated;
      totalAlertsSuppressed += persistRes.alertsSuppressed;

      // Deliver via Telegram if configured
      if (telegramEnabled && persistRes.createdAlerts.length > 0) {
        for (const createdAlert of persistRes.createdAlerts) {
          await sendTelegramAlert(createdAlert, botToken, chatId, prisma);
        }
      }

      progressCount++;
      if (input.onProgress) {
        await input.onProgress({
          percent: Math.round((progressCount / totalWallets) * 100),
          message: `Evaluated wallet ${address} (${progressCount}/${totalWallets})`,
        });
      }
    }

    // Mark processed events as evaluated
    const processedIds = unevaluatedEvents.map((e) => e.id);
    await prisma.movementEvent.updateMany({
      where: {
        id: { in: processedIds },
      },
      data: {
        alertEvaluatedAt: evaluationNow,
      },
    });
  } else {
    // BACKFILL mode: replay historical daily slices in ascending order under virtual clock
    const where: Prisma.MovementEventWhereInput = {};
    if (input.scope?.address) {
      where.walletAddress = normalizeAddress(input.scope.address);
    }
    if (input.scope?.chain) {
      where.walletChain = chainSlugToPrisma(input.scope.chain);
    }

    // Determine backfill window
    let from = input.from;
    let to = input.to ?? evaluationNow;

    if (!from) {
      const earliestEvent = await prisma.movementEvent.findFirst({
        where,
        orderBy: { timestamp: "asc" },
      });
      from = earliestEvent ? earliestEvent.timestamp : new Date(to.getTime() - 7 * 86400000);
    }

    // Generate daily slices in chronological ascending order
    const slices: Array<{ start: Date; end: Date }> = [];
    let sliceStart = new Date(from.getTime());
    sliceStart.setUTCHours(0, 0, 0, 0);

    while (sliceStart < to) {
      const nextDay = new Date(sliceStart.getTime() + 24 * 3600 * 1000);
      const sliceEnd = nextDay > to ? to : nextDay;
      slices.push({ start: new Date(sliceStart), end: sliceEnd });
      sliceStart = nextDay;
    }

    // Identify all wallets within scope or with movements
    const movementsInRange = await prisma.movementEvent.findMany({
      where: {
        ...where,
        timestamp: {
          gte: from,
          lte: to,
        },
      },
      select: {
        walletAddress: true,
        walletChain: true,
      },
    });

    const walletMap = new Map<string, { address: string; chain: string }>();
    if (input.scope?.address) {
      const addr = normalizeAddress(input.scope.address);
      const chain = input.scope.chain ? chainSlugToPrisma(input.scope.chain) : "BASE";
      walletMap.set(`${addr}:${chain}`, { address: addr, chain });
    }
    for (const m of movementsInRange) {
      const key = `${m.walletAddress.toLowerCase()}:${m.walletChain}`;
      if (!walletMap.has(key)) {
        walletMap.set(key, { address: m.walletAddress, chain: m.walletChain });
      }
    }

    const totalSteps = slices.length * Math.max(1, walletMap.size);
    let stepCount = 0;

    // Replay slices under virtual clock
    for (const slice of slices) {
      const virtualClock = slice.end;

      for (const [, { address, chain }] of walletMap) {
        const chainSlug = prismaToChainSlug(chain);
        evaluatedWalletsSet.add(`${address.toLowerCase()}:${chainSlug}`);

        const ctx = await loadRuleContext(address, chainSlug, {
          now: virtualClock,
          thresholds: settings.alertThresholds,
          prisma,
          gradedDefinition: settings.gradedDefinition,
        });

        const findings: RuleFinding[] = [];
        const activeRuleIds = input.rules ?? (Object.keys(registry) as Array<keyof typeof registry>);

        for (const ruleId of activeRuleIds) {
          const rule = registry[ruleId];
          if (rule && rule.category === "ARMING") {
            findings.push(...rule.evaluate(ctx));
          }
        }
        for (const ruleId of activeRuleIds) {
          const rule = registry[ruleId];
          if (rule && rule.category === "TRIGGER") {
            findings.push(...rule.evaluate(ctx));
          }
        }
        for (const ruleId of activeRuleIds) {
          const rule = registry[ruleId];
          if (rule && rule.category === "EXIT_RISK") {
            findings.push(...rule.evaluate(ctx));
          }
        }

        const deArm = evaluateDeArm(ctx);
        const transition = applyStateTransition(ctx.state.current, findings, deArm);

        if (transition.transitionOccurred) {
          totalStateTransitions++;
          const normAddr = normalizeAddress(address);
          const pChain = chainSlugToPrisma(chainSlug);

          await prisma.walletState.upsert({
            where: {
              walletAddress_walletChain: {
                walletAddress: normAddr,
                walletChain: pChain,
              },
            },
            create: {
              walletAddress: normAddr,
              walletChain: pChain,
              state: transition.nextState,
              stateReason: transition.stateReason,
              armedAt: transition.nextState === "ARMED" ? virtualClock : null,
              triggeredAt: transition.nextState === "TRIGGERED" ? virtualClock : null,
              lastEvaluatedAt: virtualClock,
            },
            update: {
              state: transition.nextState,
              stateReason: transition.stateReason,
              armedAt: transition.nextState === "ARMED" ? (ctx.state.current === "ARMED" ? ctx.state.armedAt : virtualClock) : (transition.nextState === "IDLE" ? null : ctx.state.armedAt),
              triggeredAt: transition.nextState === "TRIGGERED" ? (ctx.state.current === "TRIGGERED" ? ctx.state.triggeredAt : virtualClock) : (transition.nextState === "IDLE" ? null : ctx.state.triggeredAt),
              lastEvaluatedAt: virtualClock,
            },
          });
        }

        const persistRes = await persistAlerts(findings, prisma);
        totalAlertsCreated += persistRes.alertsCreated;
        totalAlertsSuppressed += persistRes.alertsSuppressed;

        stepCount++;
        if (input.onProgress) {
          await input.onProgress({
            percent: Math.round((stepCount / totalSteps) * 100),
            message: `Replaying slice ${slice.start.toISOString().slice(0, 10)} for ${address}`,
          });
        }
      }
    }

    // Mark backfilled events evaluated
    await prisma.movementEvent.updateMany({
      where: {
        ...where,
        timestamp: {
          gte: from,
          lte: to,
        },
      },
      data: {
        alertEvaluatedAt: evaluationNow,
      },
    });
  }

  return {
    mode: input.mode,
    walletsEvaluated: evaluatedWalletsSet.size,
    alertsCreated: totalAlertsCreated,
    alertsSuppressed: totalAlertsSuppressed,
    stateTransitions: totalStateTransitions,
    durationMs: Date.now() - startTime,
  };
}
