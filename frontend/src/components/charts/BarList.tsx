import { cn } from "../../lib/cn";
import { clamp } from "../../utils/formatters";

export interface BarItem {
  label: string;
  value: number;
  sub?: string;
  color?: string;
  valueLabel?: string;
}

interface Props {
  items: BarItem[];
  max?: number;
  className?: string;
  unit?: string;
}

/** Horizontal bar list — ideal for "by material" breakdowns. */
export function BarList({ items, max, className }: Props) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <div className={cn("space-y-3.5", className)}>
      {items.map((it) => {
        const pct = clamp((it.value / top) * 100, 1.5, 100);
        return (
          <div key={it.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                {it.label}
              </span>
              <span className="shrink-0 text-xs font-bold text-slate-900 dark:text-white">
                {it.valueLabel ?? compact(it.value)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${pct}%`,
                  background: it.color ?? "var(--c-brand)",
                }}
              />
            </div>
            {it.sub && <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{it.sub}</p>}
          </div>
        );
      })}
    </div>
  );
}

function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${Math.round(n)}`;
}