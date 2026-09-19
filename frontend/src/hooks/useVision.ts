import { useCallback, useState } from "react";
import type { VisionAnalysis } from "../types";
import { analyzeScrapImage, AnalysisUnavailableError } from "../services/analysis";

export function useVision() {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (image: Blob): Promise<VisionAnalysis> => {
    setError(null);
    setLoadingProgress(10);
    try {
      const analysis = await analyzeScrapImage(image);
      setLoadingProgress(100);
      return analysis;
    } catch (e) {
      setLoadingProgress(100);
      const message = e instanceof Error ? e.message : "Vision failed";
      setError(message);
      throw e;
    }
  }, []);

  return { analyze, loadingProgress, error };
}

export { AnalysisUnavailableError };