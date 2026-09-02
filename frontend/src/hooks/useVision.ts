import { useCallback, useState } from "react";
import type { VisionAnalysis } from "../types";
import { classifyScrap } from "../vision/visionEngine";
import { resolveTradeRule } from "../services/language";

export function useVision() {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (image: Blob): Promise<VisionAnalysis> => {
    setError(null);
    setLoadingProgress(10);
    try {
      const result = await classifyScrap(image);
      setLoadingProgress(85);

      const top = result.top;
      const rule = resolveTradeRule(top.materialSlug);

      setLoadingProgress(100);
      return {
        material_class: top.material,
        material_slug: top.materialSlug,
        confidence: top.confidence,
        toxicity_hazards: rule.hazards,
        safety_instructions: rule.safety,
        hazard_level: rule.hazardLevel,
      };
    } catch (e) {
      setLoadingProgress(100);
      const message = e instanceof Error ? e.message : "Vision failed";
      setError(message);
      throw e;
    }
  }, []);

  return { analyze, loadingProgress, error };
}
