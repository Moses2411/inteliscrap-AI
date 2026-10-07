import type { HazardLevel } from "../types";
import type { VisionPrediction, VisionResult } from "./visionEngine";

export interface HeuristicConfig {
  sampleStride: number;
  minConfidence: number;
}

const DEFAULT_CONFIG: HeuristicConfig = {
  sampleStride: 8, // sample every 8th pixel for speed on low-end devices
  minConfidence: 0.55,
};

const HAZARD_LEVELS: HazardLevel[] = ["low", "medium", "high", "critical"];

export interface ScrapHeuristicRule {
  slug: string;
  material: string;
  hazardLevel: HazardLevel;
  score: (stats: ImageStats) => number;
}

export interface ImageStats {
  width: number;
  height: number;
  pixels: number;
  meanR: number;
  meanG: number;
  meanB: number;
  brightness: number;
  saturation: number;
  redRatio: number;
  greenRatio: number;
  blueRatio: number;
  darkRatio: number; // pixels with brightness < 30
  lightRatio: number; // pixels with brightness > 200
  midGrayRatio: number; // neutral-ish pixels
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
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

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function toHazardLevel(value: unknown): HazardLevel {
  return HAZARD_LEVELS.includes(value as HazardLevel) ? (value as HazardLevel) : "low";
}

async function rasterizeToStats(blob: Blob, stride: number): Promise<ImageStats> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();

    const canvas = document.createElement("canvas");
    const size = 256; // small fixed size for speed
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas not available");

