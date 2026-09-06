import type { StylesheetStyle } from "cytoscape";

/**
 * InsightX & Bubblemaps-inspired Cytoscape Graph Stylesheet.
 *
 * Visual DNA:
 * - Seamless bubble nodes with semi-transparent cluster-tinted body & glowing neon ring
 * - Always-visible, beautifully framed node labels with zoom adaptation
 * - Subtle dashed connection edges with zoom-adaptive labels
 * - Interactive neighborhood highlighting (focus on hover/select)
 * - Funder/terminal nodes with dashed/dotted borders matching Bubblemaps
 */
export const OBSERVATORY_GRAPH_STYLES: StylesheetStyle[] = [
  // ── 1. Standard Tracked Wallet Bubble Node ─────────────────────
  {
    selector: "node[!isCompound]",
    style: {
      shape: "ellipse",
      "background-color": "data(bgColor)",
      "background-opacity": 0.32,
      "border-width": "data(borderWidth)",
      "border-color": "data(borderColor)",
      "border-opacity": 0.95,
      width: "data(size)",
      height: "data(size)",
      // Node label ALWAYS visible, rendered as a crisp dark pill
      label: "data(label)",
      color: "#E8ECEF",
      "font-family": "Geist Mono, monospace",
      "font-size": "10px",
      "font-weight": 500,
      "text-valign": "bottom",
      "text-halign": "center",
      "text-margin-y": 7,
      "text-background-color": "#0D1117",
      "text-background-opacity": 0.88,
      "text-background-padding": "3px",
      "text-background-shape": "roundrectangle",
      "text-border-width": 1,
      "text-border-color": "data(borderColor)",
      "text-border-opacity": 0.4,
      "min-zoomed-font-size": 6,
      "overlay-opacity": 0,
      // Ambient bubble glow
      "shadow-blur": "data(glowRadius)",
      "shadow-color": "data(borderColor)",
      "shadow-opacity": 0.45,
      "shadow-offset-x": 0,
      "shadow-offset-y": 0,
      "transition-property":
        "background-color, border-color, width, height, shadow-blur, shadow-opacity, border-width, opacity",
      "transition-duration": 220,
    } as any,
  },

  // ── 2. Compound Cluster Boundary Parent Node ──────────────────
  {
    selector: "node[?isCompound]",
    style: {
      shape: "roundrectangle",
      "background-color": "data(borderColor)",
      "background-opacity": 0.03,
      "border-width": 1,
      "border-style": "dashed",
      "border-color": "data(borderColor)",
      "border-opacity": 0.25,
      label: "data(label)",
      color: "data(borderColor)",
      "font-family": "Geist, sans-serif",
      "font-weight": 600,
      "font-size": "11px",
      "text-valign": "top",
      "text-halign": "left",
      "text-margin-x": 12,
      "text-margin-y": 12,
      "text-background-color": "#0D1117",
      "text-background-opacity": 0.75,
      "text-background-padding": "3px",
      "text-background-shape": "roundrectangle",
      padding: "26px",
    } as any,
  },

  // ── 2b. Escalated Cluster-ARMED Boundary Parent Node ──────────
  {
    selector: "node[?isCompound][?isClusterArmed]",
    style: {
      "background-color": "#D7A84B",
      "background-opacity": 0.08,
      "border-width": 3,
      "border-style": "solid",
      "border-color": "#D7A84B",
      "border-opacity": 0.9,
      color: "#D7A84B",
      "font-weight": 700,
      "shadow-blur": 24,
      "shadow-color": "#D7A84B",
      "shadow-opacity": 0.5,
    } as any,
  },

  // ── 3. Hovered / Active Node State ────────────────────────────
  {
    selector: "node[!isCompound]:active, node[!isCompound].hover",
    style: {
      "background-opacity": 0.5,
      "border-width": 4.5,
      "shadow-blur": 26,
      "shadow-opacity": 0.8,
      "font-size": "11px",
      "font-weight": 600,
      "text-background-opacity": 0.98,
      "text-border-opacity": 0.9,
      "z-index": 1000,
    } as any,
  },

  // ── 4. Selected Node State ────────────────────────────────────
  {
    selector: "node:selected",
    style: {
      "background-opacity": 0.55,
      "border-width": 4.5,
      "border-color": "#D7A84B",
      "shadow-blur": 32,
      "shadow-color": "#D7A84B",
      "shadow-opacity": 0.85,
      color: "#FFFFFF",
      "font-size": "11px",
      "font-weight": 600,
      "text-background-color": "#171A1D",
      "text-background-opacity": 0.98,
      "text-border-color": "#D7A84B",
      "text-border-width": 1.5,
      "text-border-opacity": 1,
      "z-index": 1001,
    } as any,
  },

  // ── 5. Secondary Funder / Terminal Node (Dotted Bubble) ────────
  {
    selector: "node[?isSecondary]",
    style: {
      shape: "ellipse",
      "border-style": "dashed",
      "border-dash-pattern": [4, 3],
      "border-width": 2.5,
      "background-opacity": 0.2,
      "shadow-opacity": 0.25,
    } as any,
  },

  // ── 6. Directional Transfer Edge (Dashed Line) ────────────────
  {
    selector: "edge",
    style: {
      width: "data(edgeWidth)",
      "line-color": "rgba(255, 255, 255, 0.18)",
      "line-style": "dashed",
      "line-dash-pattern": [6, 4],
      "target-arrow-shape": "triangle",
      "target-arrow-color": "rgba(255, 255, 255, 0.25)",
      "arrow-scale": 0.8,
      "curve-style": "bezier",
      // Edge label visible with zoom threshold
      label: "data(label)",
      color: "rgba(232, 236, 239, 0.65)",
      "font-family": "Geist Mono, monospace",
      "font-size": "9px",
      "font-weight": 400,
      "text-background-color": "#0D1117",
      "text-background-opacity": 0.8,
      "text-background-padding": "2px",
      "text-background-shape": "roundrectangle",
      "text-border-width": 1,
      "text-border-color": "rgba(48, 55, 61, 0.7)",
      "text-rotation": "autorotate",
      "min-zoomed-font-size": 7,
      "overlay-opacity": 0,
      "transition-property": "line-color, width, color, text-border-color, opacity",
      "transition-duration": 200,
    } as any,
  },

  // ── 7. Hovered Edge State ─────────────────────────────────────
  {
    selector: "edge:active, edge.hover",
    style: {
      "line-color": "#D7A84B",
      "line-style": "solid",
      "target-arrow-color": "#D7A84B",
      width: (ele: any) => Math.max(ele.data("edgeWidth") * 1.5, 2.5),
      color: "#D7A84B",
      "font-weight": 600,
      "text-background-color": "#171A1D",
      "text-background-opacity": 0.95,
      "text-border-color": "#D7A84B",
      "text-border-opacity": 1,
      "z-index": 998,
    } as any,
  },

  // ── 8. Selected Edge State ────────────────────────────────────
  {
    selector: "edge:selected",
    style: {
      "line-color": "#D7A84B",
      "line-style": "solid",
      "target-arrow-color": "#D7A84B",
      width: (ele: any) => Math.max(ele.data("edgeWidth") * 1.8, 3),
      label: "data(label)",
      color: "#D7A84B",
      "font-family": "Geist Mono, monospace",
      "font-size": "10px",
      "font-weight": 600,
      "text-background-color": "#101214",
      "text-background-opacity": 0.98,
      "text-background-padding": "3px",
      "text-background-shape": "roundrectangle",
      "text-border-width": 1.5,
      "text-border-color": "#D7A84B",
      "text-rotation": "autorotate",
      "min-zoomed-font-size": 4,
      "z-index": 999,
    } as any,
  },

  // ── 9. Interactive Dim State (for Neighborhood Highlighting) ───
  {
    selector: "node.dimmed",
    style: {
      opacity: 0.16,
      "text-opacity": 0,
      "shadow-opacity": 0,
    } as any,
  },
  {
    selector: "edge.dimmed",
    style: {
      opacity: 0.08,
      "text-opacity": 0,
    } as any,
  },
  {
    selector: "node.highlighted",
    style: {
      opacity: 1,
      "border-width": 4,
      "shadow-opacity": 0.75,
      "z-index": 995,
    } as any,
  },
  {
    selector: "edge.highlighted",
    style: {
      opacity: 1,
      "line-color": "rgba(255, 255, 255, 0.55)",
      "target-arrow-color": "#D7A84B",
      "line-style": "solid",
      "z-index": 994,
    } as any,
  },
];
