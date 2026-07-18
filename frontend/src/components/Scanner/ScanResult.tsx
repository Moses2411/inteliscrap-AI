import type { GemmaAnalysis } from "../../types";
import { formatNaira, formatConfidence } from "../../utils/formatters";

interface Props {
  result: GemmaAnalysis;
  estimated_value: number;
  onReadAloud?: () => void;
  onScanAgain?: () => void;
}

function getHazardLevel(hazards: string[]): { level: string; color: string } {
  if (hazards.length === 0) return { level: "Safe", color: "bg-green-100 text-green-800" };
  if (hazards.some((h) => h.includes("acid") || h.includes("lead") || h.includes("mercury")))
    return { level: "High Risk", color: "bg-red-100 text-red-800" };
  return { level: "Caution", color: "bg-yellow-100 text-yellow-800" };
}

export default function ScanResult({ result, estimated_value, onReadAloud, onScanAgain }: Props) {
  const hazard = getHazardLevel(result.toxicity_hazards ?? []);

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-500">Material</h3>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${hazard.color}`}>
            {hazard.level}
          </span>
        </div>
        <p className="text-xl font-bold text-gray-900">{result.material_class}</p>

        <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-3">
          <div>
            <span className="text-xs text-gray-500">Estimated Value</span>
            <p className="text-lg font-bold text-brand-600">{formatNaira(estimated_value)}</p>
          </div>
          <div>
            <span className="text-xs text-gray-500">Confidence</span>
            <p className="text-lg font-semibold text-gray-900">{formatConfidence(result.confidence)}</p>
          </div>
        </div>
      </div>

      {result.toxicity_hazards && result.toxicity_hazards.length > 0 && (
        <div className="card space-y-2 border-l-4 border-red-400">
          <h4 className="text-sm font-semibold text-red-700">Hazards Detected</h4>
          <ul className="space-y-1">
            {result.toxicity_hazards.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-600">
                <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500" />
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.safety_instructions && (
        <div className="card bg-brand-50 ring-brand-200">
          <p className="text-sm text-brand-800">{result.safety_instructions}</p>
        </div>
      )}

      <div className="flex gap-3">
        {onReadAloud && (
          <button onClick={onReadAloud} className="btn-secondary flex-1 gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
            Read Aloud
          </button>
        )}
        {onScanAgain && (
          <button onClick={onScanAgain} className="btn-primary flex-1">
            Scan Again
          </button>
        )}
      </div>
    </div>
  );
}
