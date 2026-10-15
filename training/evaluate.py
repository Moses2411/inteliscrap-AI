"""Measure the accuracy of an exported ONNX scrap classifier honestly.

Runs the exported model over a labelled folder (``<root>/<slug>/*.jpg``) using
the *same* preprocessing the browser applies, then reports top-1 / top-3
accuracy, per-class precision/recall/F1, the confusion matrix, and macro /
weighted F1. The result is written to ``training/reports/`` so the numbers in
the README and the model manifest come from a reproducible run, not a guess.

Usage:
    python training/evaluate.py --data training/data/val
    python training/evaluate.py --data training/data/test --model frontend/public/models/mobilenetv4_scrap.onnx
    python training/evaluate.py --data training/data/val --json training/reports/eval.json

Exit codes:
    0  evaluation completed
    1  model / data error
    2  usage error
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CLASSES_JSON = ROOT / "frontend" / "public" / "models" / "classes.json"
DEFAULT_MODEL = ROOT / "frontend" / "public" / "models" / "mobilenetv4_scrap.onnx"
REPORTS_DIR = ROOT / "training" / "reports"

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]
IMAGE_EXTS = (".jpg", ".jpeg", ".jfif", ".png", ".webp")


def load_classes(classes_json: Path) -> list[dict]:
    if not classes_json.exists():
        raise SystemExit(f"ERROR: classes.json not found at {classes_json}")
    return json.loads(classes_json.read_text(encoding="utf-8"))


def compute_metrics(y_true: list[int], probs: list[list[float]], slugs: list[str]) -> dict:
    """Pure metric computation (no I/O) so it can be unit-tested directly."""
    n = len(y_true)
    if n == 0:
        raise ValueError("no samples to evaluate")
    k = len(slugs)
    if any(len(p) != k for p in probs):
        raise ValueError("probability vector width does not match the class list")

    confusion = [[0] * k for _ in range(k)]
    top1 = 0
    top3 = 0
    for truth, row in zip(y_true, probs):
        pred = max(range(k), key=lambda i: row[i])
        confusion[truth][pred] += 1
        if pred == truth:
            top1 += 1
        ranked = sorted(range(k), key=lambda i: row[i], reverse=True)[:3]
        if truth in ranked:
            top3 += 1

    per_class: dict[str, dict] = {}
    f1s: list[float] = []
    supports: list[int] = []
    for i, slug in enumerate(slugs):
        tp = confusion[i][i]
        fp = sum(confusion[r][i] for r in range(k)) - tp
        fn = sum(confusion[i]) - tp
        support = sum(confusion[i])
        precision = tp / (tp + fp) if (tp + fp) else 0.0
        recall = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
        per_class[slug] = {
            "support": support,
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1, 4),
        }
        if support:
            f1s.append(f1)
            supports.append(support)

    macro_f1 = sum(f1s) / len(f1s) if f1s else 0.0
    weighted_f1 = (
        sum(f * s for f, s in zip(f1s, supports)) / sum(supports) if supports else 0.0
    )

    return {
        "n": n,
        "top1": round(top1 / n, 4),
        "top3": round(top3 / n, 4),
        "macro_f1": round(macro_f1, 4),
        "weighted_f1": round(weighted_f1, 4),
        "per_class": per_class,
        "confusion": confusion,
        "slugs": list(slugs),
    }


def _preprocess(path: Path, size: int = 224):
    import numpy as np
    from PIL import Image
    from torchvision import transforms

    prep = transforms.Compose(
        [
            transforms.Resize(int(size * 1.14)),
            transforms.CenterCrop(size),
            transforms.ToTensor(),
            transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
        ]
    )
    tensor = prep(Image.open(path).convert("RGB")).unsqueeze(0).numpy().astype(np.float32)
    return tensor


def load_eval_set(root: Path, slugs: list[str]) -> tuple[list[int], list[Path]]:
    y_true: list[int] = []
    paths: list[Path] = []
    for idx, slug in enumerate(slugs):
        folder = root / slug
        if not folder.is_dir():
            continue
        for path in sorted(p for p in folder.iterdir() if p.suffix.lower() in IMAGE_EXTS):
            y_true.append(idx)
            paths.append(path)
    return y_true, paths


def softmax(logits):
    import numpy as np

    shifted = logits - logits.max()
    exps = np.exp(shifted)
    return exps / exps.sum()


def evaluate_model(model_path: Path, data_root: Path, classes_json: Path) -> dict:
    import numpy as np
    import onnxruntime as ort

    if not model_path.exists():
        raise SystemExit(f"ERROR: model not found at {model_path}")
    if not data_root.is_dir():
        raise SystemExit(f"ERROR: data folder not found at {data_root}")

    classes = load_classes(classes_json)
    slugs = [c["slug"] for c in classes]

    y_true, paths = load_eval_set(data_root, slugs)
    if not paths:
        raise SystemExit(
            f"ERROR: no labelled images under {data_root}/<slug>/ (expected {', '.join(slugs)})"
        )

    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name

    probs: list[list[float]] = []
    for path in paths:
        tensor = _preprocess(path)
        logits = session.run([output_name], {input_name: tensor})[0][0]
        probs.append(softmax(np.asarray(logits, dtype=np.float64)).tolist())

    metrics = compute_metrics(y_true, probs, slugs)
    metrics.update(
        {
            "model": str(model_path),
            "data": str(data_root),
            "evaluated_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    return metrics


def print_metrics(metrics: dict) -> None:
    print(f"model : {metrics['model']}")
    print(f"data  : {metrics['data']}")
    print(f"n     : {metrics['n']}\n")
    print("per-class:")
    header = f"  {'class':<16}{'support':>8}{'prec':>8}{'recall':>8}{'f1':>8}"
    print(header)
    for slug, m in metrics["per_class"].items():
        print(
            f"  {slug:<16}{m['support']:>8}{m['precision']:>8.3f}{m['recall']:>8.3f}{m['f1']:>8.3f}"
        )
    print(
        f"\ntop-1 {metrics['top1']:.3f}   top-3 {metrics['top3']:.3f}   "
        f"macro-F1 {metrics['macro_f1']:.3f}   weighted-F1 {metrics['weighted_f1']:.3f}"
    )
    print("\nconfusion matrix (rows = truth, cols = predicted):")
    slugs = metrics["slugs"]
    print("  " + " " * 16 + "".join(f"{s[:6]:>8}" for s in slugs))
    for i, slug in enumerate(slugs):
        row = "".join(f"{v:>8}" for v in metrics["confusion"][i])
        print(f"  {slug:<16}{row}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate an exported scrap classifier")
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL)
    parser.add_argument("--classes", type=Path, default=DEFAULT_CLASSES_JSON)
    parser.add_argument("--data", type=Path, default=ROOT / "training" / "data" / "val")
    parser.add_argument("--json", type=Path, default=None, help="write the report here")
    parser.add_argument("--quiet", action="store_true", help="only write JSON")
    args = parser.parse_args()

    metrics = evaluate_model(args.model, args.data, args.classes)

    out = args.json
    if out is None:
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        out = REPORTS_DIR / f"eval-{stamp}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")

    if not args.quiet:
        print_metrics(metrics)
        print(f"\nreport -> {out}")
    else:
        print(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
