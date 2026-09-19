import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Badge, type Tone } from "./Badge";

const STATUS_TONE: Record<string, Tone> = {
  offered: "brand",
  pending: "amber",
  accepted: "sky",
  scheduled: "violet",
  in_transit: "sky",
  completed: "green",
  settled: "green",
  matched: "brand",
  active: "green",
  filled: "green",
  open: "brand",
  expired: "slate",
  cancelled: "red",
  failed: "red",
  paid: "green",
  synced: "green",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = STATUS_TONE[status.toLowerCase()] ?? "slate";
  return (
    <Badge tone={tone} className={className}>
      {status.replace("_", " ")}
    </Badge>
  );
}

/** Dot + label row used in tables/feeds */
export function StatusDot({ status, label, className }: { status: string; label?: ReactNode; className?: string }) {
  const tone = STATUS_TONE[status.toLowerCase()] ?? "slate";
  const dot: Record<Tone, string> = {
    brand: "bg-brand-500",
    gold: "bg-gold-500",
    green: "bg-emerald-500",
    red: "bg-red-500",
    amber: "bg-amber-400",
    sky: "bg-sky-500",
    violet: "bg-violet-500",
    rose: "bg-rose-500",
    slate: "bg-slate-400",
    outline: "bg-slate-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300",
        className,
      )}
    >
      <span className={cn("badge-dot", dot[tone])} />
      {label ?? status.replace("_", " ")}
    </span>
  );
}