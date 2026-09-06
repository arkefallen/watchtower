// src/server/services/alert/telegram.ts
import { prisma as defaultPrisma } from "@/server/db/client";
import type { PrismaClient, AlertEvent, Wallet } from "@/generated/prisma/client";
import { ALERT_RULES_METADATA } from "@/lib/rules/evidence";
import type { SettingsSnapshot } from "@/lib/settings-schema";

export type AlertWithWallet = AlertEvent & {
  wallet?: Partial<Wallet> | null;
};

export interface TelegramSendResult {
  success: boolean;
  deliveredAt?: Date;
  error?: string;
}

/**
 * Formats a Telegram alert message using HTML markup.
 * Includes rule, wallet label, token, amounts, and explorer links per FR-5.3.
 */
export function formatAlertTelegramMessage(
  alert: Partial<AlertEvent>,
  wallet?: Partial<Wallet> | null
): string {
  const ruleMeta = alert.type ? ALERT_RULES_METADATA[alert.type] : undefined;
  const ruleTitle = ruleMeta ? `${ruleMeta.id} — ${ruleMeta.name}` : alert.type ?? "Alert";

  const walletAddr = alert.walletAddress ?? wallet?.address ?? "Unknown";
  const shortAddr =
    walletAddr.length === 42
      ? `${walletAddr.slice(0, 6)}...${walletAddr.slice(-4)}`
      : walletAddr;

  const walletLabel = wallet?.label || wallet?.ensName || null;
  const walletDisplay = walletLabel ? `${walletLabel} (<code>${shortAddr}</code>)` : `<code>${shortAddr}</code>`;

  const lines: string[] = [
    `🔔 <b>Watchtower Alert: ${ruleTitle}</b>`,
    `<b>State:</b> <code>${alert.state ?? "UNKNOWN"}</code>`,
    `<b>Wallet:</b> ${walletDisplay}`,
  ];

  if (alert.tokenSymbol || alert.tokenAddress) {
    const tokenDisplay = alert.tokenSymbol
      ? `${alert.tokenSymbol} (${alert.tokenAddress ?? "n/a"})`
      : alert.tokenAddress ?? "n/a";
    lines.push(`<b>Token:</b> <code>${tokenDisplay}</code>`);
  }

  if (alert.amountUsd !== null && alert.amountUsd !== undefined) {
    const num =
      typeof alert.amountUsd === "number"
        ? alert.amountUsd
        : parseFloat(alert.amountUsd.toString());
    if (!isNaN(num)) {
      lines.push(`<b>Amount:</b> $${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    }
  }

  // Extract tx links or details from evidence if available
  const evidence = alert.evidenceJson as Record<string, unknown> | null;
  if (evidence) {
    if (evidence.ruleText && typeof evidence.ruleText === "string") {
      lines.push(`<i>${evidence.ruleText}</i>`);
    }

    if (Array.isArray(evidence.txLinks) && evidence.txLinks.length > 0) {
      const validLinks = evidence.txLinks.filter(
        (l): l is { hash?: string; url?: string; label?: string } =>
          typeof l === "object" && l !== null
      );
      for (const link of validLinks) {
        if (link.url && link.url.startsWith("http")) {
          lines.push(`🔗 <a href="${link.url}">${link.label ?? link.hash ?? "Explorer Link"}</a>`);
        }
      }
    }
  }

  return lines.join("\n");
}

/**
 * Checks whether Telegram notifications are enabled and configured.
 */
export function isTelegramEnabled(
  settings: SettingsSnapshot,
  env: { TELEGRAM_BOT_TOKEN?: string; TELEGRAM_CHAT_ID?: string } = process.env as {
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_CHAT_ID?: string;
  }
): boolean {
  if (!settings.telegram?.enabled) {
    return false;
  }
  const hasEnv = Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);
  return hasEnv || Boolean(settings.telegram.hasCredentials);
}

/**
 * Sends a Telegram alert and records deliveredAt or deliveryError on AlertEvent.
 * Delivery failures NEVER throw or fail caller execution.
 */
export async function sendTelegramAlert(
  alert: AlertWithWallet,
  botToken?: string,
  chatId?: string,
  injectedPrisma?: PrismaClient
): Promise<TelegramSendResult> {
  const prisma = injectedPrisma ?? defaultPrisma;

  if (!botToken || !chatId) {
    const error = "Telegram delivery disabled or missing credentials (botToken / chatId)";
    if (alert.id && prisma) {
      try {
        await prisma.alertEvent.update({
          where: { id: alert.id },
          data: { deliveryError: error },
        });
      } catch {
        // Silently ignore update error in mock environments
      }
    }
    return { success: false, error };
  }

  const messageText = formatAlertTelegramMessage(alert, alert.wallet);

  try {
    const url = `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const data = (await response.json().catch(() => null)) as {
      ok?: boolean;
      description?: string;
    } | null;

    if (response.ok && data?.ok) {
      const deliveredAt = new Date();
      if (alert.id && prisma) {
        try {
          await prisma.alertEvent.update({
            where: { id: alert.id },
            data: {
              deliveredAt,
              deliveryError: null,
            },
          });
        } catch {
          // Silently ignore update error
        }
      }
      return { success: true, deliveredAt };
    }

    const error = data?.description ?? `Telegram API error: HTTP ${response.status} ${response.statusText}`;
    if (alert.id && prisma) {
      try {
        await prisma.alertEvent.update({
          where: { id: alert.id },
          data: { deliveryError: error },
        });
      } catch {
        // Silently ignore update error
      }
    }
    return { success: false, error };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Failed to contact Telegram API";
    if (alert.id && prisma) {
      try {
        await prisma.alertEvent.update({
          where: { id: alert.id },
          data: { deliveryError: error },
        });
      } catch {
        // Silently ignore update error
      }
    }
    return { success: false, error };
  }
}
