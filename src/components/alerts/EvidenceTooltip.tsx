"use client";

import React, { useState } from "react";
import {
  validateEvidence,
  getTxExplorerUrl,
  ALERT_RULES_METADATA,
  type AlertEvidence,
} from "@/lib/rules/evidence";

export interface EvidenceTooltipProps {
  evidenceJson: unknown;
  alertType?: string;
  chain?: string;
  className?: string;
}

export function EvidenceTooltip({
  evidenceJson,
  alertType,
  chain = "base",
  className = "",
}: EvidenceTooltipProps) {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const validation = validateEvidence(evidenceJson);

  if (!validation.success) {
    return (
      <div
        role="alert"
        className={`p-3.5 border border-[#D87870] bg-[#D87870]/10 text-[#D87870] font-mono text-[12px] rounded-none ${className}`}
      >
        <div className="flex items-center gap-2 font-bold tracking-wider">
          <span className="text-[16px]">⚠️</span>
          <span>MALFORMED EVIDENCE TRAIL</span>
        </div>
        <p className="mt-1 text-[11px] text-[#D87870]/90">
          missing ruleText / txLinks
        </p>
      </div>
    );
  }

  const evidence: AlertEvidence = validation.data;
  const ruleMeta = ALERT_RULES_METADATA[evidence.ruleId] || (alertType ? ALERT_RULES_METADATA[alertType] : undefined);
  const ruleName = evidence.ruleName || ruleMeta?.name || evidence.ruleId;
  const isEscalatedA5 = evidence.ruleId === "A5";

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedHash(text);
      setTimeout(() => setCopiedHash(null), 1500);
    } catch {
      // Ignore clipboard fallback error
    }
  };

  return (
    <div
      className={`space-y-4 text-[#E8ECEF] font-mono text-[12px] ${
        isEscalatedA5 ? "border border-[#D7A84B] shadow-[0_0_12px_rgba(215,168,75,0.25)] p-3 bg-[#171A1D]" : ""
      } ${className}`}
    >
      {/* Escalated Banner for A5 */}
      {isEscalatedA5 && (
        <div className="flex items-center justify-between p-2 bg-[#D7A84B]/20 border border-[#D7A84B] text-[#D7A84B] text-[11px] font-bold tracking-wider">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-[#D7A84B] rounded-none animate-ping" />
            A5 CLUSTER ARMING [ESCALATED]
          </span>
          <span className="px-1.5 py-0.2 bg-[#D7A84B] text-[#101214] font-mono text-[9px] uppercase">
            HIGH PRIORITY
          </span>
        </div>
      )}

      {/* Rule Header & Rule Text */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between border-b border-[#30373D] pb-1.5">
          <span className="text-[#D7A84B] font-bold text-[13px] tracking-wide">
            {evidence.ruleId} — {ruleName.toUpperCase()}
          </span>
          {ruleMeta?.category && (
            <span
              className={`text-[9px] px-1.5 py-0.5 uppercase tracking-widest font-semibold ${
                ruleMeta.category === "ARMING"
                  ? "bg-[#D7A84B]/20 text-[#D7A84B] border border-[#D7A84B]/50"
                  : ruleMeta.category === "TRIGGER"
                  ? "bg-[#D87870]/20 text-[#D87870] border border-[#D87870]/50"
                  : "bg-[#E59866]/20 text-[#E59866] border border-[#E59866]/50"
              }`}
            >
              {ruleMeta.category}
            </span>
          )}
        </div>
        <div className="bg-[#121416] p-2.5 border border-[#30373D] text-[11px] text-[#929BA3] italic leading-relaxed">
          {evidence.ruleText}
        </div>
      </div>

      {/* Threshold Conditions vs Binding Arm */}
      <div className="space-y-2">
        <div className="flex items-center justify-between border-b border-[#30373D] pb-1">
          <span className="text-[10px] text-[#929BA3] uppercase tracking-wider font-semibold">
            Configured Thresholds vs Binding Arm
          </span>
          {evidence.bindingArm && (
            <span className="text-[10px] text-[#79B79A] font-semibold">
              BINDING: {evidence.bindingArm}
            </span>
          )}
        </div>

        {evidence.thresholds && Object.keys(evidence.thresholds).length > 0 ? (
          <div className="grid grid-cols-1 gap-1.5">
            {Object.entries(evidence.thresholds).map(([key, val]) => (
              <div
                key={key}
                className="flex items-center justify-between bg-[#121416] px-2.5 py-1.5 border border-[#30373D]"
              >
                <span className="text-[11px] text-[#929BA3]">{key}</span>
                <span className="text-[11px] font-semibold text-[#E8ECEF]">
                  {typeof val === "object" ? JSON.stringify(val) : String(val)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-[#929BA3] bg-[#121416] p-2 border border-[#30373D]">
            Standard rule thresholds configured
          </div>
        )}
      </div>

      {/* Observed Values */}
      {evidence.observed && Object.keys(evidence.observed).length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] text-[#929BA3] uppercase tracking-wider font-semibold border-b border-[#30373D] pb-1">
            Observed Metrics
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {Object.entries(evidence.observed).map(([key, val]) => (
              <div
                key={key}
                className="flex items-center justify-between bg-[#121416] px-2.5 py-1.5 border border-[#30373D]"
              >
                <span className="text-[11px] text-[#929BA3]">{key}</span>
                <span className="text-[11px] font-bold text-[#D7A84B]">
                  {typeof val === "object" ? JSON.stringify(val) : String(val)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evaluation Windows */}
      {evidence.windows && Object.keys(evidence.windows).length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] text-[#929BA3] uppercase tracking-wider font-semibold border-b border-[#30373D] pb-1">
            Evaluation Window
          </div>
          <div className="bg-[#121416] p-2 border border-[#30373D] text-[11px] text-[#929BA3] space-y-1">
            {Object.entries(evidence.windows).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span>{k}:</span>
                <span className="text-[#E8ECEF] font-medium">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cluster Context (if present) */}
      {evidence.clusterContext && (
        <div className="space-y-1.5 p-2 bg-[#1E2327] border border-[#30373D]">
          <div className="text-[10px] text-[#D7A84B] uppercase tracking-wider font-bold">
            Cluster Context
          </div>
          <div className="text-[11px] space-y-1 text-[#929BA3]">
            {evidence.clusterContext.clusterName && (
              <div className="flex justify-between">
                <span>Cluster:</span>
                <span className="text-[#E8ECEF]">{evidence.clusterContext.clusterName}</span>
              </div>
            )}
            {evidence.clusterContext.memberCount !== undefined && (
              <div className="flex justify-between">
                <span>Members Armed:</span>
                <span className="text-[#E8ECEF]">{evidence.clusterContext.memberCount}</span>
              </div>
            )}
            {evidence.clusterContext.sharedFunder && (
              <div className="flex justify-between items-center">
                <span>Shared Funder:</span>
                <span className="font-mono text-[#D7A84B] text-[10px]">
                  {evidence.clusterContext.sharedFunder.slice(0, 8)}...{evidence.clusterContext.sharedFunder.slice(-6)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Block Explorer Transaction Links */}
      <div className="space-y-2">
        <div className="text-[10px] text-[#929BA3] uppercase tracking-wider font-semibold border-b border-[#30373D] pb-1">
          Evidence Transactions ({evidence.txLinks.length})
        </div>
        {evidence.txLinks.length === 0 ? (
          <div className="text-[11px] text-[#929BA3] bg-[#121416] p-2 border border-[#30373D]">
            No transaction hashes attached
          </div>
        ) : (
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {evidence.txLinks.map((link, idx) => {
              const hash = typeof link === "string" ? link : link.hash;
              const linkChain = typeof link === "object" ? link.chain || chain : chain;
              const url = typeof link === "object" && link.url ? link.url : getTxExplorerUrl(hash, linkChain);
              const label = typeof link === "object" && link.label ? link.label : `Tx #${idx + 1}`;
              const isCopied = copiedHash === hash;

              return (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-[#121416] p-2 border border-[#30373D] text-[11px] group hover:border-[#D7A84B]/60 transition-colors"
                >
                  <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                    <span className="text-[#929BA3] shrink-0">{label}:</span>
                    <span className="font-mono text-[#D7A84B] truncate">
                      {hash.length > 18 ? `${hash.slice(0, 10)}...${hash.slice(-6)}` : hash}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(hash)}
                      title="Copy transaction hash"
                      aria-label={`Copy transaction hash ${hash}`}
                      className="px-1.5 py-0.5 bg-[#1E2327] hover:bg-[#30373D] text-[#929BA3] hover:text-[#E8ECEF] text-[10px] border border-[#30373D]"
                    >
                      {isCopied ? "COPIED" : "COPY"}
                    </button>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open in block explorer"
                      aria-label={`View transaction ${hash} in block explorer`}
                      className="px-1.5 py-0.5 bg-[#1E2327] hover:bg-[#D7A84B] hover:text-[#101214] text-[#D7A84B] text-[10px] font-bold border border-[#30373D] flex items-center gap-0.5"
                    >
                      <span>VIEW</span>
                      <span>↗</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
