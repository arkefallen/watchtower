"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { LabelPreview } from "./LabelPreview";

export const EDGE_OPTIONS = ["SMART", "BOT", "DUMB", "EARLY", "INSIDER", "KOL", "DEGEN", "FRESH", "DEV"] as const;
export const STYLE_OPTIONS = ["SNIPER", "SWING", "RIDER", "ACCUMULATOR", "DCA", "JEET", "DIAMOND"] as const;
export const SIZE_OPTIONS = ["SHRIMP", "FISH", "DOLPHIN", "WHALE", "S", "M", "W"] as const;

export interface TagEditorProps {
  address: string;
  chain: "base" | "bsc" | "robinhood";
  initialEdge?: string | null;
  initialStyle?: string | null;
  initialSize?: string | null;
  initialLabel?: string | null;
  initialNotes?: string | null;
  initialWatchPriority?: "HIGH" | "NORMAL";
  initialIsBlacklisted?: boolean;
  initialIsSelf?: boolean;
  onSaved?: () => void;
  onCancel?: () => void;
  className?: string;
}

export function TagEditor({
  address,
  chain,
  initialEdge,
  initialStyle,
  initialSize,
  initialLabel,
  initialNotes,
  initialWatchPriority = "NORMAL",
  initialIsBlacklisted = false,
  initialIsSelf = false,
  onSaved,
  onCancel,
  className = "",
}: TagEditorProps) {
  const [edge, setEdge] = useState<string>(initialEdge ?? "");
  const [style, setStyle] = useState<string>(initialStyle ?? "");
  const [size, setSize] = useState<string>(initialSize ?? "");
  const [label, setLabel] = useState<string>(initialLabel ?? "");
  const [notes, setNotes] = useState<string>(initialNotes ?? "");
  const [watchPriority, setWatchPriority] = useState<"HIGH" | "NORMAL">(initialWatchPriority);
  const [isBlacklisted, setIsBlacklisted] = useState<boolean>(initialIsBlacklisted);
  const [isSelf, setIsSelf] = useState<boolean>(initialIsSelf);

  const utils = trpc.useUtils();
  const updateTagsMutation = trpc.wallet.updateTags.useMutation({
    onSuccess: () => {
      utils.wallet.list.invalidate();
      utils.wallet.get.invalidate({ address, chain });
      onSaved?.();
    },
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Map UI edge/style/size to valid router enums
    const validEdges = ["SMART", "INSIDER", "EARLY", "BOT", "KOL", "DEGEN", "FRESH", "DEV"];
    const validStyles = ["SNIPER", "JEET", "RIDER", "SWING", "DIAMOND"];
    const validSizes = ["W", "M", "S"];

    // Size normalization: SHRIMP -> S, FISH -> M, DOLPHIN -> M, WHALE -> W
    let mappedSize = size;
    if (size === "SHRIMP") mappedSize = "S";
    if (size === "FISH" || size === "DOLPHIN") mappedSize = "M";
    if (size === "WHALE") mappedSize = "W";

    // Style normalization: ACCUMULATOR -> SWING, DCA -> SWING if not strictly matching
    let mappedStyle = style;
    if (style === "ACCUMULATOR" || style === "DCA") mappedStyle = "SWING";

    // Edge normalization: DUMB -> DEGEN if not directly supported by schema
    let mappedEdge = edge;
    if (edge === "DUMB") mappedEdge = "DEGEN";

    await updateTagsMutation.mutateAsync({
      address,
      chain,
      label: label.trim() || null,
      notes: notes.trim() || null,
      edge: validEdges.includes(mappedEdge) ? (mappedEdge as any) : null,
      style: validStyles.includes(mappedStyle) ? (mappedStyle as any) : null,
      size: validSizes.includes(mappedSize) ? (mappedSize as any) : null,
      watchPriority,
      isBlacklisted,
      isSelf,
    });
  };

  return (
    <form
      onSubmit={handleSave}
      className={`bg-[#171A1D] border border-[#30373D] p-4 text-[#E8ECEF] font-sans flex flex-col gap-4 ${className}`}
    >
      <div className="flex items-center justify-between border-b border-[#30373D] pb-2">
        <h3 className="font-semibold text-[13px] uppercase tracking-wider text-[#E8ECEF]">
          Tag & Identity Editor
        </h3>
        <LabelPreview edge={edge} style={style} size={size} customLabel={label} />
      </div>

      {updateTagsMutation.isError && (
        <div className="p-2 bg-[#93000a]/20 border border-[#D87870] text-[#D87870] font-mono text-[12px]">
          Failed to update tags: {updateTagsMutation.error.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Edge */}
        <div>
          <label className="block font-semibold text-[11px] uppercase tracking-wider text-[#929BA3] mb-1">
            Edge
          </label>
          <select
            value={edge}
            onChange={(e) => setEdge(e.target.value)}
            className="w-full h-8 bg-[#101214] border border-[#30373D] text-[#E8ECEF] text-[12px] font-mono px-2 rounded-none focus:outline-none focus:border-[#D7A84B]"
          >
            <option value="">(None)</option>
            {EDGE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Style */}
        <div>
          <label className="block font-semibold text-[11px] uppercase tracking-wider text-[#929BA3] mb-1">
            Style
          </label>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="w-full h-8 bg-[#101214] border border-[#30373D] text-[#E8ECEF] text-[12px] font-mono px-2 rounded-none focus:outline-none focus:border-[#D7A84B]"
          >
            <option value="">(None)</option>
            {STYLE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Size */}
        <div>
          <label className="block font-semibold text-[11px] uppercase tracking-wider text-[#929BA3] mb-1">
            Size
          </label>
          <select
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="w-full h-8 bg-[#101214] border border-[#30373D] text-[#E8ECEF] text-[12px] font-mono px-2 rounded-none focus:outline-none focus:border-[#D7A84B]"
          >
            <option value="">(None)</option>
            {SIZE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Label */}
      <div>
        <label className="block font-semibold text-[11px] uppercase tracking-wider text-[#929BA3] mb-1">
          Custom Label
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Vitalik Deployer, Fund Alpha"
          className="w-full h-8 bg-[#101214] border border-[#30373D] text-[#E8ECEF] text-[12px] font-sans px-3 rounded-none focus:outline-none focus:border-[#D7A84B]"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block font-semibold text-[11px] uppercase tracking-wider text-[#929BA3] mb-1">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Context, Telegram handle, funding relation notes..."
          className="w-full bg-[#101214] border border-[#30373D] text-[#E8ECEF] text-[12px] font-sans p-2 rounded-none focus:outline-none focus:border-[#D7A84B] resize-none"
        />
      </div>

      {/* Toggles / Checkboxes */}
      <div className="flex flex-wrap items-center gap-6 pt-1">
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={watchPriority === "HIGH"}
            onChange={(e) => setWatchPriority(e.target.checked ? "HIGH" : "NORMAL")}
            className="w-4 h-4 rounded-none bg-[#101214] border-[#30373D] text-[#D7A84B] focus:ring-0 focus:ring-offset-0"
          />
          <span className="font-semibold text-[12px] text-[#E8ECEF] uppercase">
            Priority Watch
          </span>
        </label>

        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isSelf}
            onChange={(e) => setIsSelf(e.target.checked)}
            className="w-4 h-4 rounded-none bg-[#101214] border-[#30373D] text-[#D7A84B] focus:ring-0 focus:ring-offset-0"
          />
          <span className="font-semibold text-[12px] text-[#E8ECEF] uppercase">
            Is Self
          </span>
        </label>

        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isBlacklisted}
            onChange={(e) => setIsBlacklisted(e.target.checked)}
            className="w-4 h-4 rounded-none bg-[#101214] border-[#30373D] text-[#D87870] focus:ring-0 focus:ring-offset-0"
          />
          <span className="font-semibold text-[12px] text-[#D87870] uppercase">
            Blacklisted
          </span>
        </label>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#30373D]">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="h-8 px-4 border border-[#30373D] bg-transparent text-[#929BA3] hover:text-[#E8ECEF] font-semibold text-[12px] uppercase tracking-wider rounded-none"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={updateTagsMutation.isPending}
          className="h-8 px-5 bg-[#D7A84B] text-[#101214] font-bold text-[12px] uppercase tracking-wider rounded-none hover:brightness-110 active:translate-y-[1px] transition-all disabled:opacity-50"
        >
          {updateTagsMutation.isPending ? "Saving..." : "Save Tags"}
        </button>
      </div>
    </form>
  );
}
