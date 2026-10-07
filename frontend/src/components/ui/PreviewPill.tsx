import { WandSparkles } from "lucide-react";

/**
 * "Preview data" chip shown when dashboards render demo data.
 * Standalone chip (not Badge) so light keeps the subtle gold tint while dark
 * mode flips to a solid amber pill with dark text for maximum legibility.
 */
export function PreviewPill() {
  return (
    <span className="chip shrink-0 whitespace-nowrap bg-gold-100 px-3 py-1.5 text-gold-800 ring-1 ring-inset ring-gold-600/25 dark:bg-gold-500 dark:text-gold-950 dark:ring-gold-400/40">
      <WandSparkles className="h-3.5 w-3.5" aria-hidden="true" />
      Preview data
    </span>
  );
}
