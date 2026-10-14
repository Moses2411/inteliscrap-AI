"""Dataset readiness checker for the IntelliScrap on-device vision classifier.

Answers one question before you spend hours training: *is there enough correct,
leak-free, labelled data to produce a model worth bundling?*

It validates that ``training/data`` matches the class contract in
``frontend/public/models/classes.json`` and reports per-class image counts,
class imbalance, train/val leakage (identical images in two splits), and
optionally corrupt images.

This tool is read-only and needs no ML dependencies. Pillow is only imported
when ``--check-images`` is passed.

Usage:
    python training/dataset_check.py --data training/data
    python training/dataset_check.py --data training/data --json
    python training/dataset_check.py --data training/data --check-images

Exit codes:
    0  ready to train (no blocking problems)
    1  not ready (missing classes, too few images, or unreadable files)
    2  usage / configuration error
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CLASSES_JSON = ROOT / "frontend" / "public" / "models" / "classes.json"

IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".webp")
SPLITS = ("train", "val", "test")

# Soft guidance for a model that behaves well on a phone camera. Below
# `min_per_class` we consider the dataset not ready to train at all.
RECOMMENDED_TRAIN_PER_CLASS = 300
DEFAULT_MIN_TRAIN_PER_CLASS = 100
DEFAULT_MIN_VAL_PER_CLASS = 20


def load_classes(classes_json: Path) -> list[dict]:
    if not classes_json.exists():
        raise SystemExit(f"ERROR: classes.json not found at {classes_json}")
    try:
        data = json.loads(classes_json.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"ERROR: classes.json is not valid JSON: {exc}") from exc
    if not isinstance(data, list) or not data:
        raise SystemExit("ERROR: classes.json must be a non-empty JSON array")
    for entry in data:
        if not isinstance(entry, dict) or not entry.get("slug"):
            raise SystemExit("ERROR: every classes.json entry needs a non-empty 'slug'")
    return data


def list_images(folder: Path) -> list[Path]:
    if not folder.is_dir():
        return []
    return [
        p
        for p in sorted(folder.iterdir())
        if p.is_file() and p.suffix.lower() in IMAGE_EXTS
    ]


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _class_subdirs(split_dir: Path) -> list[str]:
    if not split_dir.is_dir():
        return []
    return sorted(p.name for p in split_dir.iterdir() if p.is_dir())


def find_corrupt(paths: list[Path]) -> list[str]:
    from PIL import Image

    bad: list[str] = []
    for path in paths:
        try:
            with Image.open(path) as img:
                img.verify()
        except Exception:  # noqa: BLE001 - any failure means unusable
            bad.append(str(path))
    return bad


def find_duplicates(
    images: dict[str, dict[str, list[Path]]],
) -> tuple[list[list[str]], int]:
    """Return (example duplicate groups, number of groups spanning >1 split).

    Identical bytes appearing in two splits is leakage: the model can memorise
    the image and inflate validation accuracy.
    """
    seen: dict[str, list[tuple[str, str, Path]]] = {}
    for split, by_class in images.items():
        for slug, paths in by_class.items():
            for path in paths:
                seen.setdefault(sha256_of(path), []).append((split, slug, path))

    groups = [entries for entries in seen.values() if len(entries) > 1]
    cross_split = sum(1 for g in groups if len({s for s, _, _ in g}) > 1)
    examples = [
        [f"{split}/{slug}:{path.name}" for split, slug, path in group][:6]
        for group in groups[:5]
    ]
    return examples, cross_split


def analyze(
    data_root: Path,
    slugs: list[str],
    *,
    min_per_class: int = DEFAULT_MIN_TRAIN_PER_CLASS,
    min_val_per_class: int = DEFAULT_MIN_VAL_PER_CLASS,
    recommended_per_class: int = RECOMMENDED_TRAIN_PER_CLASS,
    check_images: bool = False,
    detect_duplicates: bool = True,
) -> dict:
    images: dict[str, dict[str, list[Path]]] = {}
    counts: dict[str, dict[str, int]] = {}
    missing: dict[str, list[str]] = {}
    extras: dict[str, list[str]] = {}

    for split in SPLITS:
        split_dir = data_root / split
        found = _class_subdirs(split_dir)
        missing[split] = [s for s in slugs if s not in found]
        extras[split] = [s for s in found if s not in slugs]
        images[split] = {slug: list_images(split_dir / slug) for slug in slugs}
        counts[split] = {slug: len(images[split][slug]) for slug in slugs}

    errors: list[str] = []
    warnings: list[str] = []

    if not (data_root / "train").is_dir():
        errors.append(
            f"missing {data_root / 'train'} — expected train/<slug>/ subfolders"
        )
    for split in ("train", "val"):
        if missing[split]:
            errors.append(f"{split}/ is missing class folders: {', '.join(missing[split])}")
        if extras[split]:
            warnings.append(
                f"{split}/ has folders not in classes.json (ignored): {', '.join(extras[split])}"
            )

    train_total = sum(counts["train"].values())
    val_total = sum(counts["val"].values())
    if train_total == 0:
        errors.append("train/ contains no images")
    if val_total == 0:
        errors.append("val/ contains no images - hold out real photos to measure accuracy")

    for slug in slugs:
        n = counts["train"][slug]
        if n == 0:
            errors.append(f"train/{slug}: 0 images")
        elif n < min_per_class:
            errors.append(
                f"train/{slug}: only {n} images (< {min_per_class} minimum)"
            )
        elif n < recommended_per_class:
            warnings.append(
                f"train/{slug}: {n} images (recommended >= {recommended_per_class} for field robustness)"
            )
        v = counts["val"][slug]
        if 0 < v < min_val_per_class:
            warnings.append(
                f"val/{slug}: only {v} images (recommended >= {min_val_per_class})"
            )

    nonempty = {s: counts["train"][s] for s in slugs if counts["train"][s] > 0}
    imbalance_ratio = None
    if len(nonempty) > 1:
        lo, hi = min(nonempty.values()), max(nonempty.values())
        imbalance_ratio = round(hi / lo, 2)
        if imbalance_ratio >= 5:
            warnings.append(
                f"class imbalance {imbalance_ratio:.1f}x (largest/smallest) - "
                "consider more photos of the small classes or class weights"
            )

    duplicate_examples: list[list[str]] = []
    cross_split = 0
    if detect_duplicates and val_total:
        all_paths = [p for split in SPLITS for paths in images[split].values() for p in paths]
        if all_paths:
            duplicate_examples, cross_split = find_duplicates(images)
            if cross_split:
                errors.append(
                    f"{cross_split} duplicate image group(s) span multiple splits (leakage) - "
                    "remove them from val/test"
                )

    corrupt: list[str] = []
    if check_images:
        all_paths = [p for split in SPLITS for paths in images[split].values() for p in paths]
        corrupt = find_corrupt(all_paths)
        if corrupt:
            errors.append(f"{len(corrupt)} unreadable/corrupt image(s) found")

    return {
        "data_root": str(data_root),
        "slugs": slugs,
        "counts": counts,
        "splits_total": {s: sum(counts[s].values()) for s in SPLITS},
        "missing": missing,
        "extras": extras,
        "imbalance_ratio": imbalance_ratio,
        "duplicate_examples": duplicate_examples,
        "cross_split_duplicates": cross_split,
        "corrupt": corrupt,
        "warnings": warnings,
        "errors": errors,
        "ready": not errors,
    }


def print_report(report: dict) -> None:
    slugs: list[str] = report["slugs"]
    counts: dict[str, dict[str, int]] = report["counts"]

    print(f"Dataset: {report['data_root']}")
    print(f"Classes: {len(slugs)} -> {', '.join(slugs)}\n")

    header = f"{'class':<16}{'train':>8}{'val':>8}{'test':>8}"
    print(header)
    print("-" * len(header))
    for slug in slugs:
        print(
            f"{slug:<16}{counts['train'][slug]:>8}{counts['val'][slug]:>8}{counts['test'][slug]:>8}"
        )
    total = report["splits_total"]
    print("-" * len(header))
    print(f"{'TOTAL':<16}{total['train']:>8}{total['val']:>8}{total['test']:>8}")

    if report["imbalance_ratio"]:
        print(f"\nClass imbalance (train max/min): {report['imbalance_ratio']}x")

    for warning in report["warnings"]:
        print(f"WARNING: {warning}")
    for error in report["errors"]:
        print(f"ERROR: {error}")

    if report["ready"]:
        print("\nREADY: dataset satisfies the contract and minimum size.")
    else:
        print("\nNOT READY: fix the errors above before training.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Check whether the training dataset is ready")
    parser.add_argument("--data", type=Path, default=ROOT / "training" / "data")
    parser.add_argument("--classes", type=Path, default=DEFAULT_CLASSES_JSON)
    parser.add_argument("--min-per-class", type=int, default=DEFAULT_MIN_TRAIN_PER_CLASS)
    parser.add_argument("--min-val-per-class", type=int, default=DEFAULT_MIN_VAL_PER_CLASS)
    parser.add_argument("--recommended-per-class", type=int, default=RECOMMENDED_TRAIN_PER_CLASS)
    parser.add_argument("--check-images", action="store_true", help="also verify each image opens")
    parser.add_argument("--no-duplicates", action="store_true", help="skip duplicate/leakage scan")
    parser.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    args = parser.parse_args()

    classes = load_classes(args.classes)
    slugs = [c["slug"] for c in classes]

    report = analyze(
        args.data,
        slugs,
        min_per_class=args.min_per_class,
        min_val_per_class=args.min_val_per_class,
        recommended_per_class=args.recommended_per_class,
        check_images=args.check_images,
        detect_duplicates=not args.no_duplicates,
    )

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print_report(report)
    return 0 if report["ready"] else 1


if __name__ == "__main__":
    sys.exit(main())
