import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "../../lib/cn";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Compact centered popup dialog.
 *
 * Like `Sheet`, but anchored to the middle of the viewport — good for short
 * announcements ("coming soon") and confirmations. WCAG: moves focus into the
 * dialog on open, restores it to the trigger on close, closes on Escape, and
 * links the title via aria-labelledby.
 */
export function Modal({ open, onClose, title, children, className }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      openerRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <button
        aria-label="Close overlay"
        tabIndex={-1}
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title != null ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          "relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-card-lg animate-scale-in dark:bg-slate-900",
          className,
        )}
      >
        {title != null && (
          <h3 id={titleId} className="text-base font-bold text-slate-900 dark:text-white">
            {title}
          </h3>
        )}
        <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">{children}</div>
      </div>
    </div>
  );
}
