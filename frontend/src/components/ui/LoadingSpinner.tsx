interface Props {
  progress?: number;
  label?: string;
}

export default function LoadingSpinner({ progress, label }: Props) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-3 py-12">
      <div className="relative h-12 w-12" aria-hidden="true">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600 dark:border-slate-800 dark:border-t-brand-400" />
        {progress !== undefined && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-brand-600 dark:text-brand-400">{progress}%</span>
          </div>
        )}
      </div>
      {label && <p className="text-sm text-slate-600 dark:text-slate-400">{label}</p>}
    </div>
  );
}
