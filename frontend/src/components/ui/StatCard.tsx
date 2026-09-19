import type { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "../../lib/cn";
import { Card } from "./Card";

interface Props {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  iconClass?: string;
  trend?: number; // percent change; positive = up
  trendLabel?: string;
  hint?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/** KPI tile with icon chip, big value, optional delta and stacked micro-content. */
export function StatCard({
  label,
  value,
  icon,
  iconClass,
  trend,
  trendLabel,
  hint,
  className,
  children,
}: Props) {
  const up = (trend ?? 0) >= 0;
  return (
    <Card hover className={cn("relative overflow-hidden", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-1.5 truncate text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-[27px]">
            {value}
          </p>
        </div>
        {icon && (
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/80 dark:text-brand-300",
              iconClass,
            )}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs">
        {trend != null && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-bold",
              up
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300"
                : "bg-red-50 text-red-700 dark:bg-red-950/70 dark:text-red-300",
            )}
          >
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
        {(trendLabel ?? hint) && (
          <span className="truncate text-slate-500 dark:text-slate-400">
            {trendLabel ?? hint}
          </span>
        )}
      </div>
      {children}
    </Card>
  );
}