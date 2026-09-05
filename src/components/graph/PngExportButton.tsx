"use client";

import React, { useState } from "react";
import type { Core } from "cytoscape";

export interface PngExportButtonProps {
  cy: Core | null;
}

export function PngExportButton({ cy }: PngExportButtonProps) {
  const [exported, setExported] = useState(false);

  const handleExport = () => {
    if (!cy) return;

    // Cytoscape PNG export preserving dark background
    const pngBase64 = cy.png({
      full: false, // current viewport
      bg: "#101214", // dark Observatory Canvas
      scale: 2, // 2x resolution
    });

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 16);
    const filename = `watchtower-graph-${timestamp}.png`;

    const downloadLink = document.createElement("a");
    downloadLink.href = pngBase64;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    setExported(true);
    setTimeout(() => setExported(false), 2000);
  };

  return (
    <button
      onClick={handleExport}
      disabled={!cy}
      className={`px-3 py-1 border font-semibold text-[11px] font-mono transition-colors flex items-center gap-1.5 ${
        exported
          ? "bg-[#79B79A] text-[#101214] border-[#79B79A]"
          : "bg-[#101214] border-[#D7A84B] text-[#D7A84B] hover:bg-[#D7A84B] hover:text-[#101214]"
      }`}
    >
      <span>📷</span>
      <span>{exported ? "EXPORTED!" : "Export PNG"}</span>
    </button>
  );
}
