import { describe, expect, it } from "vitest";
import { formatWalletLabel } from "@/lib/format/wallet-label";

describe("P1-T13: Wallet Computed Label Formatting", () => {
  it("label: all three tags render as EDGE-STYLE [SIZE]", () => {
    expect(
      formatWalletLabel({
        edge: "SMART",
        style: "RIDER",
        size: "W",
      })
    ).toBe("SMART-RIDER [W]");
  });

  it("label: edge only renders EDGE", () => {
    expect(
      formatWalletLabel({
        edge: "INSIDER",
      })
    ).toBe("INSIDER");
  });

  it("label: edge and size render EDGE [SIZE]", () => {
    expect(
      formatWalletLabel({
        edge: "DEV",
        size: "M",
      })
    ).toBe("DEV [M]");
  });

  it("label: style and size render STYLE [SIZE]", () => {
    expect(
      formatWalletLabel({
        style: "SNIPER",
        size: "S",
      })
    ).toBe("SNIPER [S]");
  });

  it("label: style only renders STYLE", () => {
    expect(
      formatWalletLabel({
        style: "JEET",
      })
    ).toBe("JEET");
  });

  it("label: size only renders [SIZE]", () => {
    expect(
      formatWalletLabel({
        size: "W",
      })
    ).toBe("[W]");
  });

  it("label: no tags renders an empty preview", () => {
    expect(formatWalletLabel({})).toBe("");
    expect(
      formatWalletLabel({
        edge: null,
        style: null,
        size: null,
      })
    ).toBe("");
  });

  it("label: free-text label is independent of the computed label", () => {
    const computed = formatWalletLabel({
      edge: "KOL",
      style: "SWING",
    });
    const freeTextLabel = "Ansem Main Wallet";
    expect(computed).toBe("KOL-SWING");
    expect(computed).not.toContain(freeTextLabel);
  });
});
