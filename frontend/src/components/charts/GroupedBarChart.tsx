import { useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/cn";
import type { Series } from "./AreaChart";

interface Props {
  labels: string[];
  series: Series[];
  height?: number;
  formatValue?: (v: number) => string;
  className?: string;
}

const DEFAULT_COLORS = ["var(--c-brand)", "var(--c-sky)", "var(--c-gold)", "var(--c-violet)"];

/** Responsive grouped bar chart with hover tooltip. Pure SVG + framer-motion grow-in. */
export function GroupedBarChart({ labels, series, height = 260, formatValue, className }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const W = 640;
  const H = height;
  const padL = 44;
  const padR = 12;
  const padT = 14;
  const padB = 28;

  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const all = useMemo(() => series.flatMap((s) => s.values), [series]);
  const niceMax = niceCeil(Math.max(1, ...all) * 1.08);
  const ticks = useMemo(() => niceTicks(niceMax, 4), [niceMax]);
  const yFor = (v: number) => padT + innerH * (1 - v / niceMax);

  const groupW = labels.length > 0 ? innerW / labels.length : innerW;
  const slotW = Math.min(groupW * 0.64, 48);
  const barW = series.length > 0 ? Math.max(4, (slotW - (series.length - 1) * 4) / series.length) : 0;

  function onMove(e: ReactMouseEvent<HTMLDivElement>) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.floor((relX - padL) / groupW);
    setHover(Math.max(0, Math.min(labels.length - 1, idx)));
  }

  const lastIdx = labels.length - 1;

  if (labels.length === 0 || series.length === 0) {
    return (
      <div className={cn("flex h-40 items-center justify-center text-sm text-slate-500 dark:text-slate-400", className)}>
        Not enough data yet
      </div>
    );
  }

  return (
    <div ref={wrapRef} className={cn("relative", className)} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={series
          .map((s) => `${s.name}: ${labels.map((l, i) => `${l} ${formatValue ? formatValue(s.values[i] ?? 0) : compact(s.values[i] ?? 0)}`).join(", ")}`)
          .join(". ")}
      >
        {/* grid + y labels */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={yFor(t)} y2={yFor(t)} stroke="var(--c-grid)" strokeDasharray="4 5" />
            <text
              x={padL - 8}
              y={yFor(t) + 3.5}
              textAnchor="end"
              fontSize={10.5}
              fill="currentColor"
              className="text-slate-500 dark:text-slate-400"
            >
              {formatValue ? formatValue(t) : compact(t)}
            </text>
          </g>
        ))}

        {/* x labels */}
        {labels.map((l, i) => {
          const show = labels.length <= 8 || i % Math.ceil(labels.length / 8) === 0 || i === lastIdx;
          if (!show) return null;
          return (
            <text
              key={`${l}-${i}`}
              x={padL + i * groupW + groupW / 2}
              y={H - 8}
              textAnchor="middle"
              fontSize={10.5}
              fill="currentColor"
              className="text-slate-500 dark:text-slate-400"
            >
              {l}
            </text>
          );
        })}

        {/* hovered column highlight */}
        {hover != null && (
          <rect
            x={padL + hover * groupW + 1}
            y={padT}
            width={Math.max(0, groupW - 2)}
            height={innerH}
            rx={8}
            className="fill-slate-100 dark:fill-slate-800/60"
          />
        )}

        {/* grouped bars */}
        {labels.map((_, i) => {
          const cx = padL + i * groupW + groupW / 2;
          const groupLeft = cx - slotW / 2;
          return series.map((s, si) => {
            const v = Math.max(0, s.values[i] ?? 0);
            const x = groupLeft + si * (barW + 4);
            const y = yFor(v);
            const h = Math.max(0, padT + innerH - y);
            const color = s.color ?? DEFAULT_COLORS[si % DEFAULT_COLORS.length];
            return (
              <motion.rect
                key={`${i}-${si}`}
                x={x}
                width={barW}
                rx={Math.min(4, barW / 2)}
                fill={color}
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1 }}
                transition={{ delay: 0.12 + i * 0.07 + si * 0.04, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                style={{ y, height: h, transformBox: "fill-box", transformOrigin: "50% 100%" }}
              />
            );
          });
        })}
      </svg>

      {/* tooltip */}
      {hover != null && (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-xl border border-slate-100 bg-white/95 px-3 py-2 text-xs shadow-card-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
          style={{
            left: `${Math.min(88, Math.max(12, ((padL + hover * groupW + groupW / 2) / W) * 100))}%`,
          }}
        >
          <p className="mb-1.5 font-bold text-slate-900 dark:text-white">{labels[hover]}</p>
          {series.map((s, si) => (
            <p key={s.name} className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: s.color ?? DEFAULT_COLORS[si % DEFAULT_COLORS.length] }}
              />
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {formatValue ? formatValue(s.values[hover] ?? 0) : compact(s.values[hover] ?? 0)}
              </span>
              <span className="text-slate-500 dark:text-slate-400">{s.name}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${Math.round(n)}`;
}

function niceCeil(v: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / pow;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return nice * pow;
}

function niceTicks(max: number, count: number): number[] {
  const step = max / count;
  const out: number[] = [];
  for (let i = 0; i <= count; i++) out.push(Math.round(step * i));
  return out;
}
