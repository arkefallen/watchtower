// tests/unit/telegram.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma, type PrismaClient, type AlertEvent } from "@/generated/prisma/client";
import {
  formatAlertTelegramMessage,
  sendTelegramAlert,
  isTelegramEnabled,
  type AlertWithWallet,
} from "@/server/services/alert/telegram";
import { processAlertDeliverJob } from "@/server/workers/processors/alert-deliver";
import { DEFAULT_SETTINGS } from "@/lib/settings-schema";

vi.mock("@/server/db/client", () => ({
  prisma: {},
}));

vi.mock("@/server/services/settings", async () => {
  const { DEFAULT_SETTINGS } = await import("@/lib/settings-schema");
  return {
    loadSettings: vi.fn().mockResolvedValue(DEFAULT_SETTINGS),
  };
});

describe("Telegram Alert Formatting (formatAlertTelegramMessage)", () => {
  it("telegram: message includes rule, wallet, token, amounts, and links", () => {
    const alert: Partial<AlertEvent> = {
      id: "alert-123",
      type: "A1",
      state: "ARMED",
      walletAddress: "0x1111111111111111111111111111111111111111",
      tokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      tokenSymbol: "USDC",
      amountUsd: new Prisma.Decimal("1500.00"),
      evidenceJson: {
        ruleId: "A1",
        ruleText: "Wallet receives single-day stablecoin inflow >= max($1,000 floor, 3.0x 30-day median single-day inflow).",
        thresholds: { minUsd: 1000 },
        observed: { inflowUsd: "1500.00" },
        txLinks: [
          {
            hash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            url: "https://basescan.org/tx/0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            label: "Explorer Link",
          },
        ],
      },
    };

    const wallet = {
      address: "0x1111111111111111111111111111111111111111",
      label: "Alpha Fund",
      ensName: "alpha.eth",
    };

    const formatted = formatAlertTelegramMessage(alert, wallet);

    expect(formatted).toContain("Watchtower Alert: A1 — Stablecoin Arming");
    expect(formatted).toContain("<b>State:</b> <code>ARMED</code>");
    expect(formatted).toContain("Alpha Fund");
    expect(formatted).toContain("USDC");
    expect(formatted).toContain("$1,500.00");
    expect(formatted).toContain("https://basescan.org/tx/0xabcdef");
  });

  it("telegram: message formats cleanly without optional token or amount", () => {
    const alert: Partial<AlertEvent> = {
      type: "A4",
      state: "ARMED",
      walletAddress: "0x2222222222222222222222222222222222222222",
      tokenAddress: null,
      tokenSymbol: null,
      amountUsd: null,
      evidenceJson: {
        ruleId: "A4",
        ruleText: "Wallet inactive >= 30 days receives inbound funding >= $500 USD value.",
        txLinks: [],
      },
    };

    const formatted = formatAlertTelegramMessage(alert, null);

    expect(formatted).toContain("Watchtower Alert: A4 — Dormancy Wake");
    expect(formatted).toContain("<code>0x2222...2222</code>");
    expect(formatted).not.toContain("<b>Token:</b>");
    expect(formatted).not.toContain("<b>Amount:</b>");
  });
});

