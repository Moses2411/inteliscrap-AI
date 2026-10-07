import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/cn";

export interface RadialSegment {
  label: string;
  value: number;
  color: string;
}

interface Props {
  segments: RadialSegment[];
  centerValue: string;
  centerLabel?: string;
  formatValue?: (v: number) => string;
  className?: string;
}

const SIZE = 240;
const CENTER = SIZE / 2;
const MAX_R = 108;
const RING_W = 12;
const RING_GAP = 5;
const MAX_RINGS = 5;

/** Concentric radial rings (top segments + aggregated rest) with an animated legend. */
export function RadialChart({ segments, centerValue, centerLabel, formatValue, className }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  const total = segments.reduce((a, s) => a + s.value, 0) || 1;

  const rings: RadialSegment[] = (() => {
    if (segments.length <= MAX_RINGS) return segments;
    const top = segments.slice(0, MAX_RINGS - 1);
    const rest = segments.slice(MAX_RINGS - 1);
    return [
      ...top,
      {
        label: `Others (${rest.length})`,
        value: rest.reduce((a, s) => a + s.value, 0),
        color: "var(--c-rose)",
      },
    ];
  })();

  if (rings.length === 0) return null;

  return (
    <div className={cn("flex flex-col items-center gap-5", className)}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-auto w-[200px] max-w-full sm:w-[232px]"
        role="img"
        aria-label={`Distribution: ${segments.map((s) => s.label).join(", ")}`}
      >
        <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
          {rings.map((seg, i) => {
            const r = MAX_R - i * (RING_W + RING_GAP);
            const c = 2 * Math.PI * r;
            const share = Math.min(1, Math.max(0, seg.value / total));
            const dim = hover != null && hover !== i;
            return (
              <g key={seg.label}>
                <circle cx={CENTER} cy={CENTER} r={r} fill="none" stroke="var(--c-grid)" strokeWidth={RING_W} />
                <motion.circle
                  cx={CENTER}
                  cy={CENTER}
                  r={r}
                  fill="none"
                  stroke={seg.color}
                  strokeLinecap="round"
                  strokeDasharray={`${c} ${c}`}
                  initial={{ strokeDashoffset: c, strokeWidth: RING_W, opacity: 1 }}
                  animate={{
                    strokeDashoffset: c * (1 - share),
                    strokeWidth: hover === i ? RING_W + 3 : RING_W,
                    opacity: dim ? 0.35 : 1,
                  }}
                  transition={{
                    strokeDashoffset: { delay: 0.15 + i * 0.12, duration: 0.9, ease: [0.22, 1, 0.36, 1] },
                    strokeWidth: { duration: 0.2 },
                    opacity: { duration: 0.2 },
                  }}
                />
              </g>
            );
          })}
        </g>
        <text
          x={CENTER}
          y={centerLabel ? CENTER + 1 : CENTER + 7}
          textAnchor="middle"
          fontSize={20}
          fontWeight={800}
          fill="currentColor"
          className="fill-slate-900 dark:fill-white"
        >
          {centerValue}
        </text>
        {centerLabel && (
          <text
            x={CENTER}
            y={CENTER + 20}
            textAnchor="middle"
            fontSize={10}
            fontWeight={700}
            letterSpacing="0.06em"
            fill="currentColor"
            className="fill-slate-400 dark:fill-slate-500"
          >
            {centerLabel.toUpperCase()}
          </text>
        )}
      </svg>

      <ul className="w-full min-w-0 space-y-3">
        {rings.map((seg, i) => {
          const share = Math.min(1, Math.max(0, seg.value / total));
          return (
            <li
              key={seg.label}
              className="cursor-default"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: seg.color }} />
                <span className="truncate font-semibold text-slate-600 dark:text-slate-300">{seg.label}</span>
                <span className="ml-auto whitespace-nowrap font-bold text-slate-900 dark:text-white">
                  {formatValue ? formatValue(seg.value) : Math.round(seg.value).toLocaleString()}
                </span>
                <span className="w-10 shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-center text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {Math.round(share * 100)}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: seg.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${share * 100}%` }}
                  transition={{ delay: 0.2 + i * 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
