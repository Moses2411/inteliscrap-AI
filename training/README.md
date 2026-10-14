# On-device vision model — training pipeline

This directory produces the optional, fully-offline scrap classifier that runs in
the browser (`onnxruntime-web`, WASM). It is the *only* training entrypoint —
the legacy script under `ml/` is deprecated (it used the wrong class order).

The app never depends on this model. When no verified model is bundled it falls
back, in order, to the server vision model (online) and then to an honest manual
material picker. The `source` badge (`onnx` · `server` · `heuristic` · `manual`)
tells the user exactly which path produced a result. **Only bundle a model that
measurably beats the manual picker.**

## Pipeline

| Step | Command | What it does |
|---|---|---|
| 1. Check data | `python training/dataset_check.py --data training/data` | Validates layout against `classes.json`, counts images, finds leakage/corrupt files. Refuses to proceed when unsafe. |
| 2. Train | `python training/train.py --data training/data --out frontend/public/models/mobilenetv4_scrap_int8.onnx` | Fine-tunes MobileNetV4, measures top-1/top-3/F1, exports int8 ONNX, verifies it, writes `model.manifest.json`. |
| 3. Evaluate | `python training/evaluate.py --data training/data/test` | Reproducible per-class metrics + confusion matrix on a held-out split. |
| 4. Verify | `python training/verify_model.py --image path/to/photo.jpg` | Confirms input/output shape and class order match the browser contract. |

```bash
pip install -r training/requirements.txt
```

## Dataset layout

One folder per class, folder name **must** equal the slug in
`frontend/public/models/classes.json`:

```
training/data/
├── train/<slug>/*.jpg   # required — used to fit the model
├── val/<slug>/*.jpg     # required — used to pick the best epoch
└── test/<slug>/*.jpg    # optional — kept untouched for the final report
```

`train.py` reads the class order from `classes.json`, so indices always line up
with what the browser expects. A missing or extra folder is a hard error.

### How much data?

| Split | Per class | Why |
|---|---|---|
| `train` | **300–500+** (minimum 100) | Fewer than ~100/class and the model overfits and is not worth bundling. |
| `val` | **50–100** | Used for model selection and int8 calibration. |
| `test` | **50–150** | Never used for training; gives the honest number in the manifest. |

`dataset_check.py` blocks training below the per-class minimum and warns below the
recommended count. More **diverse** photos beat more near-duplicate photos.

## The 8 classes

| Slug | Label | Hazard | What to photograph | How to tell it apart |
|---|---|---|---|---|
| `copper` | Copper | low | Bare bright wire, pipe offcuts, stripped cable, bus bar | Reddish/salmon; **not magnetic**; soft, scratches with a knife |
| `brass` | Brass | low | Taps, fittings, valves, keys, shell casings | Yellow/gold; not magnetic; **harder** than copper (won't scratch with a fingernail) |
| `aluminum` | Aluminum | low | Cans, window frames, pans, extrusion, foil | Light silver, **not magnetic**, very light for its size |
| `steel` | Steel | low | Rebar, bolts, sheet, cans, tools | Grey; **magnetic**; heavy |
| `pet-plastic` | PET Plastic | low | Clear drink bottles, food containers | Transparent/clear, **crunches**, light; often has a recycling triangle |
| `glass` | Glass | medium | Bottles, jars, window panes, broken shards | Transparent/tinted, **clinks**, harder and colder than plastic |
| `e-waste` | E-Waste Board | high | Circuit boards, PCBs, connectors, phones, power supplies | Green/blue boards with chips, pins, solder |
| `lead-battery` | Lead-Acid Battery | critical | Car/truck/inverter batteries | Heavy black/grey brick, two lead terminals, **never** open or break it |

**The hard pairs are the point.** Copper↔brass and aluminum↔steel look similar in
a photo; the app already resolves them with a physical test (magnet/scratch) after
the visual guess. When labelling, photograph exactly what the camera sees, not
what you know it is — a photo of brass that "looks copper" is *correct* training
data, because the app leans on the physical test, not the photo, for those.

## Photography guide

- **Use the actual phone** the app will run on (that camera's quirks end up in
  the training set). Shoot in portrait and landscape.
- **Vary**: indoors/outdoors, daylight/shade/torch, cluttered/scrap-yard and
  clean backgrounds, wet and dry, dusty and clean, single items and piles.
- **Framing**: some close-ups (fills the frame), some from ~30–50 cm, some with
  several pieces. Keep the material centred.
- **Angles**: include the side that shows the identifying colour/edges, but also
  angles that don't — those are the hard cases the model must survive.
- **Balance**: roughly equal counts per class; use `--class-weights` if not.
- **Exclude**: blurry shots, your hand covering the item, unrelated objects,
  and anything with a person's face or a readable ID/plate.

## Labelling rules

1. One material per image. If a photo shows a pile, label the dominant material.
2. Don't label by *origin* — label by *appearance*. A painted can that a human
   would call steel but that looks aluminum goes in the class it *looks* like, or
   keep it out of the set.
3. Never put the same photo (or a near-identical burst frame) in two splits —
   `dataset_check.py` flags byte-identical leakage automatically.
4. Keep `test/` untouched until the final evaluation. No peeking.

## When is a model good enough to bundle?

- `macro-F1` **≥ 0.70** and every class with a non-zero recall on `test/`
  (no class is completely missed).
- Re-run `python training/evaluate.py --data training/data/test` and read the
  confusion matrix — the confused pairs tell you which class needs more photos.
- If `macro-F1` is low, add more diverse photos; do **not** bundle a weak model.
  A wrong confident prediction is worse than the manual picker.

`train.py` prints an explicit warning when `macro-F1 < 0.60`.

## Files

| File | Purpose |
|---|---|
| `dataset_check.py` | Read-only data validator / inventory (no ML deps). |
| `train.py` | Train → quantize (static int8) → export → verify → manifest. |
| `evaluate.py` | top-1 / top-3 / per-class F1 + confusion matrix. |
| `verify_model.py` | Contract check on an exported `.onnx`. |
| `tests/` | Pytest coverage for the checker and metrics (`python -m pytest training/tests`). |
| `reports/` | Generated training/eval JSON (git-ignored). |
