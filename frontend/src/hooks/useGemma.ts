// Member 3 — Edge AI Integration
// Dual-mode: tries WebLLM in-browser first, falls back to Ollama proxy

import { useState, useCallback, useRef } from "react";
import type { GemmaAnalysis } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const MODEL_ID = "gemma-2-2b-it-q4f16_1-MLC-1k";
const WEBLLM_TIMEOUT = 15_000;

function convertBlobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function tryWebLLM(imageBase64: string): Promise<GemmaAnalysis | null> {
  try {
    const { CreateWebWorkerMLCEngine } = await import("@mlc-ai/web-llm");

    const engine = await CreateWebWorkerMLCEngine(
      new Worker(new URL("./gemmaWorker.ts", import.meta.url), { type: "module" }),
      MODEL_ID,
      { initProgressCallback: () => {} },
    );

    const response = await engine.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a scrap material expert. Return JSON with fields: material_class, confidence, toxicity_hazards (array), safety_instructions (string). JSON only.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Classify this scrap material." },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 512,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as GemmaAnalysis;
  } catch {
    return null;
  }
}

async function tryOllama(imageBase64: string): Promise<GemmaAnalysis> {
  const response = await fetch(`${API_BASE}/api/v1/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_base64: imageBase64 }),
  });

  if (!response.ok) throw new Error(`Ollama proxy failed: ${response.statusText}`);
  return response.json();
}

export function useGemma() {
  const [loading_progress, setLoadingProgress] = useState(0);
  const [is_ready] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const engineMode = useRef<"webllm" | "ollama" | null>(null);

  const initModel = useCallback(async () => {}, []);

  const analyzeScrapImage = useCallback(async (imageBlob: Blob): Promise<GemmaAnalysis> => {
    setLoadingProgress(5);
    const b64 = await convertBlobToBase64(imageBlob);
    setLoadingProgress(20);

    // If we already know WebLLM works, skip the probe
    if (engineMode.current === null) {
      setLoadingProgress(30);
      const result = await tryWebLLM(b64);
      if (result) {
        engineMode.current = "webllm";
        setLoadingProgress(100);
        return result;
      }
      engineMode.current = "ollama";
    }

    if (engineMode.current === "webllm") {
      const result = await tryWebLLM(b64);
      if (result) {
        setLoadingProgress(100);
        return result;
      }
      // WebLLM model may have been evicted — fall through to Ollama
    }

    setLoadingProgress(50);
    const result = await tryOllama(b64);
    setLoadingProgress(100);
    return result;
  }, []);

  return { analyzeScrapImage, initModel, is_ready, loading_progress, error };
}
