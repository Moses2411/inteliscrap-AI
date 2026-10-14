# On-device vision model contract

`InteliScrap` runs a **scrap-tuned image classifier entirely in the browser**
(`onnxruntime-web`, WASM) so scanning works with no internet. This directory is
where that model is served from, and this file documents the exact contract the
browser expects.

> **Honesty first.** The bundled model is **optional**. When it is absent,
> unverified, or its output width does not match `classes.json`, the app
> transparently falls back to the server vision model (when online) and finally
> to an **honest manual material picker**. It never fabricates a result. The
> `source` badge on every scan (`onnx` · `server` · `heuristic` · `manual`) tells
> the user exactly which path produced it.

## Files

| File | Required | Purpose |
|---|---|---|
| `classes.json` | ✅ always | Ordered class list. **Index order is the model's output order.** |
| `mobilenetv4_scrap_int8.onnx` | optional (recommended) | The trained, quantized classifier. |
| `model.manifest.json` | recommended | Provenance + verification metadata for the model above. |

## The browser contract

The exported ONNX model **must** satisfy:

- **Input:** `float32` tensor of shape `[1, 3, 224, 224]` (NCHW), ImageNet-normalized
  (`mean=[0.485, 0.456, 0.406]`, `std=[0.229, 0.224, 0.225]`). Resize shorter side to
  `224 * 1.14`, then center-crop to `224×224`.
- **Output:** a single tensor of `N` logits (or probabilities), where **`N` equals the
  number of entries in `classes.json`** and **index `i` maps to `classes.json[i]`**.
- Int8-quantized weights are preferred (≈10 MB) for low-bandwidth first downloads.

If the model's output width does not match `classes.json`, the app **refuses to use
it** (it would silently map predictions to the wrong materials) and marks the model
unavailable.

## How to produce a model

```bash
pip install -r training/requirements.txt

# 1. Collect labelled photos: training/data/train/<slug>/*.jpg (300–500+ per class)
#    and a held-out set: training/data/val/<slug>/*.jpg
#    Slugs must match classes.json: copper, aluminum, pet-plastic, lead-battery,
#                                  brass, steel, e-waste, glass

# 2. Train + export int8 ONNX with the manifest
python training/train.py --data training/data --out frontend/public/models/mobilenetv4_scrap_int8.onnx

# 3. VERIFY (mandatory) — checks input/output shapes and class order
python training/verify_model.py --image path/to/test_photo.jpg
```

`train.py` refuses to export if the dataset classes do not exactly match
`classes.json`, and `verify_model.py` fails loudly if the exported model violates the
contract. Only bundle a model that passes verification.

## `model.manifest.json` shape

```json
{
  "name": "mobilenetv4_scrap",
  "version": "1.0.0",
  "int8": true,
  "input_shape": [1, 3, 224, 224],
  "normalize": "imagenet",
  "classes_count": 8,
  "classes_sha256": "<sha256 of classes.json>",
  "exported_at": "2026-10-14T00:00:00Z",
  "source": "trained"
}
```

`npm run build` runs `scripts/check-vision-model.mjs`, which warns (without failing)
when the model is missing, oversized, or out of sync with `classes.json`.