describe("Telegram Delivery Controls and API Handling", () => {
  let mockAlertsDb: AlertEvent[];
  let mockPrisma: PrismaClient;

  beforeEach(() => {
    mockAlertsDb = [
      {
        id: "alert-test-1",
        walletAddress: "0x1111111111111111111111111111111111111111",
        walletChain: "BASE",
        type: "A1",
        state: "ARMED",
        tokenAddress: null,
        tokenChain: null,
        tokenSymbol: null,
        amountUsd: new Prisma.Decimal("1500.00"),
        clusterId: null,
        payloadJson: {},
        evidenceJson: {
          ruleId: "A1",
          ruleText: "Test A1",
          txLinks: [],
        },
        dedupeKey: "A1:0x1111111111111111111111111111111111111111:base:-:100",
        occurredAt: new Date("2026-09-06T00:00:00Z"),
        createdAt: new Date("2026-09-06T00:00:00Z"),
        readAt: null,
        deliveredAt: null,
        deliveryError: null,
      } as unknown as AlertEvent,
    ];

    mockPrisma = {
      alertEvent: {
        findUnique: vi.fn().mockImplementation((args: { where: { id: string } }) => {
          const item = mockAlertsDb.find((a) => a.id === args.where.id) ?? null;
          return Promise.resolve(item);
        }),
        update: vi.fn().mockImplementation((args: { where: { id: string }; data: Partial<AlertEvent> }) => {
          const item = mockAlertsDb.find((a) => a.id === args.where.id);
          if (item) {
            Object.assign(item, args.data);
            return Promise.resolve(item);
          }
          throw new Error("Alert not found");
        }),
      },
    } as unknown as PrismaClient;
  });

  it("telegram: disabled by default, no outbound call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const isEnabled = isTelegramEnabled(DEFAULT_SETTINGS, {});
    expect(isEnabled).toBe(false);

    const alert = mockAlertsDb[0] as AlertWithWallet;
    // Calling sendTelegramAlert with missing credentials
    const result = await sendTelegramAlert(alert, undefined, undefined, mockPrisma);

    expect(result.success).toBe(false);
    expect(result.error).toContain("disabled or missing credentials");
    expect(fetchSpy).not.toHaveBeenCalled();

    // Verify deliveryError recorded on the alert
    expect(mockAlertsDb[0].deliveredAt).toBeNull();
    expect(mockAlertsDb[0].deliveryError).toContain("disabled or missing credentials");
  });

  it("telegram: delivers message successfully and records deliveredAt", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 101 } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const alert = mockAlertsDb[0] as AlertWithWallet;
    const result = await sendTelegramAlert(alert, "TEST_BOT_TOKEN", "-100123456", mockPrisma);

    expect(result.success).toBe(true);
    expect(result.deliveredAt).toBeInstanceOf(Date);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/botTEST_BOT_TOKEN/sendMessage",
      expect.objectContaining({
        method: "POST",
      })
    );

    // Verify alert in DB updated
    expect(mockAlertsDb[0].deliveredAt).not.toBeNull();
    expect(mockAlertsDb[0].deliveryError).toBeNull();
  });

  it("telegram: failure records deliveryError without throwing or failing evaluation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ ok: false, description: "chat not found" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const alert = mockAlertsDb[0] as AlertWithWallet;
    const result = await sendTelegramAlert(alert, "INVALID_TOKEN", "-9999", mockPrisma);

    expect(result.success).toBe(false);
    expect(result.error).toBe("chat not found");

    // Verify deliveryError is recorded verbatim
    expect(mockAlertsDb[0].deliveredAt).toBeNull();
    expect(mockAlertsDb[0].deliveryError).toBe("chat not found");
  });

  it("telegram: network error records deliveryError without throwing", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Connection refused"));
    vi.stubGlobal("fetch", fetchMock);

    const alert = mockAlertsDb[0] as AlertWithWallet;
    const result = await sendTelegramAlert(alert, "BOT_TOKEN", "123", mockPrisma);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Connection refused");
    expect(mockAlertsDb[0].deliveryError).toBe("Connection refused");
  });

  it("telegram: processAlertDeliverJob delivers via BullMQ job processor", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 102 } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const mockJob = {
      data: {
        alertId: "alert-test-1",
        botToken: "TOKEN_123",
        chatId: "CHAT_456",
      },
    };

    const jobResult = await processAlertDeliverJob(mockJob as unknown as Parameters<typeof processAlertDeliverJob>[0], mockPrisma);
    expect(jobResult.success).toBe(true);
    expect(mockAlertsDb[0].deliveredAt).not.toBeNull();
  });
});
