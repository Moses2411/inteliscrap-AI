import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface TabOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  count?: number;
}

interface Props<T extends string> {
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
}

export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "sm",
}: Props<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/70",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg font-semibold transition-all duration-150",
              size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
              active
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
            )}
          >
            {opt.icon}
            {opt.label}
            {opt.count != null && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  active
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                    : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}