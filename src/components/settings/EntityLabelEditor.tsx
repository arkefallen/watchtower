"use client";

import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import type { ChainSlug } from "@/lib/chains/types";

export type EntityKind = "CEX" | "BRIDGE" | "ROUTER" | "CONTRACT" | "HUMAN";

interface EntityLabelEditorProps {
  address: string;
  chain: ChainSlug;
  currentLabel?: {
    name?: string;
    kind?: string;
    isTerminal?: boolean;
    notes?: string | null;
  } | null;
  onSaved?: () => void;
  onClose?: () => void;
}

const KINDS: EntityKind[] = ["CEX", "BRIDGE", "ROUTER", "CONTRACT", "HUMAN"];

export function EntityLabelEditor({
  address,
  chain,
  currentLabel,
  onSaved,
  onClose,
}: EntityLabelEditorProps) {
  const [name, setName] = useState(currentLabel?.name ?? "");
  const [kind, setKind] = useState<EntityKind>(
    (currentLabel?.kind as EntityKind) ?? "CEX"
  );
  const [isTerminal, setIsTerminal] = useState(currentLabel?.isTerminal ?? true);
  const [notes, setNotes] = useState(currentLabel?.notes ?? "");
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  useEffect(() => {
    if (currentLabel) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(currentLabel.name ?? "");
      setKind((currentLabel.kind as EntityKind) ?? "CEX");
      setIsTerminal(currentLabel.isTerminal ?? true);
      setNotes(currentLabel.notes ?? "");
    }
  }, [currentLabel]);

  // If kind is HUMAN, terminal is forced to false
  const handleKindChange = (newKind: EntityKind) => {
    setKind(newKind);
    if (newKind === "HUMAN") {
      setIsTerminal(false);
    } else {
      setIsTerminal(true);
    }
  };

  const utils = trpc.useUtils();
  const setMutation = trpc.wallet.setEntityLabel.useMutation({
    onSuccess: () => {
      setStatusMsg({ type: "success", text: "Entity label saved." });
      utils.wallet.get.invalidate({ address, chain });
      utils.funding.tree.invalidate({ address, chain });
      onSaved?.();
      setTimeout(() => setStatusMsg(null), 3000);
    },
    onError: (err) => {
      setStatusMsg({ type: "error", text: err.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setStatusMsg({ type: "error", text: "Entity name is required." });
      return;
    }
    setMutation.mutate({
      address,
      chain,
      name: name.trim(),
      kind,
      isTerminal,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="bg-[#171A1D] border border-[#30373D] p-4 text-[#E8ECEF]">
      <div className="flex items-center justify-between pb-3 border-b border-[#30373D] mb-4">
        <div>
          <div className="text-[12px] font-semibold tracking-wider text-[#D7A84B] uppercase font-sans">
            Custom Entity Label
          </div>
          <div className="text-[10px] font-mono text-[#929BA3] mt-0.5 truncate max-w-[240px]">
            {address}
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-[#929BA3] hover:text-[#E8ECEF] bg-[#101214] border border-[#30373D]"
          >
            ✕
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 font-mono text-[12px]">
        {/* Name input */}
        <div>
          <label className="block text-[10px] uppercase font-semibold text-[#929BA3] mb-1 font-sans">
            Entity / Entity Cluster Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Binance 14 or Syndicate Funder"
            className="w-full bg-[#101214] border border-[#30373D] px-3 py-1.5 text-[#E8ECEF] focus:border-[#D7A84B] focus:outline-none"
          />
        </div>

        {/* Kind selector */}
        <div>
          <label className="block text-[10px] uppercase font-semibold text-[#929BA3] mb-1 font-sans">
            Entity Kind
          </label>
          <div className="grid grid-cols-3 gap-1">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleKindChange(k)}
                className={`py-1 px-1.5 text-center text-[10px] border transition-colors ${
                  kind === k
                    ? "bg-[#D7A84B] text-[#101214] border-[#D7A84B] font-bold"
                    : "bg-[#101214] text-[#929BA3] border-[#30373D] hover:border-[#929BA3]"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        {/* Terminal Toggle */}
        <div className="flex items-center justify-between p-2 bg-[#101214] border border-[#30373D]">
          <div>
            <div className="text-[11px] font-semibold text-[#E8ECEF] font-sans">
              Terminal Entity Leaf
            </div>
            <div className="text-[10px] text-[#929BA3]">
              Stops funding tracer recursion at this node
            </div>
          </div>
          <button
            type="button"
            disabled={kind === "HUMAN"}
            onClick={() => setIsTerminal(!isTerminal)}
            className={`px-2.5 py-1 text-[10px] font-bold border ${
              isTerminal
                ? "bg-[#79B79A] text-[#101214] border-[#79B79A]"
                : "bg-[#171A1D] text-[#929BA3] border-[#30373D]"
            } ${kind === "HUMAN" ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {isTerminal ? "YES (TERMINAL)" : "NO"}
          </button>
        </div>

        {/* Notes input */}
        <div>
          <label className="block text-[10px] uppercase font-semibold text-[#929BA3] mb-1 font-sans">
            Investigation Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Verified CEX deposit address, known insider, etc."
            className="w-full bg-[#101214] border border-[#30373D] px-3 py-1.5 text-[#E8ECEF] focus:border-[#D7A84B] focus:outline-none"
          />
        </div>

        {statusMsg && (
          <div
            className={`p-2 text-[11px] border ${
              statusMsg.type === "success"
                ? "bg-[#79B79A]/10 border-[#79B79A] text-[#79B79A]"
                : "bg-[#D87870]/10 border-[#D87870] text-[#D87870]"
            }`}
          >
            {statusMsg.text}
          </div>
        )}

        <div className="pt-2 flex justify-end gap-2">
          <button
            type="submit"
            disabled={setMutation.isPending}
            className="w-full py-2 bg-[#D7A84B] text-[#101214] hover:bg-[#f5c363] font-bold uppercase tracking-wider text-[11px] transition-colors font-sans"
          >
            {setMutation.isPending ? "Saving..." : "Save Custom Entity Label"}
          </button>
        </div>
      </form>
    </div>
  );
}
