# Training data (not committed)

Drop labelled photos here before training. Images are intentionally
git-ignored — only these placeholders are tracked.

```
train/<slug>/*.jpg   # required
val/<slug>/*.jpg     # required
test/<slug>/*.jpg    # optional
```

`<slug>` must be one of (see `frontend/public/models/classes.json`):

`copper`, `aluminum`, `pet-plastic`, `lead-battery`, `brass`, `steel`, `e-waste`, `glass`

See [`../README.md`](../README.md) for the full data spec (how many photos, the
photography guide, and the labelling rules), then run:

```bash
python training/dataset_check.py --data training/data
```
