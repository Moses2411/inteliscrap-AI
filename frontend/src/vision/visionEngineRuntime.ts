import type { HazardLevel } from "../types";
import type { VisionPrediction, VisionResult } from "./visionEngine";

type ScorePair = { label: string; score: number };
type ZeroShotClassifier = (texts: string[], image: Blob) => Promise<ScorePair[]>;

export const RUNTIME_MODEL_ID = "Xenova/clip-vit-base-patch16";
export const RUNTIME_MIN_SCORE = 0.3;

interface ScrapPrompt {
  slug: string;
  material: string;
  hazardLevel: HazardLevel;
  prompt: string;
}

const SCRAP_PROMPTS: ScrapPrompt[] = [
  { slug: "copper", material: "Copper", hazardLevel: "low", prompt: "scrap copper, reddish-brown pipes or wires" },
  { slug: "aluminum", material: "Aluminum", hazardLevel: "low", prompt: "scrap aluminum, light silver grey metal" },
  { slug: "pet-plastic", material: "PET Plastic", hazardLevel: "low", prompt: "PET plastic bottle, clear plastic" },
  { slug: "lead-battery", material: "Lead-Acid Battery", hazardLevel: "critical", prompt: "lead-acid car battery" },
  { slug: "brass", material: "Brass", hazardLevel: "low", prompt: "brass metal fittings, yellow-gold metal" },
  { slug: "steel", material: "Steel", hazardLevel: "low", prompt: "steel or iron scrap metal" },
  { slug: "e-waste", material: "E-Waste Board", hazardLevel: "high", prompt: "electronic printed circuit board" },
  { slug: "glass", material: "Glass", hazardLevel: "medium", prompt: "glass bottle or broken glass" },
];

let classifierPromise: Promise<ZeroShotClassifier> | null = null;

function getClassifier(): Promise<ZeroShotClassifier> {
  if (!classifierPromise) {
    classifierPromise = (async () => {
      const { env: tjsEnv, pipeline: tjsPipeline } = await import("@huggingface/transformers");
      const wasm = tjsEnv.backends.onnx?.wasm;
      if (wasm) wasm.wasmPaths = "/ort-tjs/";
      return tjsPipeline("zero-shot-image-classification", RUNTIME_MODEL_ID, {
        dtype: "q8",
        device: "wasm",
      }) as unknown as ZeroShotClassifier;
    })();
    classifierPromise.catch(() => {
      classifierPromise = null;
    });
  }
  return classifierPromise;
}

export async function classifyScrapZeroShot(image: Blob): Promise<VisionResult> {
  const classifier = await getClassifier();
  const prompts = SCRAP_PROMPTS.map((p) => p.prompt);
  const byPrompt = new Map(SCRAP_PROMPTS.map((p) => [p.prompt, p]));

  const started = performance.now();
  const out = await classifier(prompts, image);
  const inferenceMs = performance.now() - started;

  const predictions: VisionPrediction[] = out
    .map(({ label, score }) => {
      const match = byPrompt.get(label);
      return {
        material: match ? match.material : label,
        materialSlug: match ? match.slug : "other",
        confidence: score,
        hazardLevel: match ? match.hazardLevel : ("low" as HazardLevel),
      };
    })
    .sort((a, b) => b.confidence - a.confidence);

  return { predictions, top: predictions[0], inferenceMs };
}