    ctx.drawImage(img, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const { data, width, height } = imageData;

    let sumR = 0,
      sumG = 0,
      sumB = 0;
    let dark = 0,
      light = 0,
      midGray = 0;
    let pixels = 0;

    for (let y = 0; y < height; y += stride) {
      for (let x = 0; x < width; x += stride) {
        const i = (y * width + x) * 4;
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;
        pixels++;

        sumR += r;
        sumG += g;
        sumB += b;

        const brightness = (r + g + b) / 3;
        if (brightness < 0.12) dark++;
        if (brightness > 0.78) light++;
        // mid-gray if low saturation and mid brightness
        const { s, l } = rgbToHsl(r, g, b);
        if (s < 0.15 && l > 0.25 && l < 0.75) midGray++;
      }
    }

    const meanR = pixels > 0 ? sumR / pixels : 0;
    const meanG = pixels > 0 ? sumG / pixels : 0;
    const meanB = pixels > 0 ? sumB / pixels : 0;

    const brightness = (meanR + meanG + meanB) / 3;
    const { s: saturation } = rgbToHsl(meanR, meanG, meanB);

    const total = meanR + meanG + meanB || 1;
    const redRatio = meanR / total;
    const greenRatio = meanG / total;
    const blueRatio = meanB / total;

    return {
      width,
      height,
      pixels,
      meanR,
      meanG,
      meanB,
      brightness,
      saturation,
      redRatio,
      greenRatio,
      blueRatio,
      darkRatio: pixels > 0 ? dark / pixels : 0,
      lightRatio: pixels > 0 ? light / pixels : 0,
      midGrayRatio: pixels > 0 ? midGray / pixels : 0,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Heuristic rules for common scrap materials (lightweight, fast)
const HEURISTIC_RULES: ScrapHeuristicRule[] = [
  {
    slug: "copper",
    material: "Copper",
    hazardLevel: "low",
    score: (s) => {
      // Copper is reddish/orange - high red, low blue/green
      let score = 0;
      if (s.redRatio > 0.42) score += 0.5;
      if (s.meanR > s.meanB + 0.15) score += 0.25;
      if (s.meanR > s.meanG + 0.1) score += 0.15;
      if (s.saturation > 0.25) score += 0.1;
      return clamp01(score);
    },
  },
  {
    slug: "brass",
    material: "Brass",
    hazardLevel: "low",
    score: (s) => {
      // Brass is yellow-gold
      let score = 0;
      if (s.redRatio > 0.38 && s.greenRatio > 0.35) score += 0.4;
      if (s.meanR > s.meanB + 0.08 && s.meanG > s.meanB + 0.05) score += 0.3;
      if (s.saturation > 0.2 && s.brightness > 0.4) score += 0.2;
      if (s.blueRatio < 0.22) score += 0.1;
      return clamp01(score);
    },
  },
  {
    slug: "aluminum",
    material: "Aluminum",
    hazardLevel: "low",
    score: (s) => {
      // Aluminum is silvery - bright, low saturation, neutral
      let score = 0;
      if (s.brightness > 0.55) score += 0.35;
      if (s.saturation < 0.25) score += 0.35;
      if (s.midGrayRatio > 0.25) score += 0.2;
      if (s.lightRatio > 0.15) score += 0.1;
      return clamp01(score);
    },
  },
  {
    slug: "steel",
    material: "Steel",
    hazardLevel: "low",
    score: (s) => {
      // Steel/iron is dark gray
      let score = 0;
      if (s.saturation < 0.15) score += 0.4;
      if (s.brightness > 0.25 && s.brightness < 0.6) score += 0.25;
      if (s.midGrayRatio > 0.35) score += 0.25;
      if (s.darkRatio < 0.3) score += 0.1;
      return clamp01(score);
    },
  },
  {
    slug: "lead-battery",
    material: "Lead-Acid Battery",
    hazardLevel: "critical",
    score: (s) => {
      // Lead-acid batteries are typically dark/black boxes
      let score = 0;
      if (s.brightness < 0.35) score += 0.45;
      if (s.darkRatio > 0.4) score += 0.3;
      if (s.saturation < 0.2) score += 0.15;
      if (s.meanR < 0.4 && s.meanG < 0.4 && s.meanB < 0.4) score += 0.1;
      return clamp01(score);
    },
  },
  {
    slug: "e-waste",
    material: "E-Waste Board",
    hazardLevel: "high",
    score: (s) => {
      // PCBs often have greenish tint + mixed colors
      let score = 0;
      if (s.greenRatio > 0.36 && s.blueRatio > 0.25) score += 0.35;
      if (s.meanG > s.meanR && s.meanG > s.meanB) score += 0.25;
      if (s.saturation > 0.15 && s.saturation < 0.5) score += 0.2;
      if (s.brightness > 0.25 && s.brightness < 0.65) score += 0.2;
      return clamp01(score);
    },
  },
  {
    slug: "glass",
    material: "Glass",
    hazardLevel: "medium",
    score: (s) => {
      // Glass is often clear/light/translucent
      let score = 0;
      if (s.brightness > 0.6) score += 0.4;
      if (s.lightRatio > 0.25) score += 0.3;
      if (s.saturation < 0.25) score += 0.2;
      if (s.midGrayRatio > 0.2) score += 0.1;
      return clamp01(score);
    },
  },
  {
    slug: "pet-plastic",
    material: "PET Plastic",
    hazardLevel: "low",
    score: (s) => {
      // Plastic varies but often has moderate brightness, some saturation
      let score = 0;
      if (s.brightness > 0.4 && s.brightness < 0.85) score += 0.3;
      if (s.saturation > 0.1 && s.saturation < 0.45) score += 0.3;
      if (s.darkRatio < 0.25 && s.lightRatio < 0.5) score += 0.25;
      if (s.midGrayRatio < 0.4) score += 0.15;
      return clamp01(score);
    },
  },
];

export async function classifyScrapHeuristic(
  blob: Blob,
  config: Partial<HeuristicConfig> = {},
): Promise<VisionResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const started = performance.now();

  const stats = await rasterizeToStats(blob, cfg.sampleStride);

  const predictions: VisionPrediction[] = HEURISTIC_RULES.map((rule) => {
    const confidence = rule.score(stats);
    return {
      material: rule.material,
      materialSlug: rule.slug,
      confidence: clamp01(confidence),
      hazardLevel: toHazardLevel(rule.hazardLevel),
    };
  })
    .filter((p) => p.confidence >= 0.01)
    .sort((a, b) => b.confidence - a.confidence);

  const inferenceMs = performance.now() - started;

  const top = predictions[0] || {
    material: "Unknown",
    materialSlug: "other",
    confidence: 0,
    hazardLevel: "low" as HazardLevel,
  };

  return {
    predictions: predictions.slice(0, 5),
    top,
    inferenceMs,
  };
}
