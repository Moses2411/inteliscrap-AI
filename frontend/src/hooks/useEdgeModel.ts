import { useEffect, useState } from "react";
import type { VisionModelStatus } from "../types";
import { getEdgeModelStatus } from "../services/analysis";
import { subscribeVisionStatus } from "../vision/visionEngine";

/**
 * Live readiness of the on-device model. The model is downloaded once when there
 * is connectivity and then cached, so this reports when scans have become fully
 * offline. Re-probes when the device comes back online.
 */
export function useEdgeModel(): VisionModelStatus | null {
  const [status, setStatus] = useState<VisionModelStatus | null>(null);

  useEffect(() => {
    let active = true;
    const apply = (next: VisionModelStatus) => {
      if (active) setStatus(next);
    };

    const unsubscribe = subscribeVisionStatus(apply);
    const probe = () => {
      void getEdgeModelStatus().then(apply).catch(() => {});
    };

    // Ensure a probe is running even if the startup warm-up has not fired yet.
    probe();
    window.addEventListener("online", probe);

    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("online", probe);
    };
  }, []);

  return status;
}
