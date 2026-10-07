import type { HazardLevel } from "../../types";
import { useTranslation } from "../../hooks/useTranslation";

const HAZARD_KEYS: Record<HazardLevel, string> = {
  low: "hazard_safe",
  medium: "hazard_caution",
  high: "hazard_caution",
  critical: "hazard_high_risk",
};

const config: Record<HazardLevel, { classes: string }> = {
  low: { classes: "bg-green-100 text-green-700 ring-green-600/20 dark:bg-green-950/70 dark:text-green-300 dark:ring-green-400/20" },
  medium: { classes: "bg-yellow-100 text-yellow-700 ring-yellow-600/20 dark:bg-yellow-950/70 dark:text-yellow-300 dark:ring-yellow-400/20" },
  high: { classes: "bg-orange-100 text-orange-700 ring-orange-600/20 dark:bg-orange-950/70 dark:text-orange-300 dark:ring-orange-400/20" },
  critical: { classes: "bg-red-100 text-red-700 ring-red-600/20 dark:bg-red-950/70 dark:text-red-300 dark:ring-red-400/20" },
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