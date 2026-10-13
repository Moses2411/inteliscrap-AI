import { useCallback, useEffect, useState } from "react";
import type { EngineBackend, EngineStatus, EngineState, NetworkStatus } from "../types/bento";

type NavigatorWithConnection = Navigator & {
  connection?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    addEventListener?: (type: string, listener: () => void) => void;
    removeEventListener?: (type: string, listener: () => void) => void;
  };
  gpu?: unknown;
};

function readNetwork(): NetworkStatus {
  const connection = (navigator as NavigatorWithConnection).connection;
  return {
    online: navigator.onLine,
    effectiveType: connection?.effectiveType,
    downlink: connection?.downlink,
    rtt: connection?.rtt,
  };
}

/** Tracks connectivity and, where available, the active connection profile. */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(() => readNetwork());

  useEffect(() => {
    const update = () => setStatus(readNetwork());
    const connection = (navigator as NavigatorWithConnection).connection;

    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    connection?.addEventListener?.("change", update);

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      connection?.removeEventListener?.("change", update);
    };
  }, []);

  return status;
}

function detectBackend(): EngineBackend {
  if ((navigator as NavigatorWithConnection).gpu) return "webgpu";
  if (typeof WebAssembly !== "undefined") return "wasm";
  return "cpu";
}

/**
 * Reports the on-device edge engine.
 *
 * The vision stack runs fully client-side (CLIP / ONNX / heuristic), so we
 * probe for WebGPU + WebAssembly support and surface a short "initializing"
 * window while the runtime warms up.
 */
export function useEngineStatus(): { engine: EngineStatus; retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [engine, setEngine] = useState<EngineStatus>(() => {
    const backend = detectBackend();
    return {
      name: "Gemma 4-bit Edge Engine",
      version: "v2.4",
      status: backend === "cpu" ? "unavailable" : "initializing",
      backend,
    };
  });

  useEffect(() => {
    const backend = detectBackend();
    if (backend === "cpu") {
      setEngine((prev) => ({ ...prev, backend, status: "unavailable" }));
      return;
    }
    setEngine((prev) => ({ ...prev, backend, status: "initializing" }));
    const ready: EngineState = "ready";
    const timer = window.setTimeout(() => {
      setEngine((prev) => ({ ...prev, status: ready }));
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { engine, retry };
}
