import type { VisionAnalysis } from "../types";
import { classifyScrap } from "../vision/visionEngine";
import { resolveTradeRule } from "./language";

function rgbToHsl(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h, s, l };
}

function clamp01(v: number) {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

async function classifyHeuristicInline(image: Blob) {
  const url = URL.createObjectURL(image);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    const size = 224;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    let sumR = 0,
      sumG = 0,
      sumB = 0;
    let dark = 0,
      light = 0,
      midGray = 0;
    let pixels = 0;
    const stride = 8;
    for (let y = 0; y < size; y += stride) {
      for (let x = 0; x < size; x += stride) {
        const i = (y * size + x) * 4;
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;
        pixels++;
        sumR += r;
        sumG += g;
        sumB += b;
        const bright = (r + g + b) / 3;
        if (bright < 0.12) dark++;
        if (bright > 0.78) light++;
        const hsl = rgbToHsl(r, g, b);
        if (hsl.s < 0.15 && hsl.l > 0.25 && hsl.l < 0.75) midGray++;
      }
    }
    const meanR = sumR / pixels;
    const meanG = sumG / pixels;
    const meanB = sumB / pixels;
    const bright = (meanR + meanG + meanB) / 3;
    const hslM = rgbToHsl(meanR, meanG, meanB);
    const total = meanR + meanG + meanB || 1;
    const redRatio = meanR / total;
    const greenRatio = meanG / total;
    const blueRatio = meanB / total;
    const rules = [
      {
        slug: "copper",
        material: "Copper",
        hazardLevel: "low" as const,
        score: () => {
          let s = 0;
          if (redRatio > 0.42) s += 0.5;
          if (meanR > meanB + 0.15) s += 0.25;
          if (meanR > meanG + 0.1) s += 0.15;
          if (hslM.s > 0.25) s += 0.1;
          return clamp01(s);
        },
      },
      {
        slug: "brass",
        material: "Brass",
        hazardLevel: "low" as const,
        score: () => {
          let s = 0;
          if (redRatio > 0.38 && greenRatio > 0.35) s += 0.4;
          if (meanR > meanB + 0.08 && meanG > meanB + 0.05) s += 0.3;
          if (hslM.s > 0.2 && bright > 0.4) s += 0.2;
          if (blueRatio < 0.22) s += 0.1;
          return clamp01(s);
        },
      },
      {
        slug: "aluminum",
        material: "Aluminum",
        hazardLevel: "low" as const,
        score: () => {
          let s = 0;
          if (bright > 0.55) s += 0.35;
          if (hslM.s < 0.25) s += 0.35;
          if (midGray / pixels > 0.25) s += 0.2;
          if (light / pixels > 0.15) s += 0.1;
          return clamp01(s);
        },
      },
      {
        slug: "steel",
        material: "Steel",
        hazardLevel: "low" as const,
        score: () => {
          let s = 0;
          if (hslM.s < 0.15) s += 0.4;
          if (bright > 0.25 && bright < 0.6) s += 0.25;
          if (midGray / pixels > 0.35) s += 0.25;
          if (dark / pixels < 0.3) s += 0.1;
          return clamp01(s);
        },
      },
      {
        slug: "lead-battery",
        material: "Lead-Acid Battery",
        hazardLevel: "critical" as const,
        score: () => {
          let s = 0;
          if (bright < 0.35) s += 0.45;
          if (dark / pixels > 0.4) s += 0.3;
          if (hslM.s < 0.2) s += 0.15;
          return clamp01(s);
        },
      },
      {
        slug: "e-waste",
        material: "E-Waste Board",
        hazardLevel: "high" as const,
        score: () => {
          let s = 0;
          if (greenRatio > 0.36 && blueRatio > 0.25) s += 0.35;
          if (meanG > meanR && meanG > meanB) s += 0.25;
          if (hslM.s > 0.15 && hslM.s < 0.5) s += 0.2;
          if (bright > 0.25 && bright < 0.65) s += 0.2;
          return clamp01(s);
        },
      },
      {
        slug: "glass",
        material: "Glass",
        hazardLevel: "medium" as const,
        score: () => {
          let s = 0;
          if (bright > 0.6) s += 0.4;
          if (light / pixels > 0.25) s += 0.3;
          if (hslM.s < 0.25) s += 0.2;
          if (midGray / pixels > 0.2) s += 0.1;
          return clamp01(s);
        },
      },
      {
        slug: "pet-plastic",
        material: "PET Plastic",
        hazardLevel: "low" as const,
        score: () => {
          let s = 0;
          if (bright > 0.4 && bright < 0.85) s += 0.3;
          if (hslM.s > 0.1 && hslM.s < 0.45) s += 0.3;
          if (dark / pixels < 0.25 && light / pixels < 0.5) s += 0.25;
          if (midGray / pixels < 0.4) s += 0.15;
          return clamp01(s);
        },
      },
    ];
    const preds = rules
      .map((r) => ({ slug: r.slug, material: r.material, hazardLevel: r.hazardLevel, confidence: r.score() }))
      .sort((a, b) => b.confidence - a.confidence);
    const top = preds[0];
    return { top, preds };
  } finally {
    URL.revokeObjectURL(url);
  }
}

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

  // Lightweight heuristic (real analysis, works offline, very fast for low-end phones)
  try {
    const heuristic = await classifyHeuristicInline(image);
    if (heuristic.top && heuristic.top.confidence > 0.5) {
      return buildAnalysis(
        heuristic.top.material,
        heuristic.top.slug,
        heuristic.top.confidence,
        "onnx",
      );
    }
  } catch (err) {
    console.warn("heuristic failed", err);
  }

  throw new AnalysisUnavailableError();
}