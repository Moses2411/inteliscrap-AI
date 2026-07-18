interface Props {
  progress?: number;
  label?: string;
}

export default function LoadingSpinner({ progress, label }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <div className="relative h-12 w-12">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-brand-600" />
        {progress !== undefined && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-brand-600">{progress}%</span>
          </div>
        )}
      </div>
      {label && <p className="text-sm text-gray-500">{label}</p>}
    </div>
  );
}
