import { MousePointerClick, RotateCcw } from "lucide-react";
import { SCRAP_CLASSES } from "../../vision/visionEngine";
import { resolveTradeRule } from "../../services/language";
import { useTranslation } from "../../hooks/useTranslation";
import HazardBadge from "../ui/HazardBadge";
import { Button } from "../ui/Button";

interface Props {
  onSelect: (slug: string) => void;
  onRetry: () => void;
}

export default function ManualMaterialSelect({ onSelect, onRetry }: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200 dark:bg-amber-950/60 dark:ring-amber-900">
        <MousePointerClick className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-200">{t("manual_select_desc")}</p>
      </div>

      <div className="grid grid-cols-2 gap-2" role="list" aria-label={t("manual_select_title")}>
        {SCRAP_CLASSES.map((cls) => {
          const rule = resolveTradeRule(cls.slug);
          return (
            <button
              key={cls.slug}
              role="listitem"
              onClick={() => onSelect(cls.slug)}
              className="group flex min-h-[92px] flex-col items-start justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-all hover:border-brand-400 hover:shadow-md active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900"
            >
              <span className="text-sm font-semibold text-slate-900 group-hover:text-brand-700 dark:text-slate-100 dark:group-hover:text-brand-300">
                {rule.material}
              </span>
              <span className="flex items-center gap-2">
                <HazardBadge level={rule.hazardLevel} />
              </span>
            </button>
          );
        })}
      </div>

      <Button variant="secondary" fullWidth onClick={onRetry}>
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        {t("scan_again")}
      </Button>
    </div>
  );
}