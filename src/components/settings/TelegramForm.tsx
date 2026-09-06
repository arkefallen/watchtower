"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc/client";

interface TelegramFormProps {
  enabled: boolean;
  hasCredentials: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  disabled?: boolean;
}

export function TelegramForm({
  enabled,
  hasCredentials,
  onToggleEnabled,
  disabled = false,
}: TelegramFormProps) {
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const testMutation = trpc.settings.testTelegram.useMutation({
    onSuccess: (data) => {
      setTestResult(data);
    },
    onError: (err) => {
      setTestResult({
        success: false,
        message: err.message || "Failed to execute Telegram test message",
      });
    },
  });

  const handleSendTest = () => {
    setTestResult(null);
    if (!botToken.trim()) {
      setTestResult({
        success: false,
        message: "Bot Token is required to send a test message.",
      });
      return;
    }
    if (!chatId.trim()) {
      setTestResult({
        success: false,
        message: "Target Chat ID is required to send a test message.",
      });
      return;
    }

    testMutation.mutate({
      botToken: botToken.trim(),
      chatId: chatId.trim(),
    });
  };

  return (
    <section className="flex flex-col gap-4" aria-labelledby="telegram-heading">
      <header className="border-b border-[#30373D] pb-2 flex justify-between items-end">
        <div>
          <h2 id="telegram-heading" className="text-[18px] font-bold text-[#E8ECEF] font-sans">
            Telegram Notifications
          </h2>
          <p className="text-[12px] text-[#929BA3] font-sans mt-0.5">
            Optional outbound alert webhook (FR-5.3, NFR-1 local-only exception)
          </p>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`font-mono text-[10px] uppercase tracking-wider ${
              enabled ? "text-[#D7A84B]" : "text-[#929BA3]"
            }`}
          >
            {enabled ? "Enabled" : "Disabled"}
          </span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              disabled={disabled}
              checked={enabled}
              onChange={(e) => onToggleEnabled(e.target.checked)}
              className="sr-only peer"
              aria-label="Toggle Telegram notifications"
            />
            <div className="w-9 h-5 bg-[#101214] border border-[#30373D] peer-focus:outline-none peer-checked:bg-[#D7A84B]/20 peer-checked:border-[#D7A84B] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#929BA3] after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-[#D7A84B]" />
          </label>
        </div>
      </header>

      <div className="bg-[#171A1D] border border-[#30373D] p-5 flex flex-col gap-4 h-full">
        {/* Credentials Status Banner */}
        <div className="flex items-center justify-between text-[11px] font-mono border-b border-[#30373D]/50 pb-3">
          <span className="text-[#929BA3]">Storage Status:</span>
          {hasCredentials ? (
            <span className="text-[#79B79A] flex items-center gap-1">
              ● CREDENTIALS DETECTED IN ENVIRONMENT
            </span>
          ) : (
            <span className="text-[#929BA3]">○ NO CREDENTIALS IN .ENV (USE TEST FORM BELOW)</span>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="telegram-bot-token" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] block">
              Bot Token (from @BotFather)
            </label>
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="text-[10px] font-mono text-[#929BA3] hover:text-[#E8ECEF]"
            >
              {showToken ? "HIDE" : "SHOW"}
            </button>
          </div>
          <input
            id="telegram-bot-token"
            type={showToken ? "text" : "password"}
            disabled={disabled}
            placeholder={hasCredentials ? "••••••••••••••••••••••••••••••••••••••••" : "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"}
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            className="w-full bg-[#101214] border border-[#30373D] text-[#E8ECEF] font-mono text-[13px] px-3 py-1.5 focus:border-[#D7A84B] focus:outline-none rounded-none tracking-wider"
          />
        </div>

        <div>
          <label htmlFor="telegram-chat-id" className="font-mono text-[10px] uppercase tracking-wider text-[#929BA3] mb-1 block">
            Target Chat ID / Channel ID
          </label>
          <input
            id="telegram-chat-id"
            type="text"
            disabled={disabled}
            placeholder="-1001234567890 or @your_channel"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            className="w-full bg-[#101214] border border-[#30373D] text-[#E8ECEF] font-mono text-[13px] px-3 py-1.5 focus:border-[#D7A84B] focus:outline-none rounded-none"
          />
        </div>

        {/* Live Notification Feedback Banner */}
        {testResult && (
          <div
            className={`p-3 border text-[11px] font-mono leading-tight ${
              testResult.success
                ? "border-[#79B79A] bg-[#79B79A]/10 text-[#79B79A]"
                : "border-[#D87870] bg-[#D87870]/10 text-[#D87870]"
            }`}
            role="alert"
          >
            {testResult.success ? (
              <div className="flex items-center gap-1.5">
                <span>●</span>
                <span className="font-bold">TEST MESSAGE DELIVERED:</span>
                <span>{testResult.message}</span>
              </div>
            ) : (
              <div className="flex items-start gap-1.5">
                <span>⚠️</span>
                <div>
                  <span className="font-bold">Delivery failed: </span>
                  <span>{testResult.message}</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-auto pt-4 border-t border-[#30373D]">
          <button
            type="button"
            disabled={disabled || testMutation.isPending}
            onClick={handleSendTest}
            className="w-full h-[40px] px-4 bg-[#101214] hover:bg-[#1E2327] border border-[#30373D] hover:border-[#D7A84B] text-[#E8ECEF] hover:text-[#D7A84B] font-sans text-[12px] font-semibold transition-colors flex items-center justify-center gap-2 rounded-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[16px]">send</span>
            <span>{testMutation.isPending ? "Sending Test Message..." : "Send Test Message"}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
