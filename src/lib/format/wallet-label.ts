export interface WalletLabelTags {
  edge?: string | null;
  style?: string | null;
  size?: string | null;
}

export function formatWalletLabel(tags: WalletLabelTags): string {
  const parts: string[] = [];

  const edge = tags.edge?.trim();
  const style = tags.style?.trim();
  const size = tags.size?.trim();

  let mainPart = "";
  if (edge && style) {
    mainPart = `${edge}-${style}`;
  } else if (edge) {
    mainPart = edge;
  } else if (style) {
    mainPart = style;
  }

  if (mainPart) {
    parts.push(mainPart);
  }

  if (size) {
    parts.push(`[${size}]`);
  }

  return parts.join(" ");
}
