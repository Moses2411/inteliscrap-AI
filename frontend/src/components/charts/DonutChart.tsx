import { cn } from "../../lib/cn";

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface Props {
  segments: DonutSegment[];
  centerLabel?: string;
  centerValue?: string;
  size?: number;
  thickness?: number;
  className?: string;
  formatValue?: (v: number) => string;
}

export function DonutChart({
  segments,
  centerLabel,
  centerValue,
  size = 172,
  thickness = 22,
  className,
  formatValue,
}: Props) {
  const total = Math.max(1, segments.reduce((acc, s) => acc + s.value, 0));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className={cn("flex flex-col items-center gap-5 sm:flex-row sm:justify-center", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness} className="stroke-slate-100 dark:stroke-slate-800" />
          {segments.map((seg) => {
            const frac = seg.value / total;
            const dash = frac * c;
            const el = (
              <circle
                key={seg.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeLinecap="round"
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                className="transition-all duration-700 ease-out"
              />
            );
            offset += dash;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {centerValue ?? compact(total)}
          </span>
          {centerLabel && (
            <span className="max-w-[90px] truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {centerLabel}
            </span>
          )}
        </div>
      </div>

      <ul className="w-full max-w-[220px] space-y-2">
        {segments.map((seg) => (
          <li key={seg.label} className="flex items-center justify-between gap-2 text-xs">
            <span className="inline-flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ background: seg.color }} />
              <span className="truncate font-medium text-slate-600 dark:text-slate-300">{seg.label}</span>
            </span>
            <span className="shrink-0 font-bold text-slate-800 dark:text-slate-100">
              {formatValue ? formatValue(seg.value) : compact(seg.value)}
              <span className="ml-1 font-medium text-slate-500 dark:text-slate-400">({Math.round((seg.value / total) * 100)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${Math.round(n)}`;
}