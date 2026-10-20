import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { relativeTime } from "../../utils/formatters";

export interface ActivityItem {
  id: string;
  icon: ReactNode;
  tone: "brand" | "green" | "amber" | "sky" | "violet" | "rose" | "slate";
  title: string;
  meta?: ReactNode;
  time?: string;
}

const TONES = {
  brand: "bg-brand-50 text-brand-600 dark:bg-brand-950/80 dark:text-brand-300",
  green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/80 dark:text-amber-300",
  sky: "bg-sky-50 text-sky-600 dark:bg-sky-950/80 dark:text-sky-300",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-950/80 dark:text-violet-300",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-950/80 dark:text-rose-300",
  slate: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300",
} as const;

export function ActivityFeed({
  items,
  className,
  onSelect,
}: {
  items: ActivityItem[];
  className?: string;
  onSelect?: (item: ActivityItem) => void;
}) {
  return (
    <ul className={cn("space-y-1", className)}>
      {items.map((item) => {
        const Row = onSelect ? "button" : "div";
        return (
          <li key={item.id}>
            <Row
              {...(onSelect
                ? {
                    type: "button" as const,
                    onClick: () => onSelect(item),
                    className: cn(
                      "flex w-full items-start gap-3 rounded-xl p-2 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:hover:bg-slate-800/50",
                    ),
                  }
                : {
                    className: "flex items-start gap-3 rounded-xl p-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50",
                  })}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  TONES[item.tone],
                )}
                aria-hidden="true"
              >
                {item.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold leading-snug text-slate-800 dark:text-slate-100">
                  {item.title}
                </p>
                {item.meta && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.meta}</p>}
              </div>
              {item.time && (
                <span className="shrink-0 pt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {relativeTime(item.time)}
                </span>
              )}
            </Row>
          </li>
        );
      })}
    </ul>
  );
}