"use client";

import React, { useEffect, useRef } from "react";
import cytoscape, { type Core, type NodeSingular } from "cytoscape";
import { registerCytoscapeExtensions, FCOSE_LAYOUT_OPTIONS } from "./cytoscape-setup";
import { OBSERVATORY_GRAPH_STYLES } from "./graph-styles";
import { getAlertStateStyle } from "@/components/shared/StateBadge";
import type {
  GraphNodePayload,
  GraphEdgePayload,
  CompoundClusterPayload,
} from "@/server/services/interaction/graph-query";

export interface GraphCanvasProps {
  nodes: GraphNodePayload[];
  edges: GraphEdgePayload[];
  clusters: CompoundClusterPayload[];
  sizeMode?: "tag" | "balance";
  onSelectNode: (node: GraphNodePayload | null) => void;
  onSelectEdge: (edge: GraphEdgePayload | null) => void;
  onCyInit?: (cy: Core) => void;
}

interface CelestialParticle {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  baseOpacity: number;
  pulseSpeed: number;
  pulseOffset: number;
  type: "star" | "bubble" | "nebula";
  hue: number; // 210 for deep blue, 270 for purple, 180 for cyan
}

const UNCLUSTERED_COLOR = "#4B5563";

export function GraphCanvas({
  nodes,
  edges,
  clusters,
  sizeMode = "tag",
  onSelectNode,
  onSelectEdge,
  onCyInit,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasBgRef = useRef<HTMLCanvasElement>(null);
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    registerCytoscapeExtensions();
  }, []);

  // ── 1. HTML5 Canvas Ambient Celestial Particle Background (Option B) ──
  useEffect(() => {
    const canvas = canvasBgRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        width = canvas.width = entry.contentRect.width;
        height = canvas.height = entry.contentRect.height;
      }
    });
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    // Seed realistic ambient celestial orbs
    const count = 75;
    const particles: CelestialParticle[] = [];
    for (let i = 0; i < count; i++) {
      const rand = Math.random();
      let type: CelestialParticle["type"] = "bubble";
      let radius = 6 + Math.random() * 18;
      let baseOpacity = 0.04 + Math.random() * 0.08;
      let hue = Math.random() > 0.5 ? 215 : 260;

      if (rand < 0.35) {
        // Small glowing star
        type = "star";
        radius = 1.2 + Math.random() * 2.2;
        baseOpacity = 0.15 + Math.random() * 0.35;
        hue = 210;
      } else if (rand > 0.82) {
        // Large faint nebula orbs
        type = "nebula";
        radius = 35 + Math.random() * 55;
        baseOpacity = 0.02 + Math.random() * 0.04;
        hue = Math.random() > 0.6 ? 280 : 190;
      }

      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        baseOpacity,
        pulseSpeed: 0.001 + Math.random() * 0.002,
        pulseOffset: Math.random() * Math.PI * 2,
        type,
        hue,
      });
    }

    // Parallax tracking from Cytoscape pan
    let panOffsetX = 0;
    let panOffsetY = 0;

    const render = (time: number) => {
      ctx.clearRect(0, 0, width, height);

      // Deep celestial radial background gradient
      const bgGrad = ctx.createRadialGradient(
        width * 0.45,
        height * 0.45,
        50,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.8
      );
      bgGrad.addColorStop(0, "#0E131A");
      bgGrad.addColorStop(0.5, "#0A0D12");
      bgGrad.addColorStop(1, "#06080B");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Render celestial particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around boundaries
        if (p.x < -p.radius * 2) p.x = width + p.radius * 2;
        if (p.x > width + p.radius * 2) p.x = -p.radius * 2;
        if (p.y < -p.radius * 2) p.y = height + p.radius * 2;
        if (p.y > height + p.radius * 2) p.y = -p.radius * 2;

        const pulse = Math.sin(time * p.pulseSpeed + p.pulseOffset);
        const currentOpacity = Math.max(0.01, p.baseOpacity + pulse * 0.025);

        // Effective position with subtle parallax
        const drawX = p.x + panOffsetX * 0.08;
        const drawY = p.y + panOffsetY * 0.08;

        ctx.save();
        if (p.type === "star") {
          ctx.beginPath();
          ctx.arc(drawX, drawY, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.hue}, 80%, 85%, ${currentOpacity})`;
          ctx.shadowColor = `hsla(${p.hue}, 90%, 75%, 0.8)`;
          ctx.shadowBlur = 4;
          ctx.fill();
        } else if (p.type === "bubble") {
          // Bubblemaps-style ambient sphere: translucent body + glowing ring
          const radGrad = ctx.createRadialGradient(
            drawX - p.radius * 0.25,
            drawY - p.radius * 0.25,
            p.radius * 0.1,
            drawX,
            drawY,
            p.radius
          );
          radGrad.addColorStop(0, `hsla(${p.hue}, 40%, 25%, ${currentOpacity * 0.6})`);
          radGrad.addColorStop(0.8, `hsla(${p.hue}, 50%, 15%, ${currentOpacity * 0.3})`);
          radGrad.addColorStop(1, `hsla(${p.hue}, 60%, 40%, ${currentOpacity * 1.5})`);

          ctx.beginPath();
          ctx.arc(drawX, drawY, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = radGrad;
          ctx.fill();

          // Outer faint ring
          ctx.strokeStyle = `hsla(${p.hue}, 60%, 55%, ${currentOpacity * 1.2})`;
          ctx.lineWidth = 0.75;
          ctx.stroke();
        } else {
          // Ethereal diffuse nebula
          const nebGrad = ctx.createRadialGradient(
            drawX,
            drawY,
            0,
            drawX,
            drawY,
            p.radius
          );
          nebGrad.addColorStop(0, `hsla(${p.hue}, 50%, 40%, ${currentOpacity})`);
          nebGrad.addColorStop(0.6, `hsla(${p.hue}, 40%, 20%, ${currentOpacity * 0.4})`);
          nebGrad.addColorStop(1, "transparent");

          ctx.beginPath();
          ctx.arc(drawX, drawY, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = nebGrad;
          ctx.fill();
        }
        ctx.restore();
      }

      animFrameId = requestAnimationFrame(render);
    };

    animFrameId = requestAnimationFrame(render);

    // Sync parallax with Cytoscape pan
    const handlePan = () => {
      if (cyRef.current) {
        const pan = cyRef.current.pan();
        panOffsetX = pan.x;
        panOffsetY = pan.y;
      }
    };

    const intervalId = setInterval(handlePan, 100);

    return () => {
      cancelAnimationFrame(animFrameId);
      clearInterval(intervalId);
      resizeObserver.disconnect();
    };
  }, []);

  // ── 2. Sizing & Aesthetics ──────────────────────────────────
  const getNodeSize = (node: GraphNodePayload): number => {
    if (sizeMode === "tag") {
      switch (node.sizeTag) {
        case "W":
          return 64;
        case "M":
          return 46;
        case "S":
          return 30;
        default:
          return 38;
      }
    } else {
      const bal = node.stableBalanceUsd;
      if (bal <= 0) return 26;
      if (bal >= 500_000) return 82;
      const normalized = Math.min(bal / 500_000, 1);
      return 26 + Math.round(normalized * 56);
    }
  };

  const getGlowRadius = (size: number): number => {
    return Math.round(size * 0.4);
  };

  const getNodeBorder = (state: string, isSecondary: boolean, defaultColor: string) => {
    if (isSecondary) {
      return { borderColor: defaultColor, borderWidth: 2 };
    }
    const stateStyle = getAlertStateStyle(state);
    const borderColor = stateStyle.state === "IDLE" ? defaultColor : stateStyle.borderColor;
    return { borderColor, borderWidth: stateStyle.borderWidth };
  };

  const getEdgeWidth = (totalUsd: number): number => {
    if (totalUsd <= 100) return 1.2;
    if (totalUsd >= 100_000) return 4.5;
    const norm = Math.min((totalUsd - 100) / 99_900, 1);
    return 1.2 + norm * 3.3;
  };

  // ── 3. Cytoscape Element Construction & Lifecycle ─────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const elements: cytoscape.ElementDefinition[] = [];

    // 1. Compound Parent Nodes (for clusters)
    for (const c of clusters) {
      const isArmed = !!c.isArmed;
      const clusterStyle = getAlertStateStyle(undefined, isArmed);
      elements.push({
        data: {
          id: `cluster_parent_${c.id}`,
          label: isArmed ? `${c.name.toUpperCase()} [ARMED CLUSTER]` : c.name.toUpperCase(),
          borderColor: isArmed ? clusterStyle.borderColor : c.colorHex,
          borderWidth: isArmed ? clusterStyle.borderWidth : 1,
          isCompound: true,
          isClusterArmed: isArmed,
        },
      });
    }

    // 2. Wallet Nodes (Bubbles)
    for (const n of nodes) {
      const size = getNodeSize(n);
      const clusterColor = n.clusterColor ?? UNCLUSTERED_COLOR;
      const { borderColor, borderWidth } = getNodeBorder(
        n.alertState,
        n.isSecondary,
        clusterColor
      );
      const displayName =
        n.ensName ?? `${n.address.slice(0, 6)}…${n.address.slice(-4)}`;

      elements.push({
        data: {
          id: n.id,
          parent: n.clusterId ? `cluster_parent_${n.clusterId}` : undefined,
          label: displayName,
          bgColor: clusterColor,
          borderColor,
          borderWidth,
          size,
          glowRadius: getGlowRadius(size),
          isCompound: false,
          isSecondary: n.isSecondary,
          rawPayload: n,
        },
      });
    }

    // 3. Directional Edges
    for (const e of edges) {
      elements.push({
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
          edgeWidth: getEdgeWidth(e.totalUsd),
          rawPayload: e,
        },
      });
    }

    // ── Helper for Neighborhood Highlighting ──
    const highlightNeighborhood = (cy: Core, node: NodeSingular) => {
      const neighborhood = node.neighborhood().add(node);
      cy.elements().removeClass("highlighted dimmed");
      cy.elements().difference(neighborhood).addClass("dimmed");
      neighborhood.addClass("highlighted");
    };

    const clearHighlight = (cy: Core) => {
      cy.elements().removeClass("highlighted dimmed");
    };

    // Initialize or update Cytoscape
    if (!cyRef.current) {
      const cy = cytoscape({
        container: containerRef.current,
        elements,
        style: OBSERVATORY_GRAPH_STYLES,
        layout: FCOSE_LAYOUT_OPTIONS,
        minZoom: 0.12,
        maxZoom: 4.5,
        wheelSensitivity: 0.22,
        boxSelectionEnabled: false,
        hideEdgesOnViewport: false,
        textureOnViewport: false,
      });

      // Hover on node: interactive neighborhood highlight
      cy.on("mouseover", "node[!isCompound]", (evt) => {
        evt.target.addClass("hover");
        highlightNeighborhood(cy, evt.target);
      });

      cy.on("mouseout", "node[!isCompound]", (evt) => {
        evt.target.removeClass("hover");
        const selected = cy.$("node:selected");
        if (selected.length > 0) {
          highlightNeighborhood(cy, selected[0]);
        } else {
          clearHighlight(cy);
        }
      });

      // Hover on edge: highlight edge and connected nodes
      cy.on("mouseover", "edge", (evt) => {
        evt.target.addClass("hover");
      });

      cy.on("mouseout", "edge", (evt) => {
        evt.target.removeClass("hover");
      });

      // Tap on node
      cy.on("tap", "node[!isCompound]", (evt) => {
        const nodeData = evt.target.data("rawPayload");
        if (nodeData) {
          highlightNeighborhood(cy, evt.target);
          onSelectNode(nodeData);
          onSelectEdge(null);
        }
      });

      // Tap on edge
      cy.on("tap", "edge", (evt) => {
        const edgeData = evt.target.data("rawPayload");
        if (edgeData) {
          onSelectEdge(edgeData);
          onSelectNode(null);
        }
      });

      // Tap on canvas background
      cy.on("tap", (evt) => {
        if (evt.target === cy) {
          clearHighlight(cy);
          onSelectNode(null);
          onSelectEdge(null);
        }
      });

      cyRef.current = cy;
      if (onCyInit) onCyInit(cy);
    } else {
      const cy = cyRef.current;
      cy.batch(() => {
        cy.elements().remove();
        cy.add(elements);
      });
      cy.layout(FCOSE_LAYOUT_OPTIONS).run();
    }

    return () => {
      // Keep alive during prop updates
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, clusters, sizeMode]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#06080B] select-none">
      {/* HTML5 Canvas Ambient Celestial Particles (Option B) */}
      <canvas
        ref={canvasBgRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
      />

      {/* Cytoscape interactive graph canvas */}
      <div
        ref={containerRef}
        className="relative w-full h-full z-10"
        style={{ background: "transparent" }}
      />
    </div>
  );
}
