import type { HazardLevel } from "../../types";
import { useTranslation } from "../../hooks/useTranslation";

const HAZARD_KEYS: Record<HazardLevel, string> = {
  low: "hazard_safe",
  medium: "hazard_caution",
  high: "hazard_caution",
  critical: "hazard_high_risk",
};

const config: Record<HazardLevel, { classes: string }> = {
  low: { classes: "bg-green-100 text-green-700 ring-green-600/20" },
  medium: { classes: "bg-yellow-100 text-yellow-700 ring-yellow-600/20" },
  high: { classes: "bg-orange-100 text-orange-700 ring-orange-600/20" },
  critical: { classes: "bg-red-100 text-red-700 ring-red-600/20" },
};

interface Props {
  level: HazardLevel;
}

export default function HazardBadge({ level }: Props) {
  const { t } = useTranslation();
  const c = config[level];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${c.classes}`}>
      {t(HAZARD_KEYS[level])}
    </span>
  );
}