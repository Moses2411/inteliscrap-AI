import { motion } from "framer-motion";
import { cn } from "../../lib/cn";

export interface BubbleItem {
  label: string;
  value: number;
  color?: string;
}

interface Props {
  items: BubbleItem[];
  className?: string;
}

const DEFAULT_COLORS = ["var(--c-brand)", "var(--c-gold)", "var(--c-sky)", "var(--c-violet)", "var(--c-rose)"];

/** Clustered bubbles sized by value share, springing in on mount. */
export function BubbleCloud({ items, className }: Props) {
  const total = items.reduce((a, i) => a + i.value, 0) || 1;
  const max = Math.max(1, ...items.map((i) => i.value));

  if (items.length === 0) return null;

  return (
    <div
      className={cn("flex flex-wrap items-center justify-center gap-2.5", className)}
      role="img"
      aria-label={items.map((i) => `${i.label} ${Math.round((i.value / total) * 100)}%`).join(", ")}
    >
      {items.map((item, i) => {
        const ratio = Math.sqrt(Math.max(0, item.value) / max);
        const size = Math.round(72 + 60 * ratio);
        const color = item.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
        const pct = Math.round((item.value / total) * 100);
        return (
          <motion.div
            key={item.label}
            className="flex select-none flex-col items-center justify-center rounded-full px-1.5 text-center text-white shadow-md"
            style={{ width: size, height: size, background: color }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.12 + i * 0.08, type: "spring", stiffness: 240, damping: 18 }}
            whileHover={{ scale: 1.07 }}
            title={`${item.label} · ${pct}%`}
          >
            <span className="text-[10px] font-bold leading-tight [overflow-wrap:anywhere]">{item.label}</span>
            <span className="text-xs font-extrabold leading-tight">{pct}%</span>
          </motion.div>
        );
      })}
    </div>
  );
}
