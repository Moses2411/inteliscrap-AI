import type { HazardLevel } from "../types";

export interface ScrapClass {
  label: string;
  slug: string;
  hazardLevel: HazardLevel;
}

export interface VisionPrediction {
  material: string;
  materialSlug: string;
  confidence: number;
  hazardLevel: HazardLevel;
}

export interface VisionResult {
  predictions: VisionPrediction[];
  top: VisionPrediction;
  inferenceMs: number;
}

export interface VisionModelConfig {
  modelUrl: string;
  labelsUrl: string;
  wasmPaths: string;
  inputSize: number;
  inputName?: string;
  outputName?: string;
  normalize: "unit" | "imagenet";
  applySoftmax: boolean;
}

type OrtModule = typeof import("onnxruntime-web");

const DEFAULT_CONFIG: VisionModelConfig = {
  modelUrl: "/models/mobilenetv4_scrap_int8.onnx",
  labelsUrl: "/models/classes.json",
  wasmPaths: "/ort/",
  inputSize: 224,
  normalize: "imagenet",
  applySoftmax: true,
};

const HAZARD_LEVELS: HazardLevel[] = ["low", "medium", "high", "critical"];

export const SCRAP_CLASSES: ScrapClass[] = [
  { label: "Copper", slug: "copper", hazardLevel: "low" },
  { label: "Aluminum", slug: "aluminum", hazardLevel: "low" },
  { label: "PET Plastic", slug: "pet-plastic", hazardLevel: "low" },
  { label: "Lead-Acid Battery", slug: "lead-battery", hazardLevel: "critical" },
  { label: "Brass", slug: "brass", hazardLevel: "low" },
  { label: "Steel", slug: "steel", hazardLevel: "low" },
  { label: "E-Waste Board", slug: "e-waste", hazardLevel: "high" },
  { label: "Glass", slug: "glass", hazardLevel: "medium" },
];

let session: import("onnxruntime-web").InferenceSession | null = null;
let ort: OrtModule | null = null;
let labelsCache: ScrapClass[] | null = null;

function toHazardLevel(value: unknown): HazardLevel {
  return HAZARD_LEVELS.includes(value as HazardLevel) ? (value as HazardLevel) : "low";
}

async function loadLabels(url: string): Promise<ScrapClass[]> {
  if (labelsCache) return labelsCache;

  try {
    const res = await fetch(url);
    if (res.ok) {
      const data: unknown = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        labelsCache = data.map((entry) => ({
          label: String((entry as Record<string, unknown>).label ?? "Unknown"),
          slug: String((entry as Record<string, unknown>).slug ?? "other"),
          hazardLevel: toHazardLevel((entry as Record<string, unknown>).hazardLevel),
        }));
        return labelsCache;
      }
    }
  } catch {
    // fall through to built-in labels
  }
  return SCRAP_CLASSES;
}

async function ensureSession(
  config: VisionModelConfig,
): Promise<import("onnxruntime-web").InferenceSession> {
  if (session) return session;

  ort = await import("onnxruntime-web");
  ort.env.wasm.wasmPaths = config.wasmPaths;
  ort.env.wasm.numThreads = 2;

  session = await ort.InferenceSession.create(config.modelUrl, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });
  return session;
}

async function toImage(source: Blob | HTMLImageElement): Promise<HTMLImageElement> {
  if (source instanceof HTMLImageElement) return source;

  const url = URL.createObjectURL(source);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function rasterize(
  source: Blob | HTMLImageElement,
  size: number,
): Promise<ImageData> {
  const img = await toImage(source);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.drawImage(img, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size);
}

function preprocess(
  imageData: ImageData,
  normalize: "unit" | "imagenet",
): Float32Array {
  const { data } = imageData;
  const pixels = data.length / 4;
  const chw = new Float32Array(3 * pixels);

  for (let i = 0; i < pixels; i += 1) {
    const r = data[i * 4] / 255;
    const g = data[i * 4 + 1] / 255;
    const b = data[i * 4 + 2] / 255;

    if (normalize === "imagenet") {
      chw[i] = (r - 0.485) / 0.229;
      chw[pixels + i] = (g - 0.456) / 0.224;
      chw[pixels * 2 + i] = (b - 0.406) / 0.225;
    } else {
      chw[i] = r;
      chw[pixels + i] = g;
      chw[pixels * 2 + i] = b;
    }
  }
  return chw;
}

function softmax(logits: number[]): number[] {
  const max = logits.reduce((a, b) => Math.max(a, b), -Infinity);
  const exps = logits.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

function rankPredictions(probs: number[], classes: ScrapClass[]): VisionPrediction[] {
  return probs
    .map((confidence, index) => ({ index, confidence }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)
    .map(({ index, confidence }) => {
      const cls = classes[index];
      if (cls) {
        return {
          material: cls.label,
          materialSlug: cls.slug,
          confidence,
          hazardLevel: cls.hazardLevel,
        };
      }
      return {
        material: "Unknown",
        materialSlug: "other",
        confidence,
        hazardLevel: "low" as HazardLevel,
      };
    });
}

export async function classifyScrap(
  source: Blob | HTMLImageElement,
  config: Partial<VisionModelConfig> = {},
): Promise<VisionResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const [sess, classes] = await Promise.all([
    ensureSession(cfg),
    loadLabels(cfg.labelsUrl),
  ]);

  const inputName = cfg.inputName ?? sess.inputNames[0];
  const outputName = cfg.outputName ?? sess.outputNames[0];

  const imageData = await rasterize(source, cfg.inputSize);
  const input = preprocess(imageData, cfg.normalize);

  if (!ort) throw new Error("ONNX Runtime failed to initialize");
  const tensor = new ort.Tensor("float32", input, [1, 3, cfg.inputSize, cfg.inputSize]);

  const started = performance.now();
  const outputs = await sess.run({ [inputName]: tensor });
  const inferenceMs = performance.now() - started;

  const raw = Array.from(outputs[outputName].data as ArrayLike<number>);
  const probs = cfg.applySoftmax ? softmax(raw) : raw;

  const predictions = rankPredictions(probs, classes);
  return { predictions, top: predictions[0], inferenceMs };
}

export async function disposeVision(): Promise<void> {
  if (session) {
    await session.release();
    session = null;
    ort = null;
  }
}
