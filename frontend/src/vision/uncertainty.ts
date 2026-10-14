// Confidence assessment for the vision pipeline.
//
// A classifier that is forced to always emit a top-1 label will confidently
// confuse visually similar materials (copper vs brass, aluminum vs steel). This
// module turns that into an explicit "not sure" signal so the app asks the user
// to confirm instead of silently trading on a guess.
//
// The thresholds are intentionally source-aware: a trained ONNX model and the
// server model produce roughly calibrated softmax scores, while the offline
// colour heuristic does not, so it is held to a stricter bar.

export type UncertaintySource = "clip" | "onnx" | "server" | "heuristic" | "manual";

export interface UncertaintyConfig {
  /** Minimum top-1 confidence required to be treated as a firm answer. */
  minTop1: number;
  /** Minimum gap between top-1 and top-2 before a result is called ambiguous. */
  minMargin: number;
  /** Normalized-entropy ceiling above which a distribution is called diffuse. */
  maxEntropy: number;
}

export const UNCERTAINTY_THRESHOLDS: Record<UncertaintySource, UncertaintyConfig> = {
  onnx: { minTop1: 0.55, minMargin: 0.12, maxEntropy: 0.82 },
  server: { minTop1: 0.6, minMargin: 0.08, maxEntropy: 0.88 },
  heuristic: { minTop1: 0.62, minMargin: 0.15, maxEntropy: 0.8 },
  clip: { minTop1: 0.55, minMargin: 0.12, maxEntropy: 0.82 },
  // Manual picks are user-asserted and never flagged uncertain.
  manual: { minTop1: 0, minMargin: 0, maxEntropy: 1 },
};

export type UncertaintyReason =
  | "confident"
  | "low_confidence"
  | "ambiguous"
  | "diffuse"
  | "forced";

export interface UncertaintyAssessment {
  uncertain: boolean;
  reason: UncertaintyReason;
  /** Top-1 confidence after clamping. */
  top1: number;
  /** top1 - top2, or Infinity when there is only one candidate. */
  margin: number;
  /** Shannon entropy of the normalized distribution, scaled to [0, 1]. */
  entropy: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Shannon entropy of `values` normalized to a distribution, scaled to [0, 1]. */
export function normalizedEntropy(values: number[]): number {
  const cleaned = values.map(clamp01);
  const total = cleaned.reduce((sum, v) => sum + v, 0);
  if (total <= 0 || cleaned.length <= 1) return 0;
  let entropy = 0;
  for (const value of cleaned) {
    const p = value / total;
    if (p > 0) entropy -= p * Math.log(p);
  }
  return entropy / Math.log(cleaned.length);
}

/**
 * Decide whether a ranked list of predictions is confident enough to present as
 * a firm answer, and why not when it isn't.
 */
export function assessUncertainty(
  candidates: { confidence: number }[],
  source: UncertaintySource = "onnx",
): UncertaintyAssessment {
  const config = UNCERTAINTY_THRESHOLDS[source] ?? UNCERTAINTY_THRESHOLDS.onnx;
  const confidences = candidates
    .map((candidate) => clamp01(Number(candidate.confidence) || 0))
    .sort((a, b) => b - a);

  const top1 = confidences[0] ?? 0;
  const top2 = confidences[1] ?? 0;
  const margin = confidences.length > 1 ? top1 - top2 : Infinity;
  const entropy = normalizedEntropy(confidences);

  if (source === "manual" || candidates.length === 0) {
    return { uncertain: false, reason: "forced", top1, margin, entropy };
  }
  if (top1 < config.minTop1) {
    return { uncertain: true, reason: "low_confidence", top1, margin, entropy };
  }
  if (confidences.length > 1 && margin < config.minMargin) {
    return { uncertain: true, reason: "ambiguous", top1, margin, entropy };
  }
  // Only meaningful with enough candidates; entropy over 2 points is coarse.
  if (confidences.length >= 3 && entropy > config.maxEntropy) {
    return { uncertain: true, reason: "diffuse", top1, margin, entropy };
  }
  return { uncertain: false, reason: "confident", top1, margin, entropy };
}
