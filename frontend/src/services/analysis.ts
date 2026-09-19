import type { VisionAnalysis } from "../types";
import { classifyScrap } from "../vision/visionEngine";
import { classifyScrapZeroShot, RUNTIME_MIN_SCORE } from "../vision/visionEngineRuntime";
import { resolveTradeRule } from "./language";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export class AnalysisUnavailableError extends Error {
  constructor() {
    super("AI model is not available offline. Pick the material manually.");
    this.name = "AnalysisUnavailableError";
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === "string") {
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      } else {
        reject(new Error("Failed to read image"));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read image"));
    reader.readAsDataURL(blob);
  });
}

const SERVER_SLUG_ALIASES: Record<string, string> = {
  copper: "copper",
  aluminum: "aluminum",
  aluminium: "aluminum",
  "pet plastic": "pet-plastic",
  "lead-acid battery": "lead-battery",
  "lead acid battery": "lead-battery",
  brass: "brass",
  steel: "steel",
  "stainless steel": "steel",
  "e-waste board": "e-waste",
  glass: "glass",
  "hdpe plastic": "pet-plastic",
  "ldpe plastic": "pet-plastic",
  polypropylene: "pet-plastic",
  pvc: "pet-plastic",
};

function slugFromServerLabel(raw: string): string {
  const key = raw.trim().toLowerCase();
  if (SERVER_SLUG_ALIASES[key]) return SERVER_SLUG_ALIASES[key];

  for (const [alias, slug] of Object.entries(SERVER_SLUG_ALIASES)) {
    if (key.includes(alias)) return slug;
  }
  return "other";
}

function buildAnalysis(
  material: string,
  slug: string,
  confidence: number,
  source: VisionAnalysis["source"],
  serverHazards?: string[],
  serverSafety?: string,
): VisionAnalysis {
  const rule = resolveTradeRule(slug);
  return {
    material_class: material || rule.material,
    material_slug: rule.slug,
    confidence,
    toxicity_hazards: serverHazards && serverHazards.length > 0 ? serverHazards : rule.hazards,
    safety_instructions: serverSafety || rule.safety,
    hazard_level: rule.hazardLevel,
    source,
  };
}

async function classifyOnDevice(blob: Blob): Promise<VisionAnalysis> {
  const result = await classifyScrap(blob);
  const top = result.top;
  return buildAnalysis(top.material, top.materialSlug, top.confidence, "onnx");
}

async function classifyOnServer(blob: Blob): Promise<VisionAnalysis> {
  const imageBase64 = await blobToBase64(blob);
  const res = await fetch(`${API_BASE}/api/v1/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_base64: imageBase64 }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`Analyze failed: ${res.statusText}`);
  const data: { material_class?: string; confidence?: number; toxicity_hazards?: string[]; safety_instructions?: string } =
    await res.json();
  const slug = slugFromServerLabel(data.material_class || "");
  return buildAnalysis(
    data.material_class || "Unknown",
    slug,
    Number(data.confidence ?? 0),
    "server",
    data.toxicity_hazards,
    data.safety_instructions,
  );
}

/** Run a real analysis: bundled ONNX classifier first, server vision model when online,
 *  then an on-device runtime model (transformers.js) when offline, and finally surface
 *  a manual selection when no model answers. Never fabricates results. */
export async function analyzeScrapImage(image: Blob): Promise<VisionAnalysis> {
  try {
    const edge = await classifyOnDevice(image);
    if (edge.material_slug !== "other") return edge;
  } catch {
    // model file missing or inference failed — fall through to server
  }

  if (navigator.onLine) {
    try {
      return await classifyOnServer(image);
    } catch {
      // server unreachable or model offline — fall through
    }
  }

  try {
    const runtime = await classifyScrapZeroShot(image);
    if (
      runtime.top &&
      runtime.top.materialSlug !== "other" &&
      runtime.top.confidence >= RUNTIME_MIN_SCORE
    ) {
      return buildAnalysis(
        runtime.top.material,
        runtime.top.materialSlug,
        runtime.top.confidence,
        "onnx",
      );
    }
  } catch {
    // runtime model failed to download or run — fall through to manual
  }

  throw new AnalysisUnavailableError();
}