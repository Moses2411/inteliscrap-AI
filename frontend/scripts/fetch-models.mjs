import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Vendors the on-device classifier into public/models/ so it is served from our
// own origin and cached by the service worker (offline after the first load).
//
// Two ways to produce the model:
//   1. Train locally:
//        python training/train.py --out frontend/public/models/mobilenetv4_scrap_int8.onnx
//   2. Download a published one (private/gated repos need HF_TOKEN):
//        HF_TOKEN=... npm run fetch-models
//
// NOTE: this script intentionally does NOT copy ONNX Runtime WASM files.
// Vite emits the runtime WASM into dist/assets/ automatically (see
// build.rollupOptions.output.assetFileNames in vite.config.ts).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

const DEFAULT_URL =
  process.env.MOBILENETV4_URL ??
  "https://huggingface.co/inteliscrap/mobilenetv4-scrap/resolve/main/model_int8.onnx";

const MODELS = [{ name: "mobilenetv4_scrap_int8.onnx", url: DEFAULT_URL }];

async function downloadModel({ name, url }) {
  const dest = path.join(publicDir, "models");
  await mkdir(dest, { recursive: true });
  const target = path.join(dest, name);

  if (existsSync(target)) {
    console.log(`Skipping ${name} (already present)`);
    return;
  }

  const headers = {};
  const token = process.env.HF_TOKEN || process.env.HUGGING_FACE_HUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  console.log(`Downloading ${name} from ${url}`);
  const res = await fetch(url, { headers, redirect: "follow" });
  if (!res.ok) {
    throw new Error(
      `Failed to download ${name}: ${res.status} ${res.statusText}` +
        (res.status === 401 || res.status === 403
          ? " (set HF_TOKEN for a private/gated repo, or train it locally)"
          : ""),
    );
  }
  await writeFile(target, Buffer.from(await res.arrayBuffer()));
  console.log(`Saved ${name}`);
}

async function main() {
  for (const model of MODELS) {
    await downloadModel(model);
  }
  console.log("Done. The model is served from public/models/ and cached for offline use.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
