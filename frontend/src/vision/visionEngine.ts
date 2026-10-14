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

/** Progress of the one-time on-device model download. */
export interface VisionLoadProgress {
  loadedBytes: number;
  totalBytes: number;
  /** 0..1 (best effort — browsers do not always expose content-length). */
  fraction: number;
}

export type VisionProgressHandler = (progress: VisionLoadProgress) => void;
export type VisionStatusListener = (status: VisionModelStatus) => void;

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
// Set only for a *permanent* failure (the model is genuinely not shipped, or its
// output width does not match classes.json). A transient network failure must
// never set this, so the model is retried on the next launch / reconnect — that
// is what lets "download once, then scan offline forever" actually work.
let sessionUnavailable = false;
let modelStatus: VisionModelStatus | null = null;
// Verified class count of the loaded model; used to guard against a model whose
// output width does not match classes.json.
let verifiedClassCount: number | null = null;
// A single in-flight load, shared by the startup warm-up and any early scan so
// they never race into two downloads / two WASM sessions.
let sessionPromise: Promise<import("onnxruntime-web").InferenceSession> | null = null;
let primed = false;

const statusListeners = new Set<VisionStatusListener>();

/** Error flagged when the model is definitively absent (HTTP 404) — do not retry. */
class PermanentModelError extends Error {}

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

/**
 * Download the model bytes ourselves (rather than letting onnxruntime fetch the
 * URL) so we can (a) report progress, (b) tell a permanent 404 apart from a
 * transient network failure, and (c) stream without buffering twice. The service
 * worker's CacheFirst route for `*.onnx` caches the response, so this runs only
 * on the very first launch that has connectivity.
 */
async function fetchModelBytes(url: string, onProgress?: VisionProgressHandler): Promise<Uint8Array> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    // Offline, DNS failure, connection reset — retryable on a later launch.
    throw new Error(`Model download failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (res.status === 404) {
    throw new PermanentModelError(`Model not found: ${url}`);
  }
  if (!res.ok) {
    throw new Error(`Model download failed: HTTP ${res.status}`);
  }

  const total = Number(res.headers.get("content-length") ?? 0);
  if (!res.body || !onProgress) {
    const buf = new Uint8Array(await res.arrayBuffer());
    onProgress?.({ loadedBytes: buf.length, totalBytes: total || buf.length, fraction: 1 });
    return buf;
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.length;
      onProgress({
        loadedBytes: loaded,
        totalBytes: total || loaded,
        fraction: total ? Math.min(1, loaded / total) : 0,
      });
    }
  }
  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

async function ensureSession(
  config: VisionModelConfig,
  onProgress?: VisionProgressHandler,
): Promise<import("onnxruntime-web").InferenceSession> {
  if (session) return session;
  if (sessionUnavailable) {
    throw new Error(`On-device model unavailable: ${config.modelUrl}`);
  }
  if (sessionPromise) return sessionPromise;

  sessionPromise = (async () => {
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

    const bytes = await fetchModelBytes(config.modelUrl, onProgress);
    return ortModule.InferenceSession.create(bytes, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
  })();

  try {
    session = await sessionPromise;
    return session;
  } catch (err) {
    // Always clear the in-flight promise so a later call can retry. Only a truly
    // absent model is latched as permanently unavailable.
    sessionPromise = null;
    if (err instanceof PermanentModelError) {
      sessionUnavailable = true;
      setModelStatus({
        available: false,
        verified: false,
        reason: "model_missing",
        modelUrl: config.modelUrl,
        classCount: null,
        message:
          "No on-device classifier is bundled. Connect once to download it, or pick the material manually.",
      });
    } else {
      setModelStatus({
        available: false,
        verified: false,
        reason: "load_error",
        modelUrl: config.modelUrl,
        classCount: null,
        message: "The on-device model could not be downloaded yet — retrying when online.",
      });
    }
    throw err;
  }
}

function setModelStatus(status: VisionModelStatus): void {
  modelStatus = status;
  for (const listener of statusListeners) {
    try {
      listener(status);
    } catch {
      // a listener must never break model loading
    }
  }
}

/** Subscribe to on-device model readiness changes (fires once immediately). */
export function subscribeVisionStatus(listener: VisionStatusListener): () => void {
  statusListeners.add(listener);
  if (modelStatus) listener(modelStatus);
  return () => {
    statusListeners.delete(listener);
  };
}

/** True once the model is loaded and ready for instant, offline inference. */
export function isVisionModelReady(): boolean {
  return session !== null;
}

/** True while the one-time model download/init is in flight. */
export function isVisionModelLoading(): boolean {
  return sessionPromise !== null;
}

/**
 * Wait up to `timeoutMs` for an *already started* model load to finish. Returns
 * false immediately when no load is in flight, so a scan never triggers a fresh
 * multi-megabyte download on its critical path.
 */
export function waitForVisionSession(timeoutMs: number): Promise<boolean> {
  if (session) return Promise.resolve(true);
  const pending = sessionPromise;
  if (!pending) return Promise.resolve(false);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(session !== null), timeoutMs);
    pending.then(
      () => {
        clearTimeout(timer);
        resolve(true);
      },
      () => {
        clearTimeout(timer);
        resolve(false);
      },
    );
  });
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
  onProgress?: VisionProgressHandler,
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
        message: "No on-device classifier is bundled.",
      }
    );
  }

  try {
    const [sess, classes] = await Promise.all([
      ensureSession(cfg, onProgress),
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

/**
 * Run a throwaway inference so the WASM kernels are compiled before the user's
 * first real scan. Without this, the very first scan pays the JIT/compile cost
 * and feels slow even though the model is already loaded.
 */
async function primeSession(
  sess: import("onnxruntime-web").InferenceSession,
  config: VisionModelConfig,
): Promise<void> {
  if (!ort || primed) return;
  try {
    const size = config.inputSize;
    const inputName = config.inputName ?? sess.inputNames[0];
    if (!inputName) return;
    const zeros = new Float32Array(3 * size * size);
    const tensor = new ort.Tensor("float32", zeros, [1, 3, size, size]);
    await sess.run({ [inputName]: tensor });
    primed = true;
  } catch {
    // Warm-up is best-effort; a failure must never break model loading.
  }
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
    sessionPromise = null;
    sessionUnavailable = false;
    modelStatus = null;
    verifiedClassCount = null;
    primed = false;
  }
}

/**
 * Download + initialize the on-device model once, off the critical path.
 * The service worker's CacheFirst route for `*.onnx`/`*.wasm` keeps the
 * artifacts on device, so this download happens only on the first launch that
 * has connectivity; later launches and every scan work fully offline. Returns
 * false when no model is shipped.
 */
export async function warmUpVision(onProgress?: VisionProgressHandler): Promise<boolean> {
  const status = await getVisionModelStatus({}, onProgress);
  if (status.verified && session) {
    await primeSession(session, DEFAULT_CONFIG);
  }
  return status.verified;
}
