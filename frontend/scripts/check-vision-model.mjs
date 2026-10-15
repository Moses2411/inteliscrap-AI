import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Warn (do not fail) when the on-device model has not been trained/copied yet.
// The app still builds and degrades to the server/heuristic paths, but on-device
// (offline) inference is disabled until this file exists.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modelPath = resolve(root, "public/models/mobilenetv4_scrap.onnx");
const labelsPath = resolve(root, "public/models/classes.json");
const manifestPath = resolve(root, "public/models/model.manifest.json");

function classCount() {
  if (!existsSync(labelsPath)) return null;
  try {
    const data = JSON.parse(readFileSync(labelsPath, "utf8"));
    return Array.isArray(data) ? data.length : null;
  } catch (err) {
    console.warn(`[check-vision-model] WARNING: classes.json is not valid JSON: ${err.message}`);
    return null;
  }
}

const classes = classCount();
if (classes === null) {
  console.warn("[check-vision-model] WARNING: classes.json is missing or malformed.");
}

if (!existsSync(modelPath)) {
  console.warn(
    "\n[check-vision-model] WARNING: on-device model is missing:\n" +
      `  ${modelPath}\n` +
      "  Offline classification is disabled until you train/export it:\n" +
      "    python training/train.py --data training/data --out frontend/public/models/mobilenetv4_scrap.onnx\n" +
      "    python training/verify_model.py --image <test.jpg>  # REQUIRED: verifies class order + shapes\n" +
      "  See frontend/public/models/README.md for the full contract.\n",
  );
} else {
  const mb = (statSync(modelPath).size / (1024 * 1024)).toFixed(1);
  const labelState = existsSync(labelsPath) ? `present (${classes} classes)` : "MISSING";
  console.log(`[check-vision-model] model present (${mb} MB), classes.json ${labelState}`);
  if (mb > 25) {
    console.warn(
      "[check-vision-model] WARNING: model exceeds 25 MB — too large for low-bandwidth " +
        "first downloads. Prefer the int8 (~10 MB) export.",
    );
  }
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      console.log(
        `[check-vision-model] manifest: v${manifest.version ?? "?"} ` +
          `classes=${manifest.classes_count ?? "?"} int8=${manifest.int8 ?? "?"}`,
      );
      if (manifest.classes_count && classes && manifest.classes_count !== classes) {
        console.warn(
          `[check-vision-model] WARNING: manifest classes_count (${manifest.classes_count}) ` +
            `differs from classes.json (${classes}). Re-export the model.`,
        );
      }
    } catch (err) {
      console.warn(`[check-vision-model] WARNING: model.manifest.json invalid: ${err.message}`);
    }
  } else {
    console.warn(
      "[check-vision-model] WARNING: model.manifest.json missing — run training/train.py " +
        "to regenerate the model with a manifest.",
    );
  }
}
