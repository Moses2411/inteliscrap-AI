import type { ReactNode } from "react";
import { motion, MotionConfig, type Variants } from "framer-motion";
import { cn } from "../../lib/cn";

/** Page-level container — stagger direct children on entry. */
export const pageContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

/** Nested grid/list container — stagger its own children. */
export const pageStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

/** Leaf item — fade + slide up. */
export const pageItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

/**
 * Shared page wrapper: MotionConfig (respects prefers-reduced-motion) +
 * stagger container. Direct children should set `variants={pageItem}`
 * (or `variants={pageStagger}` for grids/lists of items).
 */
export function PageMotion({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div initial="hidden" animate="show" variants={pageContainer} className={cn(className)}>
        {children}
      </motion.div>
    </MotionConfig>
  );
}
