import type { HazardLevel } from "../../types";

const config: Record<HazardLevel, { label: string; classes: string }> = {
  low: { label: "Safe", classes: "bg-green-100 text-green-700 ring-green-600/20" },
  medium: { label: "Caution", classes: "bg-yellow-100 text-yellow-700 ring-yellow-600/20" },
  high: { label: "High Risk", classes: "bg-orange-100 text-orange-700 ring-orange-600/20" },
  critical: { label: "Critical", classes: "bg-red-100 text-red-700 ring-red-600/20" },
};

interface Props {
  level: HazardLevel;
}

export default function HazardBadge({ level }: Props) {
  const c = config[level];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${c.classes}`}>
      {c.label}
    </span>
  );
}
