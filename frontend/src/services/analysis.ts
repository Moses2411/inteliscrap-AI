import type { VisionAnalysis, VisionCandidate, VisionModelStatus } from "../types";
import {
  classifyScrap,
  getVisionModelStatus,
  isVisionModelReady,
  waitForVisionSession,
} from "../vision/visionEngine";
import { assessUncertainty } from "../vision/uncertainty";
import { resolveTradeRule } from "./language";

// How long a scan will wait for an *already in-flight* model load before giving
// up and using the fast local heuristic. It never starts a fresh download here.
const DEVICE_MODEL_WAIT_MS = 2_500;
// Hard cap on the server round trip so a slow/dead network can never make a scan
// hang. The image is downscaled first, so a healthy server answers well within this.
const SERVER_TIMEOUT_MS = 6_000;
// Longest side of the image uploaded to the server. The model only ever sees
// 224px, so shipping a full-resolution frame wastes bandwidth and time.
const MAX_UPLOAD_SIDE = 1024;

export type { VisionModelStatus };

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

/**
 * Downscale the captured photo before uploading it to the server. A phone camera
 * produces a multi-megabyte frame; sending it as base64 over a mobile network is
 * the single biggest cause of a slow scan. The model only uses 224px, so this
 * costs nothing in accuracy and makes the round trip dramatically smaller.
 */
async function compactImageBlob(blob: Blob): Promise<Blob> {
  try {
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const w = img.naturalWidth || 0;
      const h = img.naturalHeight || 0;
      const maxSide = Math.max(w, h);
      if (maxSide === 0) return blob;
      const scale = Math.min(1, MAX_UPLOAD_SIDE / maxSide);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return blob;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const out = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8),
      );
      return out ?? blob;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return blob;
  }
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

/** Canonical slugs the server is allowed to return (see backend CANONICAL_MATERIALS). */
const KNOWN_SERVER_SLUGS = new Set([
  "copper",
  "aluminum",
  "pet-plastic",
  "lead-battery",
  "brass",
  "steel",
  "e-waste",
  "glass",
]);

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
  candidates?: VisionCandidate[],
): VisionAnalysis {
  const rule = resolveTradeRule(slug);
  const normalizedConfidence = clamp01(Number(confidence) || 0);
  const candidateList: VisionCandidate[] =
    candidates && candidates.length > 0
      ? candidates
      : [{ material_class: material || rule.material, material_slug: rule.slug, confidence: normalizedConfidence }];

  const assessment = assessUncertainty(candidateList, source);
  return {
    material_class: material || rule.material,
    material_slug: rule.slug,
    confidence: normalizedConfidence,
    toxicity_hazards: serverHazards && serverHazards.length > 0 ? serverHazards : rule.hazards,
    safety_instructions: serverSafety || rule.safety,
    hazard_level: rule.hazardLevel,
    source,
    // Only offer a confirm step (and candidates) when we are genuinely unsure.
    uncertain: assessment.uncertain,
    candidates: assessment.uncertain ? candidateList.slice(0, 3) : undefined,
  };
}

async function classifyOnDevice(blob: Blob): Promise<VisionAnalysis> {
  // Only use the on-device model when it is already loaded, or will be within a
  // short window. This keeps a scan snappy even if the one-time download is still
  // running in the background — the model simply becomes available next scan.
  if (!isVisionModelReady() && !(await waitForVisionSession(DEVICE_MODEL_WAIT_MS))) {
    throw new Error("On-device model not ready");
  }
  const result = await classifyScrap(blob);
  const top = result.top;
  const candidates: VisionCandidate[] = result.predictions.slice(0, 3).map((prediction) => ({
    material_class: prediction.material,
    material_slug: prediction.materialSlug,
    confidence: prediction.confidence,
  }));
  return buildAnalysis(top.material, top.materialSlug, top.confidence, "onnx", undefined, undefined, candidates);
}

