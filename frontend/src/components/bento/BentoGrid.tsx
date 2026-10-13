import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

export function BentoGrid({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("bento-grid", className)} {...props}>
      {children}
    </div>
  );
}

export type Span = 1 | 2 | 3 | 4;
export type RowSpan = 1 | 2;
export type Gradient = "none" | "emerald" | "lime" | "cyan" | "amber";
export type CardStatus = "online" | "offline" | "pending" | "error" | "live";

const SPAN_CLASS: Record<Span, string> = {
  1: "",
  2: "sm:col-span-2",
  3: "sm:col-span-2 lg:col-span-3",
  4: "sm:col-span-2 lg:col-span-4",
};

const ROW_CLASS: Record<RowSpan, string> = {
  1: "",
  2: "lg:row-span-2",
};

const GLOW: Record<Exclude<Gradient, "none">, string> = {
  emerald: "from-eco-emerald/25",
  lime: "from-eco-lime/25",
  cyan: "from-eco-cyan/25",
  amber: "from-eco-amber/25",
};

const STATUS: Record<CardStatus, string> = {
  online: "border-eco-emerald/30 bg-eco-emerald/15 text-eco-emerald-glow",
  live: "border-eco-cyan/30 bg-eco-cyan/15 text-eco-cyan-glow",
  offline: "border-eco-red/30 bg-eco-red/15 text-eco-red-glow",
  pending: "border-eco-amber/30 bg-eco-amber/15 text-eco-amber-glow",
  error: "border-eco-red/30 bg-eco-red/15 text-eco-red-glow",
};

export interface BentoCardProps extends HTMLAttributes<HTMLElement> {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  status?: CardStatus;
  statusLabel?: string;
  span?: Span;
  rowSpan?: RowSpan;
  gradient?: Gradient;
  hover?: boolean;
  loading?: boolean;
  children: ReactNode;
}

export function BentoCard({
  title,
  subtitle,
  icon,
  action,
  status,
  statusLabel,
  span = 1,
  rowSpan = 1,
  gradient = "none",
  hover = true,
  loading = false,
  className,
  children,
  ...props
}: BentoCardProps) {
  return (
    <section
      className={cn(
        "bento-card",
        hover && "bento-card-lift",
        SPAN_CLASS[span],
        ROW_CLASS[rowSpan],
        className,
      )}
      {...props}
    >
      {gradient !== "none" && (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-gradient-to-br to-transparent blur-3xl",
            GLOW[gradient],
          )}
        />
      )}
      {gradient === "emerald" && <div className="bento-scanline" aria-hidden="true" />}

      <div className="relative flex h-full flex-col p-4 sm:p-5">
        {(title || icon || action || status) && (
          <header className="mb-4 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {icon && (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-eco-emerald-glow">
                  {icon}
                </span>
              )}
              <div className="min-w-0">
                {title && (
                  <h3 className="truncate text-sm font-semibold text-slate-100">{title}</h3>
                )}
                {subtitle && <p className="truncate text-xs text-slate-400">{subtitle}</p>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {status && (
                <span className={cn("eco-chip", STATUS[status])}>
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full bg-current",
                      (status === "online" || status === "live" || status === "pending") &&
                        "animate-pulse-soft",
                    )}
                  />
                  {statusLabel ?? status}
                </span>
              )}
              {action}
            </div>
          </header>
        )}
        <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
      </div>

      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center gap-3 rounded-3xl bg-obsidian-950/75 backdrop-blur-sm">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-eco-emerald-glow border-t-transparent" />
          <span className="text-sm text-slate-300">Working…</span>
        </div>
      )}
    </section>
  );
}
