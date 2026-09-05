export const CLUSTER_PALETTE = [
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#84CC16", // Lime
  "#F97316", // Orange
  "#14B8A6", // Teal
  "#6366F1", // Indigo
  "#D946EF", // Fuchsia
  "#EAB308", // Yellow
  "#22C55E", // Green
  "#A855F7", // Violet
  "#64748B", // Slate
];

export function getClusterColor(address: string): string {
  const clean = address.toLowerCase().replace(/^0x/, "");
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
  }
  const index = hash % CLUSTER_PALETTE.length;
  return CLUSTER_PALETTE[index];
}
