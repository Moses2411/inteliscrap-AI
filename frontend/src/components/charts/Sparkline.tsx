import { useId } from "react";
import { cn } from "../../lib/cn";

interface Props {
  values: number[];
  color?: string;
  height?: number;
  className?: string;
  strokeWidth?: number;
}

/** Mini trend line with gradient fill — no axes, no dependencies. */
export function Sparkline({
  values,
  color = "var(--c-brand)",
  height = 40,
  className,
  strokeWidth = 2,
}: Props) {
  const gid = useId();
  if (values.length < 2) return null;

  const w = 120;
  const pad = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = (w - pad * 2) / (values.length - 1);

  const pts = values.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (height - pad * 2) * (1 - (v - min) / range);
    return [x, y] as const;
  });

  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${height} L${pts[0][0].toFixed(1)},${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className={cn("block w-full", className)}
      style={{ height }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`spark-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}