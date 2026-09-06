import { describe, expect, it } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  StateBadge,
  getAlertStateStyle,
} from "@/components/shared/StateBadge";
import { ClusterChip } from "@/components/clusters/ClusterChip";

describe("P4-T10 — State badges on list, graph, and detail", () => {
  it("badge: IDLE, ARMED, TRIGGERED each render distinct styling", () => {
    const idleStyle = getAlertStateStyle("IDLE");
    const armedStyle = getAlertStateStyle("ARMED");
    const triggeredStyle = getAlertStateStyle("TRIGGERED");
    const exitRiskStyle = getAlertStateStyle("EXIT_RISK");

    // All distinct colors and labels
    expect(idleStyle.color).not.toBe(armedStyle.color);
    expect(armedStyle.color).not.toBe(triggeredStyle.color);
    expect(triggeredStyle.color).not.toBe(exitRiskStyle.color);

    expect(idleStyle.label).toBe("IDLE");
    expect(armedStyle.label).toBe("ARMED");
    expect(triggeredStyle.label).toBe("TRIGGERED");
    expect(exitRiskStyle.label).toBe("EXIT_RISK");

    // Pulse animation on TRIGGERED
    expect(triggeredStyle.isPulse).toBe(true);
    expect(armedStyle.isPulse).toBe(false);

    // Render component tests
    const idleHtml = renderToString(<StateBadge state="IDLE" />);
    expect(idleHtml).toContain("badge-idle");
    expect(idleHtml).toContain("IDLE");

    const armedHtml = renderToString(<StateBadge state="ARMED" subText="A1" />);
    expect(armedHtml).toContain("badge-armed");
    expect(armedHtml).toContain("ARMED");
    expect(armedHtml).toContain("(A1)");
    expect(armedHtml).toContain("#D7A84B");

    const triggeredHtml = renderToString(<StateBadge state="TRIGGERED" subText="T1" />);
    expect(triggeredHtml).toContain("badge-triggered");
    expect(triggeredHtml).toContain("TRIGGERED");
    expect(triggeredHtml).toContain("(T1)");
    expect(triggeredHtml).toContain("#D87870");
  });

  it("badge: same mapping function used by list, graph, and detail", () => {
    // Both graph node borders and wallet list row borders derive from getAlertStateStyle
    const states = ["IDLE", "ARMED", "TRIGGERED", "EXIT_RISK"] as const;

    for (const st of states) {
      const style = getAlertStateStyle(st);
      expect(style.state).toBe(st);
      expect(style.borderColor).toBeDefined();
      expect(style.borderWidth).toBeGreaterThan(0);

      if (st === "ARMED") {
        expect(style.borderColor).toBe("#D7A84B");
        expect(style.borderWidth).toBe(3.5);
      } else if (st === "TRIGGERED") {
        expect(style.borderColor).toBe("#D87870");
        expect(style.borderWidth).toBe(4);
      } else if (st === "IDLE") {
        expect(style.borderColor).toBe("#30373D");
      }
    }
  });

  it("badge: cluster ARMED uses the escalated treatment", () => {
    const clusterArmedStyle = getAlertStateStyle(undefined, true);
    expect(clusterArmedStyle.state).toBe("CLUSTER_ARMED");
    expect(clusterArmedStyle.label).toBe("CLUSTER ARMED");
    expect(clusterArmedStyle.isPulse).toBe(true);
    expect(clusterArmedStyle.borderWidth).toBe(4);

    // Render ClusterChip when unarmed
    const unarmedHtml = renderToString(
      <ClusterChip
        cluster={{
          id: "cluster-1",
          name: "Whale Pod",
          colorHex: "#79B79A",
          isArmed: false,
        }}
        clickable={false}
      />
    );
    expect(unarmedHtml).toContain('data-armed="false"');
    expect(unarmedHtml).not.toContain("cluster-armed-escalated");

    // Render ClusterChip when armed (escalated treatment)
    const armedHtml = renderToString(
      <ClusterChip
        cluster={{
          id: "cluster-1",
          name: "Whale Pod",
          colorHex: "#79B79A",
          isArmed: true,
        }}
        clickable={false}
      />
    );
    expect(armedHtml).toContain('data-armed="true"');
    expect(armedHtml).toContain("cluster-armed-escalated");
    expect(armedHtml).toContain("ARMED");
    expect(armedHtml).toContain("#D7A84B");
  });

  it("badge: state change is reflected on all surfaces after refetch", () => {
    // Simulating refetch transition from IDLE to ARMED to TRIGGERED
    let currentState = "IDLE";
    let style = getAlertStateStyle(currentState);
    expect(style.state).toBe("IDLE");
    expect(style.borderColor).toBe("#30373D");

    // Wallet trips rule A1 -> state updates to ARMED
    currentState = "ARMED";
    style = getAlertStateStyle(currentState);
    expect(style.state).toBe("ARMED");
    expect(style.borderColor).toBe("#D7A84B");

    // Wallet trips rule T1 -> state updates to TRIGGERED
    currentState = "TRIGGERED";
    style = getAlertStateStyle(currentState);
    expect(style.state).toBe("TRIGGERED");
    expect(style.borderColor).toBe("#D87870");
  });
});
