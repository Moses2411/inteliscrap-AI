import { copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const ortDist = path.join(__dirname, "..", "node_modules", "onnxruntime-web", "dist");

const MODELS = [
  {
    name: "mobilenetv4_scrap_int8.onnx",
    url:
      process.env.MOBILENETV4_URL ??
      "https://huggingface.co/inteliscrap/mobilenetv4-scrap/resolve/main/model_int8.onnx",
  },
];

async function copyOrtWasm() {
  const dest = path.join(publicDir, "ort");
  await mkdir(dest, { recursive: true });

  const files = (await readdir(ortDist)).filter(
    (f) => (f.endsWith(".wasm") || f.endsWith(".mjs")) && !f.includes(".jsep"),
  );

  for (const file of files) {
    await copyFile(path.join(ortDist, file), path.join(dest, file));
  }
  console.log(`Copied ${files.length} ONNX Runtime files to public/ort/`);
}

async function downloadModel({ name, url }) {
  const dest = path.join(publicDir, "models");
  await mkdir(dest, { recursive: true });
  const target = path.join(dest, name);

  if (existsSync(target)) {
    console.log(`Skipping ${name} (already present)`);
    return;
  }

  console.log(`Downloading ${name} from ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${name}: ${res.statusText}`);
  await writeFile(target, Buffer.from(await res.arrayBuffer()));
  console.log(`Saved ${name}`);
}

async function main() {
  await copyOrtWasm();
  for (const model of MODELS) {
    await downloadModel(model);
  }
  console.log("Done. The Qwen2.5-0.5B weights are fetched lazily by Transformers.js at runtime.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
