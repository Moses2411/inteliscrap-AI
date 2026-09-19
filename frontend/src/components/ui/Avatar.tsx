import { cn } from "../../lib/cn";

const TONES = [
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-gold-100 text-gold-800 dark:bg-gold-950 dark:text-gold-300",
  "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
];

function toneFor(name: string): string {
  const hash = Array.from(name).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return TONES[hash % TONES.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizes = {
    sm: "h-8 w-8 text-[11px]",
    md: "h-10 w-10 text-xs",
    lg: "h-12 w-12 text-sm",
    xl: "h-16 w-16 text-lg",
  } as const;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold",
        sizes[size],
        toneFor(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}