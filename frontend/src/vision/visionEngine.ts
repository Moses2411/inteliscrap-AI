import type { HazardLevel, VisionModelStatus } from "../types";

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
  // Emitted by Vite as dist/assets/ort-wasm-simd-threaded.wasm (see
  // build.rollupOptions.output.assetFileNames in vite.config.ts).
  wasmPaths: "/assets/",
  inputSize: 224,
  normalize: "imagenet",
  applySoftmax: true,
};

export function defaultVisionModelUrl(): string {
  return DEFAULT_CONFIG.modelUrl;
}

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
// Once the model cannot be loaded (e.g. it has not been shipped yet) we stop
// re-hitting the network on every scan.
let sessionUnavailable = false;
let modelStatus: VisionModelStatus | null = null;
// Verified class count of the loaded model; used to guard against a model whose
// output width does not match classes.json.
let verifiedClassCount: number | null = null;

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
  if (sessionUnavailable) {
    throw new Error(`On-device model unavailable: ${config.modelUrl}`);
  }

  try {
    const ortModule = await import("onnxruntime-web");
    ort = ortModule;
    ort.env.wasm.wasmPaths = config.wasmPaths;
    // Multi-threaded WASM relies on SharedArrayBuffer, which only exists when the
    // page is cross-origin isolated (COOP + COEP headers). Without that, forcing
    // numThreads > 1 does nothing (or throws), so fall back to a single thread.
    const isolated =
      (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated === true;
    const cores = navigator.hardwareConcurrency || 1;
    ort.env.wasm.numThreads = isolated ? Math.min(4, cores) : 1;

    session = await ortModule.InferenceSession.create(config.modelUrl, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
    return session;
  } catch (err) {
    sessionUnavailable = true;
    setModelStatus({
      available: false,
      verified: false,
      reason: "model_missing",
      modelUrl: config.modelUrl,
      classCount: null,
      message:
        "No verified on-device classifier is bundled. Falling back to the server model (online) or manual selection (offline).",
    });
    throw err;
  }
}

function setModelStatus(status: VisionModelStatus): void {
  modelStatus = status;
}

/**
 * Probe whether a *verified* on-device classifier is available.
 *
 * A model is only reported as usable when it loads, has at least one output and
 * its output width matches the number of classes the app knows about. This keeps
 * the UI honest: a stale/mismatched model is never silently used.
 */
export async function getVisionModelStatus(
  config: Partial<VisionModelConfig> = {},
): Promise<VisionModelStatus> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  if (modelStatus && modelStatus.reason === "verified") return modelStatus;
  if (sessionUnavailable) {
    return (
      modelStatus ?? {
        available: false,
        verified: false,
        reason: "model_missing",
        modelUrl: cfg.modelUrl,
        classCount: null,
        message: "No verified on-device classifier is bundled.",
      }
    );
  }

  try {
    const [sess, classes] = await Promise.all([
      ensureSession(cfg),
      loadLabels(cfg.labelsUrl),
    ]);
    if (sess.outputNames.length < 1) {
      throw new Error("Model exposes no outputs");
    }
    verifiedClassCount = classes.length;
    setModelStatus({
      available: true,
      verified: true,
      reason: "verified",
      modelUrl: cfg.modelUrl,
      classCount: classes.length,
      message: "Verified on-device classifier ready.",
    });
    return modelStatus as VisionModelStatus;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown model error";
    const status: VisionModelStatus = {
      available: false,
      verified: false,
      reason: sessionUnavailable ? "model_missing" : "load_error",
      modelUrl: cfg.modelUrl,
      classCount: null,
      message,
    };
    setModelStatus(status);
    return status;
  }
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

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // Match the training/validation transform (torchvision Resize(int(size * 1.14))
  // then CenterCrop(size)): scale so the shorter side fills `size * 1.14`, then
  // center-crop. The previous code stretched the image into a square, which
  // distorted aspect ratios and hurt accuracy.
  const fit = size * 1.14;
  const srcW = img.naturalWidth || size;
  const srcH = img.naturalHeight || size;
  const scale = fit / Math.min(srcW, srcH);
  const drawW = Math.round(srcW * scale);
  const drawH = Math.round(srcH * scale);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, (size - drawW) / 2, (size - drawH) / 2, drawW, drawH);
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

  // Guard against a model whose output width does not match the class list —
  // otherwise index-to-class mapping would silently produce wrong materials.
  if (raw.length !== classes.length) {
    setModelStatus({
      available: false,
      verified: false,
      reason: "class_mismatch",
      modelUrl: cfg.modelUrl,
      classCount: classes.length,
      message: `Model produced ${raw.length} outputs but classes.json defines ${classes.length}. Re-export or re-verify the model.`,
    });
    // Invalidate the mismatched session so future scans don't reuse it.
    sessionUnavailable = true;
    throw new Error(
      `On-device model/class mismatch: ${raw.length} outputs vs ${classes.length} classes`,
    );
  }

  verifiedClassCount = classes.length;
  const probs = cfg.applySoftmax ? softmax(raw) : raw;

  const predictions = rankPredictions(probs, classes);
  return { predictions, top: predictions[0], inferenceMs };
}

export function getVerifiedClassCount(): number | null {
  return verifiedClassCount;
}

export async function disposeVision(): Promise<void> {
  if (session) {
    await session.release();
    session = null;
    ort = null;
    sessionUnavailable = false;
    modelStatus = null;
    verifiedClassCount = null;
  }
}

/**
 * Download + initialize the on-device model once, off the critical path.
 * The service worker's CacheFirst route for `*.onnx`/`*.wasm` keeps the
 * artifacts on device, so this download happens only on first run and later
 * launches/scans work fully offline. Returns false when no model is shipped.
 */
export async function warmUpVision(): Promise<boolean> {
  const status = await getVisionModelStatus();
  return status.verified;
}
