import { cn } from "../../lib/cn";
import { clamp } from "../../utils/formatters";

interface Props {
  value: number; // 0..100
  tone?: "brand" | "gold" | "green" | "red" | "amber" | "sky" | "violet" | "slate";
  className?: string;
  barClassName?: string;
  height?: string;
}

const TONES = {
  brand: "bg-brand-500",
  gold: "bg-gold-500",
  green: "bg-emerald-500",
  red: "bg-red-500",
  amber: "bg-amber-400",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  slate: "bg-slate-400",
} as const;

export function ProgressBar({
  value,
  tone = "brand",
  className,
  barClassName,
  height = "h-2",
}: Props) {
  const pct = clamp(value, 0, 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800", height, className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-700 ease-out",
          TONES[tone],
          barClassName,
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ProgressRing({
  value,
  size = 56,
  stroke = 6,
  tone = "brand",
  label,
}: {
  value: number; // 0..100
  size?: number;
  stroke?: number;
  tone?: keyof typeof TONES;
  label?: string;
}) {
  const pct = clamp(value, 0, 100);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-slate-100 dark:stroke-slate-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={cn("transition-[stroke-dashoffset] duration-700 ease-out", TONES[tone])}
        />
      </svg>
      <span className="absolute text-xs font-bold text-slate-700 dark:text-slate-200">
        {label ?? `${Math.round(pct)}%`}
      </span>
    </div>
  );
}