import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  side?: "bottom" | "right";
}

/**
 * Lightweight modal: bottom sheet on mobile, centered/right panel on larger screens.
 * Focus trap kept intentionally simple (offline-first, no extra deps).
 */
export function Sheet({ open, onClose, title, children, footer, side = "bottom" }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        aria-label="Close overlay"
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-card-lg animate-slide-in-right sm:max-w-lg sm:rounded-2xl dark:bg-slate-900",
          side === "right" && "sm:ml-auto sm:h-full sm:max-h-full sm:max-w-md sm:rounded-none",
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="btn-icon !h-8 !w-8" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="border-t border-slate-100 px-5 py-3.5 dark:border-slate-800">{footer}</div>
        )}
      </div>
    </div>
  );
}