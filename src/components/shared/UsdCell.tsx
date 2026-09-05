export function UsdCell({ value }: { value: number | null }) { return <span>{value === null ? "—" : `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}</span>; }