async function classifyOnServer(blob: Blob): Promise<VisionAnalysis> {
  const compact = await compactImageBlob(blob);
  const imageBase64 = await blobToBase64(compact);
  const res = await fetch(`${API_BASE}/api/v1/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_base64: imageBase64 }),
    signal: AbortSignal.timeout(SERVER_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Analyze failed: ${res.statusText}`);
  const data: {
    material_class?: string;
    material_slug?: string;
    confidence?: number;
    toxicity_hazards?: string[];
    safety_instructions?: string;
  } = await res.json();
  const material = data.material_class || "Unknown";
  // The hardened server returns a validated slug; fall back to label matching for
  // older server builds that only return a display label.
  const slug = data.material_slug && KNOWN_SERVER_SLUGS.has(data.material_slug)
    ? data.material_slug
    : slugFromServerLabel(material);
  const confidence = Number(data.confidence ?? 0);
  const rule = resolveTradeRule(slug);
  const candidates: VisionCandidate[] = [
    { material_class: material || rule.material, material_slug: rule.slug, confidence },
  ];
  return buildAnalysis(
    material,
    slug,
    confidence,
    "server",
    data.toxicity_hazards,
    data.safety_instructions,
    candidates,
  );
}

async function heuristicAnalysis(image: Blob): Promise<VisionAnalysis | null> {
  try {
    const heuristic = await classifyHeuristicInline(image);
    if (!heuristic.top || heuristic.top.confidence <= 0.2) return null;
    const candidates: VisionCandidate[] = heuristic.preds.slice(0, 3).map((prediction) => ({
      material_class: prediction.material,
      material_slug: prediction.slug,
      confidence: prediction.confidence,
    }));
    return buildAnalysis(
      heuristic.top.material,
      heuristic.top.slug,
      heuristic.top.confidence,
      "heuristic",
      undefined,
      undefined,
      candidates,
    );
  } catch (err) {
    console.warn("heuristic failed", err);
    return null;
  }
}

/**
 * On-device INT8 classifier first (small, fast, fully offline — downloaded once
 * and cached by the service worker), then the server model when online, then the
 * lightweight on-device heuristic. No large remote model is ever fetched here.
 *
 * Each source is scored for confidence. A source is only returned as a firm
 * answer when it is confident enough; otherwise the next source is tried and, if
 * none is confident, the best available answer is returned flagged `uncertain`
 * with its top candidates so the UI can ask the user to confirm.
 *
 * Latency is bounded on purpose: the on-device model is used only once warm, the
 * server call is capped by a short timeout, and the (instant) heuristic is
 * computed in parallel so the user never waits on a slow network for a result.
 */
export async function analyzeScrapImage(image: Blob): Promise<VisionAnalysis> {
  const attempts: VisionAnalysis[] = [];

  // 1) Bundled on-device model (small, fast, fully offline).
  try {
    const edge = await classifyOnDevice(image);
    if (edge.material_slug !== "other") {
      if (!edge.uncertain) return edge;
      attempts.push(edge);
    }
  } catch {
    // Model not downloaded yet, unverified or inference failed; fall through.
  }

  // Start the cheap on-device heuristic now so it is ready the moment the
  // network path gives up (or is skipped), instead of only running after a slow
  // server timeout.
  const heuristicPromise = heuristicAnalysis(image);

  // 2) Server model when online — it may resolve an on-device ambiguity. Bounded
  //    by a short timeout (and a downscaled image) so it can't stall the scan.
  if (navigator.onLine) {
    try {
      const server = await classifyOnServer(image);
      if (server.material_slug !== "other") {
        if (!server.uncertain) return server;
        attempts.push(server);
      }
    } catch {
      // Server unreachable, slow or model offline; fall through to the heuristic.
    }
  }

  // 3) Lightweight heuristic (real analysis, works offline, very fast for low-end
  //    phones). It is clearly labelled "heuristic" so it is never passed off as a
  //    trained model inference, and its uncalibrated scores are held to a
  //    stricter confidence bar.
  const heuristic = await heuristicPromise;
  if (heuristic) {
    if (!heuristic.uncertain) return heuristic;
    attempts.push(heuristic);
  }

  // Nothing was confident: return the best available answer, flagged uncertain,
  // so the UI asks the user to confirm rather than trading on a silent guess.
  if (attempts.length > 0) return attempts[0];

  throw new AnalysisUnavailableError();
}

/** Report the honest availability of the on-device classifier. */
export async function getEdgeModelStatus(): Promise<VisionModelStatus> {
  return getVisionModelStatus();
}