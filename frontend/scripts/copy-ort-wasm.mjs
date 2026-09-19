import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = resolve(root, "public");

const copies = [
  {
    src: resolve(root, "node_modules/onnxruntime-web/dist"),
    out: resolve(publicDir, "ort"),
    files: ["ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.mjs"],
  },
  {
    src: resolve(root, "node_modules/@huggingface/transformers/node_modules/onnxruntime-web/dist"),
    out: resolve(publicDir, "ort-tjs"),
    files: ["ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.mjs"],
  },
];

for (const { src, out, files } of copies) {
  mkdirSync(out, { recursive: true });
  for (const file of files) {
    copyFileSync(resolve(src, file), resolve(out, file));
    console.log(`copied ${file} -> ${out}`);
  }
}