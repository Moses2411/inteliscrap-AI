import { useMemo, useRef, useState, useId, type MouseEvent as ReactMouseEvent } from "react";
import { cn } from "../../lib/cn";

export interface Series {
  name: string;
  values: number[];
  color?: string;
}

interface Props {
  labels: string[];
  series: Series[];
  height?: number;
  formatValue?: (v: number) => string;
  className?: string;
}

const DEFAULT_COLORS = ["var(--c-brand)", "var(--c-sky)", "var(--c-gold)", "var(--c-violet)"];

function smoothPath(pts: Array<[number, number]>): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const mx = (x0 + x1) / 2;
    d += ` C${mx},${y0.toFixed(1)} ${mx},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return d;
}

/** Responsive multi-series area chart with hover tooltip. Pure SVG. */
export function AreaChart({ labels, series, height = 240, formatValue, className }: Props) {
  const gid = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const W = 640;
  const H = height;
  const padL = 44;
  const padR = 12;
  const padT = 14;
  const padB = 28;

  const all = useMemo(() => series.flatMap((s) => s.values), [series]);
  const maxV = Math.max(1, ...all) * 1.08;
  const niceMax = niceCeil(maxV);
  const ticks = useMemo(() => niceTicks(niceMax, 4), [niceMax]);

  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const xFor = (i: number) => padL + (labels.length <= 1 ? innerW / 2 : (i * innerW) / (labels.length - 1));
  const yFor = (v: number) => padT + innerH * (1 - v / niceMax);

  function onMove(e: ReactMouseEvent<HTMLDivElement>) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((relX - padL) / innerW) * (labels.length - 1));
    setHover(Math.max(0, Math.min(labels.length - 1, idx)));
  }

  const lastIdx = labels.length - 1;

  if (labels.length === 0 || series.length === 0) {
    return (
      <div className={cn("flex h-40 items-center justify-center text-sm text-slate-400", className)}>
        Not enough data yet
      </div>
    );
  }

  return (
    <div ref={wrapRef} className={cn("relative", className)} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
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
              className="text-slate-400 dark:text-slate-500"
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
              x={xFor(i)}
              y={H - 8}
              textAnchor="middle"
              fontSize={10.5}
              fill="currentColor"
              className="text-slate-400 dark:text-slate-500"
            >
              {l}
            </text>
          );
        })}

        {/* series */}
        {series.map((s, si) => {
          const color = s.color ?? DEFAULT_COLORS[si % DEFAULT_COLORS.length];
          const pts = s.values.map((v, i) => [xFor(i), yFor(v)] as [number, number]);
          const line = smoothPath(pts);
          const area = `${line} L${xFor(lastIdx).toFixed(1)},${padT + innerH} L${xFor(0).toFixed(1)},${padT + innerH} Z`;
          return (
            <g key={s.name}>
              <defs>
                <linearGradient id={`area-${gid}-${si}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.26" />
                  <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <path d={area} fill={`url(#area-${gid}-${si})`} />
              <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        })}

        {/* hover guide */}
        {hover != null && (
          <g pointerEvents="none">
            <line
              x1={xFor(hover)}
              x2={xFor(hover)}
              y1={padT}
              y2={padT + innerH}
              stroke="var(--c-brand)"
              strokeWidth={1}
              strokeDasharray="3 4"
            />
            {series.map((s, si) => {
              const color = s.color ?? DEFAULT_COLORS[si % DEFAULT_COLORS.length];
              return (
                <circle key={s.name} cx={xFor(hover)} cy={yFor(s.values[hover])} r={4.5} fill={color} stroke="white" strokeWidth={2} />
              );
            })}
          </g>
        )}
      </svg>

      {/* tooltip */}
      {hover != null && (
        <div className="pointer-events-none absolute z-10 -mt-32 ml-4 rounded-xl border border-slate-100 bg-white/95 px-3 py-2 text-xs shadow-card-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          <p className="mb-1.5 font-bold text-slate-900 dark:text-white">{labels[hover]}</p>
          {series.map((s, si) => (
            <p key={s.name} className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: s.color ?? DEFAULT_COLORS[si % DEFAULT_COLORS.length] }}
              />
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {formatValue ? formatValue(s.values[hover]) : compact(s.values[hover])}
              </span>
              <span className="text-slate-400">{s.name}</span>
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