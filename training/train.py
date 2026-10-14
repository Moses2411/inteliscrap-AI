"""Train a scrap-material classifier and export an int8 ONNX model that matches
the browser inference contract (frontend/src/vision/visionEngine.ts).

This is the single authoritative training entrypoint. It:

  1. validates the dataset against ``frontend/public/models/classes.json``
     (refusing to train if a class would be mislabelled),
  2. fine-tunes a MobileNetV4 backbone (MobileNetV3 fallback),
  3. measures real top-1 / top-3 / per-class F1 on the held-out split,
  4. exports an int8-quantized ONNX model, verifies the export, and
  5. writes ``model.manifest.json`` with the measured accuracy.

Dataset layout (folder name == class slug from classes.json):
    training/data/train/<slug>/*.jpg    (required)
    training/data/val/<slug>/*.jpg      (required — real held-out photos)
    training/data/test/<slug>/*.jpg     (optional — final unbiased report)

Usage:
    pip install -r training/requirements.txt
    python training/dataset_check.py --data training/data
    python training/train.py --data training/data --out frontend/public/models/mobilenetv4_scrap_int8.onnx
    python training/evaluate.py --data training/data/test
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import sys
import warnings
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms
from tqdm import tqdm

import dataset_check as dc
import evaluate as ev

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CLASSES_JSON = ROOT / "frontend" / "public" / "models" / "classes.json"
DEFAULT_OUT = ROOT / "frontend" / "public" / "models" / "mobilenetv4_scrap_int8.onnx"
REPORTS_DIR = ROOT / "training" / "reports"
DEFAULT_BACKBONE = "mobilenetv4_conv_small"
INPUT_NAME = "pixel_values"
OUTPUT_NAME = "logits"

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

TRAIN_TF = transforms.Compose(
    [
        transforms.RandomResizedCrop(224, scale=(0.7, 1.0)),
        transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(0.2, 0.2, 0.2, 0.05),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ]
)

EVAL_TF = transforms.Compose(
    [
        transforms.Resize(int(224 * 1.14)),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ]
)


class ScrapDataset(Dataset):
    """Folder-per-class dataset whose label indices follow classes.json order."""

    def __init__(self, root: Path, slugs: list[str], transform) -> None:
        self.transform = transform
        self.samples: list[tuple[Path, int]] = []
        for idx, slug in enumerate(slugs):
            folder = root / slug
            if not folder.is_dir():
                continue
            for path in sorted(
                p for p in folder.iterdir() if p.suffix.lower() in dc.IMAGE_EXTS
            ):
                self.samples.append((path, idx))

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, index: int):
        path, target = self.samples[index]
        return self.transform(Image.open(path).convert("RGB")), target


def build_model(backbone: str, num_classes: int, pretrained: bool = True) -> nn.Module:
    try:
        import timm

        return timm.create_model(backbone, pretrained=pretrained, num_classes=num_classes)
    except Exception as exc:  # noqa: BLE001 - fall back to a model already in torchvision
        print(f"WARNING: timm backbone '{backbone}' unavailable ({exc}); using mobilenet_v3_small", file=sys.stderr)
        import torchvision.models as tv

        weights = tv.MobileNet_V3_Small_Weights.IMAGENET1K_V1 if pretrained else None
        model = tv.mobilenet_v3_small(weights=weights)
        model.classifier[3] = nn.Linear(model.classifier[3].in_features, num_classes)
        return model


def class_weights(dataset: ScrapDataset, num_classes: int) -> torch.Tensor | None:
    counts = [0] * num_classes
    for _, target in dataset.samples:
        counts[target] += 1
    if sum(counts) == 0 or min(counts) == max(counts):
        return None
    total = sum(counts)
    weights = [total / (num_classes * c) if c else 0.0 for c in counts]
    return torch.tensor(weights, dtype=torch.float32)


@torch.no_grad()
def collect_probs(model: nn.Module, loader: DataLoader, device: torch.device):
    model.eval()
    y_true: list[int] = []
    probs: list[list[float]] = []
    for images, targets in loader:
        logits = model(images.to(device))
        probs.extend(F.softmax(logits, dim=1).cpu().tolist())
        y_true.extend(targets.tolist())
    return y_true, probs


def quantize(fp32_path: Path, int8_path: Path, mode: str, calib=None):
    """Return (int8_written: bool, note: str)."""
    if mode == "none":
        return False, "quantization disabled by --quant none"
    try:
        from onnxruntime.quantization import QuantType, quantize_dynamic
    except Exception as exc:  # noqa: BLE001
        return False, f"onnxruntime.quantization unavailable ({exc})"

    if mode == "static" and calib is not None:
        try:
            from onnxruntime.quantization import (
                CalibrationDataReader,
                QuantFormat,
                quantize_static,
            )

            class Reader(CalibrationDataReader):
                def __init__(self, batches):
                    self.batches = iter(batches)

                def get_next(self):
                    try:
                        batch = next(self.batches)
                    except StopIteration:
                        return None
                    return {INPUT_NAME: batch.numpy()}

            quantize_static(
                str(fp32_path),
                str(int8_path),
                Reader(calib),
                quant_format=QuantFormat.QOperator,
                weight_type=QuantType.QInt8,
                activation_type=QuantType.QUInt8,
            )
            return True, "static int8 quantization"
        except Exception as exc:  # noqa: BLE001
            print(f"WARNING: static quantization failed ({exc}); trying dynamic", file=sys.stderr)

    try:
        quantize_dynamic(str(fp32_path), str(int8_path), weight_type=QuantType.QInt8)
        return True, "dynamic int8 quantization"
    except Exception as exc:  # noqa: BLE001
        return False, f"quantization failed ({exc})"


def verify_exported_model(model_path: Path, classes_json: Path) -> None:
    import onnx

    onnx.checker.check_model(str(model_path))
    import onnxruntime as ort

    classes = ev.load_classes(classes_json)
    sess = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    inp, out = sess.get_inputs()[0], sess.get_outputs()[0]
    if [str(d) for d in inp.shape[-3:]] != ["3", "224", "224"]:
        raise SystemExit(f"ERROR: unexpected input shape {inp.shape}, expected [*, 3, 224, 224]")
    if "float" not in inp.type:
        raise SystemExit(f"ERROR: expected float32 input, got {inp.type}")
    if len(sess.get_outputs()) != 1:
        raise SystemExit("ERROR: expected exactly one output tensor")
    if isinstance(out.shape[-1], int) and out.shape[-1] != len(classes):
        raise SystemExit(
            f"ERROR: output width {out.shape[-1]} != classes.json size {len(classes)}"
        )


def write_manifest(model_path: Path, classes_json: Path, int8: bool, metrics: dict, dataset: dict) -> None:
    manifest = {
        "name": "mobilenetv4_scrap",
        "version": "1.0.0",
        "int8": int8,
        "input_shape": [1, 3, 224, 224],
        "normalize": "imagenet",
        "classes_count": len(ev.load_classes(classes_json)),
        "classes_sha256": hashlib.sha256(classes_json.read_bytes()).hexdigest(),
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "source": "trained",
        # Measured on the held-out split, not asserted.
        "top1": metrics["top1"],
        "top3": metrics["top3"],
        "macro_f1": metrics["macro_f1"],
        "weighted_f1": metrics["weighted_f1"],
        "evaluated_on": metrics["data"],
        "eval_n": metrics["n"],
        "val_accuracy": metrics["top1"],  # back-compat with earlier manifests
        "train_images": dataset.get("train", 0),
        "val_images": dataset.get("val", 0),
        "test_images": dataset.get("test", 0),
    }
    manifest_path = model_path.parent / "model.manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"wrote manifest -> {manifest_path}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Train and export a scrap-material classifier")
    parser.add_argument("--data", type=Path, default=ROOT / "training" / "data")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--classes", type=Path, default=DEFAULT_CLASSES_JSON)
    parser.add_argument("--backbone", type=str, default=DEFAULT_BACKBONE)
    parser.add_argument("--epochs", type=int, default=25)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--weight-decay", type=float, default=1e-4)
    parser.add_argument("--device", type=str, default="auto")
    parser.add_argument("--workers", type=int, default=0)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--patience", type=int, default=6, help="early-stop patience (epochs)")
    parser.add_argument("--class-weights", action="store_true", help="weight loss by inverse class frequency")
    parser.add_argument("--quant", choices=("static", "dynamic", "none"), default="static")
    parser.add_argument("--calib-samples", type=int, default=128)
    parser.add_argument("--min-per-class", type=int, default=dc.DEFAULT_MIN_TRAIN_PER_CLASS)
    parser.add_argument("--skip-dataset-check", action="store_true")
    args = parser.parse_args()

    seed = args.seed
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)

    classes = ev.load_classes(args.classes)
    slugs = [c["slug"] for c in classes]
    print(f"classes.json: {len(slugs)} classes -> {slugs}")

    # 1. Preflight: never train against a dataset that would mislabel predictions.
    if not args.skip_dataset_check:
        report = dc.analyze(
            args.data,
            slugs,
            min_per_class=args.min_per_class,
            recommended_per_class=dc.RECOMMENDED_TRAIN_PER_CLASS,
        )
        if not report["ready"]:
            dc.print_report(report)
            print("\nERROR: dataset is not ready — refusing to train.", file=sys.stderr)
            return 1
        print(
            f"dataset OK: {report['splits_total']['train']} train / "
            f"{report['splits_total']['val']} val images"
        )

    device = (
        torch.device("cuda" if torch.cuda.is_available() else "cpu")
        if args.device == "auto"
        else torch.device(args.device)
    )
    print(f"device: {device}")

    train_set = ScrapDataset(args.data / "train", slugs, TRAIN_TF)
    val_set = ScrapDataset(args.data / "val", slugs, EVAL_TF)
    test_set = ScrapDataset(args.data / "test", slugs, EVAL_TF)
    if not len(train_set) or not len(val_set):
        print("ERROR: no images under data/train/<slug>/ and data/val/<slug>/", file=sys.stderr)
        return 1

    train_loader = DataLoader(
        train_set, batch_size=args.batch_size, shuffle=True, num_workers=args.workers
    )
    val_loader = DataLoader(val_set, batch_size=args.batch_size, shuffle=False, num_workers=args.workers)

    model = build_model(args.backbone, len(slugs)).to(device)
    weights = class_weights(train_set, len(slugs)).to(device) if args.class_weights else None
    if weights is not None:
        print(f"class weights: {[round(w, 3) for w in weights.tolist()]}")
    criterion = nn.CrossEntropyLoss(weight=weights)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.weight_decay)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)

    checkpoint_dir = args.data / "models"
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    best_path = checkpoint_dir / "best.pth"
    best_f1 = -1.0
    best_epoch = 0
    history: list[dict] = []
    epochs_without_improvement = 0

    for epoch in range(1, args.epochs + 1):
        model.train()
        total_loss = 0.0
        for images, targets in tqdm(train_loader, desc=f"epoch {epoch}/{args.epochs}"):
            images, targets = images.to(device), targets.to(device)
            optimizer.zero_grad()
            loss = criterion(model(images), targets)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * images.size(0)
        scheduler.step()

        y_true, probs = collect_probs(model, val_loader, device)
        metrics = ev.compute_metrics(y_true, probs, slugs)
        train_loss = total_loss / len(train_set)
        history.append(
            {"epoch": epoch, "loss": round(train_loss, 4), "top1": metrics["top1"], "macro_f1": metrics["macro_f1"]}
        )
        print(
            f"epoch {epoch}: loss={train_loss:.4f} val_top1={metrics['top1'] * 100:.2f}% "
            f"val_macroF1={metrics['macro_f1']:.3f}"
        )

        if metrics["macro_f1"] > best_f1:
            best_f1 = metrics["macro_f1"]
            best_epoch = epoch
            torch.save(model.state_dict(), best_path)
            epochs_without_improvement = 0
        else:
            epochs_without_improvement += 1
            if epochs_without_improvement >= args.patience:
                print(f"early stopping at epoch {epoch} (no F1 improvement for {args.patience} epochs)")
                break

    print(f"best val macro-F1 {best_f1:.3f} at epoch {best_epoch}")
    model.load_state_dict(torch.load(best_path, map_location=device))
    model.eval()

    # 2. Export to ONNX (fp32 first, then quantize).
    args.out.parent.mkdir(parents=True, exist_ok=True)
    fp32_path = args.out.with_suffix(".fp32.onnx")
    dummy = torch.randn(1, 3, 224, 224, device=device)
    export_kwargs = dict(
        input_names=[INPUT_NAME],
        output_names=[OUTPUT_NAME],
        opset_version=17,
        do_constant_folding=True,
    )
    try:
        with warnings.catch_warnings():
            # The TorchScript exporter is stable and understood by onnxruntime's
            # quantizer; silence only its deprecation notice.
            warnings.filterwarnings("ignore", message=r"You are using the legacy")
            try:
                torch.onnx.export(model, dummy, str(fp32_path), dynamo=False, **export_kwargs)
            except TypeError:
                torch.onnx.export(model, dummy, str(fp32_path), **export_kwargs)
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: ONNX export failed: {exc}", file=sys.stderr)
        return 1

    calib = None
    if args.quant == "static":
        # The exported graph has a fixed batch of 1, so calibration must feed
        # single images (onnxruntime rejects batch>1 with "Expected: 1").
        calib_loader = DataLoader(val_set, batch_size=1, shuffle=False, num_workers=0)
        calib = [batch for batch, _ in calib_loader][: args.calib_samples]

    int8, note = quantize(fp32_path, args.out, args.quant, calib=calib)
    if int8:
        fp32_path.unlink(missing_ok=True)
        print(f"exported int8 -> {args.out} ({note})")
    else:
        fp32_path.replace(args.out)
        print(f"exported fp32 -> {args.out} ({note})")

    verify_exported_model(args.out, args.classes)

    # 3. Final metrics: prefer the untouched test split over val.
    final_root = args.data / "test" if len(test_set) else args.data / "val"
    final_metrics = ev.evaluate_model(args.out, final_root, args.classes)
    ev.print_metrics(final_metrics)

    write_manifest(
        args.out,
        args.classes,
        int8=int8,
        metrics=final_metrics,
        dataset={
            "train": len(train_set),
            "val": len(val_set),
            "test": len(test_set),
        },
    )

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    report = {
        "backbone": args.backbone,
        "seed": seed,
        "epochs_run": len(history),
        "best_epoch": best_epoch,
        "history": history,
        "final": final_metrics,
        "quant": note,
        "int8": int8,
    }
    report_path = REPORTS_DIR / f"train-{stamp}.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"report -> {report_path}")

    if final_metrics["macro_f1"] < 0.6:
        print(
            "\nWARNING: macro-F1 below 0.60 - this model is probably not better than the "
            "manual picker yet. Collect more diverse photos before bundling it.",
            file=sys.stderr,
        )
    print("\nNext: python training/verify_model.py --image path/to/test_photo.jpg")
    return 0


if __name__ == "__main__":
    sys.exit(main())
