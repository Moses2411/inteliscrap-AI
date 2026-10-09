import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type Tone =
  | "brand"
  | "gold"
  | "green"
  | "red"
  | "amber"
  | "sky"
  | "violet"
  | "rose"
  | "slate"
  | "outline";

const TONES: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-700 ring-brand-600/15 dark:bg-brand-950/80 dark:text-brand-300 dark:ring-brand-400/20",
  gold: "bg-gold-100 text-gold-800 ring-gold-600/25 dark:bg-gold-950/70 dark:text-gold-300 dark:ring-gold-400/25",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-950/80 dark:text-emerald-300 dark:ring-emerald-400/20",
  red: "bg-red-50 text-red-700 ring-red-600/15 dark:bg-red-950/80 dark:text-red-300 dark:ring-red-400/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/70 dark:text-amber-300 dark:ring-amber-400/20",
  sky: "bg-sky-50 text-sky-700 ring-sky-600/15 dark:bg-sky-950/70 dark:text-sky-300 dark:ring-sky-400/20",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/15 dark:bg-violet-950/70 dark:text-violet-300 dark:ring-violet-400/20",
  rose: "bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-950/70 dark:text-rose-300 dark:ring-rose-400/20",
  slate: "bg-slate-100 text-slate-700 ring-slate-500/15 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-500/25",
  outline: "bg-transparent text-slate-600 ring-slate-300 dark:text-slate-300 dark:ring-slate-600",
};

interface Props {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = "slate", className, children }: Props) {
  return (
    <span
      className={cn("chip ring-1 ring-inset", TONES[tone], className)}
    >
      {children}
    </span>
  );
}