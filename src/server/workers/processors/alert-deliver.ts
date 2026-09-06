// src/server/workers/processors/alert-deliver.ts
import type { Job } from "bullmq";
import { prisma as defaultPrisma } from "@/server/db/client";
import type { PrismaClient } from "@/generated/prisma/client";
import { sendTelegramAlert, type TelegramSendResult } from "@/server/services/alert/telegram";

export interface AlertDeliverJobPayload {
  alertId: string;
  botToken?: string;
  chatId?: string;
}

/**
 * BullMQ worker processor for the `alert.deliver` queue.
 * Delivers formatted alert to Telegram and records delivery status.
 */
export async function processAlertDeliverJob(
  job: Job<AlertDeliverJobPayload>,
  injectedPrisma?: PrismaClient
): Promise<TelegramSendResult> {
  const { alertId } = job.data;
  const prisma = injectedPrisma ?? defaultPrisma;

  const alert = await prisma.alertEvent.findUnique({
    where: { id: alertId },
    include: {
      wallet: true,
    },
  });

  if (!alert) {
    return {
      success: false,
      error: `AlertEvent ${alertId} not found`,
    };
  }

  const botToken = job.data.botToken ?? process.env.TELEGRAM_BOT_TOKEN;
  const chatId = job.data.chatId ?? process.env.TELEGRAM_CHAT_ID;

  return sendTelegramAlert(alert, botToken, chatId, prisma);
}
