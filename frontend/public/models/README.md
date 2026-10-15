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

## Current bundled model

The bundled classifier is trained on **93 real field photos** the team
photographed (split: 68 train / 25 held-out val). Its numbers are measured on
that held-out split and written into `model.manifest.json` — never asserted:

| metric | value |
|---|---|
| top-1 | 0.720 |
| top-3 | 0.880 |
| macro-F1 | 0.690 |
| weighted-F1 | 0.715 |
| size | 9.5 MB (fp32) |

Per-class F1 on the held-out split:

| class | F1 | notes |
|---|---|---|
| e-waste | 0.83 | |
| copper | 0.80 | |
| pet-plastic | 0.71 | |
| lead-battery | 0.60 | |
| aluminum | 0.50 | only 6 photos |
| brass · steel · glass | — | **no training photos yet** |

**Honest caveats.**

- Three of the eight classes — **brass, steel and glass — have no photos at
  all**. Those outputs are untrained and must be ignored; only copper,
  aluminum, pet-plastic, lead-battery and e-waste are real.
- Macro-F1 (0.690) is just below the ≥ 0.70 bar in `training/README.md` and the
  dataset is small (tens of photos per class), so treat every result as a hint
  to confirm with the physical test — not a verdict.
- The model is exported **fp32**, not int8. With so few images the static int8
  calibration is unstable (macro-F1 swung 0.34–0.71 across random calibration
  seeds), so the reproducible fp32 export is shipped. Once each class has a few
  hundred photos, `training/train.py` can produce a trustworthy int8 build.

Collect more photos (aim 300–500 per class, including brass, steel and glass),
then retrain with `training/train.py`.

## Files

| File | Required | Purpose |
|---|---|---|
| `classes.json` | ✅ always | Ordered class list. **Index order is the model's output order.** |
| `mobilenetv4_scrap.onnx` | optional (recommended) | The trained classifier (currently fp32; int8 once the dataset supports it). |
| `model.manifest.json` | recommended | Provenance + verification metadata for the model above. |

## The browser contract

The exported ONNX model **must** satisfy:

- **Input:** `float32` tensor of shape `[1, 3, 224, 224]` (NCHW), ImageNet-normalized
  (`mean=[0.485, 0.456, 0.406]`, `std=[0.229, 0.224, 0.225]`). Resize shorter side to
  `224 * 1.14`, then center-crop to `224×224`.
- **Output:** a single tensor of `N` logits (or probabilities), where **`N` equals the
  number of entries in `classes.json`** and **index `i` maps to `classes.json[i]`**.
- Int8-quantized weights are preferred (a few MB — roughly 2–10 MB depending on
  the backbone) for low-bandwidth first downloads.

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
#    See training/README.md for the full data spec, photography guide and
#    labelling rules.

# 2. Check the dataset is complete, balanced and leak-free
python training/dataset_check.py --data training/data

# 3. Train + export int8 ONNX with a manifest containing measured accuracy
python training/train.py --data training/data --out frontend/public/models/mobilenetv4_scrap.onnx

# 4. Evaluate on a held-out split (per-class F1 + confusion matrix)
python training/evaluate.py --data training/data/test

# 5. VERIFY (mandatory) — checks input/output shapes and class order
python training/verify_model.py --image path/to/test_photo.jpg
```

`train.py` refuses to train when the dataset classes do not exactly match
`classes.json` (it would mislabel predictions), `dataset_check.py` flags leakage
between splits, and `verify_model.py` fails loudly if the exported model violates
the contract. Only bundle a model that passes verification **and** reports a
`macro_f1` you trust (see `training/README.md`).

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
  "source": "trained",
  "top1": 0.0,
  "top3": 0.0,
  "macro_f1": 0.0,
  "weighted_f1": 0.0,
  "evaluated_on": "training/data/test",
  "eval_n": 0,
  "val_accuracy": 0.0,
  "train_images": 0,
  "val_images": 0,
  "test_images": 0
}
```

The accuracy fields are written by `train.py` from a real evaluation on the
held-out split — they are measured, never asserted.

`npm run build` runs `scripts/check-vision-model.mjs`, which warns (without failing)
when the model is missing, oversized, or out of sync with `classes.json`.
