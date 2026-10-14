"""Tests for the dataset readiness checker and the metric computation.

These run without torch/timm: they exercise the pure logic using tiny synthetic
images written to a temp directory. No real photos (and therefore no bundled
model) are involved.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from PIL import Image

import dataset_check as dc
import evaluate as ev

SLUGS = ["copper", "aluminum", "brass"]


def _write_image(path: Path, color=(120, 80, 40)) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", (24, 24), color).save(path)


def _color_for(rel: str) -> tuple[int, int, int]:
    import hashlib

    h = hashlib.sha256(rel.encode()).digest()
    return (h[0], h[1], h[2])


def _make_dataset(root: Path, counts: dict[str, dict[str, int]]) -> None:
    for split, per_class in counts.items():
        for slug, n in per_class.items():
            for i in range(n):
                rel = f"{split}/{slug}/{i}"
                _write_image(root / split / slug / f"{slug}-{split}-{i}.jpg", _color_for(rel))


# --------------------------------------------------------------------------- #
# dataset_check
# --------------------------------------------------------------------------- #


def test_analyze_ready_for_well_formed_dataset(tmp_path):
    _make_dataset(tmp_path, {"train": {s: 3 for s in SLUGS}, "val": {s: 1 for s in SLUGS}})
    report = dc.analyze(tmp_path, SLUGS, min_per_class=2, min_val_per_class=1)
    assert report["ready"] is True
    assert report["errors"] == []
    assert report["splits_total"] == {"train": 9, "val": 3, "test": 0}


def test_analyze_flags_missing_class(tmp_path):
    _make_dataset(tmp_path, {"train": {s: 3 for s in SLUGS}, "val": {s: 1 for s in SLUGS}})
    # Remove a class from both splits.
    import shutil

    shutil.rmtree(tmp_path / "train" / "brass")
    shutil.rmtree(tmp_path / "val" / "brass")
    report = dc.analyze(tmp_path, SLUGS, min_per_class=2, min_val_per_class=1)
    assert report["ready"] is False
    assert any("brass" in e for e in report["errors"])


def test_analyze_flags_too_few_images(tmp_path):
    _make_dataset(tmp_path, {"train": {s: 1 for s in SLUGS}, "val": {s: 1 for s in SLUGS}})
    report = dc.analyze(tmp_path, SLUGS, min_per_class=5, min_val_per_class=1)
    assert report["ready"] is False
    assert any("minimum" in e for e in report["errors"])


def test_analyze_detects_cross_split_leakage(tmp_path):
    _make_dataset(tmp_path, {"train": {s: 3 for s in SLUGS}, "val": {s: 1 for s in SLUGS}})
    # Duplicate one training image into val (identical bytes -> leakage).
    src = next((tmp_path / "train" / "copper").glob("*.jpg"))
    (tmp_path / "val" / "copper" / "leaked.jpg").write_bytes(src.read_bytes())
    report = dc.analyze(tmp_path, SLUGS, min_per_class=2, min_val_per_class=1)
    assert report["ready"] is False
    assert report["cross_split_duplicates"] >= 1
    assert any("leakage" in e for e in report["errors"])


def test_analyze_warns_on_extra_folders(tmp_path):
    _make_dataset(tmp_path, {"train": {s: 3 for s in SLUGS}, "val": {s: 1 for s in SLUGS}})
    _write_image(tmp_path / "train" / "banana" / "b.jpg", (200, 200, 0))
    report = dc.analyze(tmp_path, SLUGS, min_per_class=2, min_val_per_class=1)
    assert report["extras"]["train"] == ["banana"]
    assert any("banana" in w for w in report["warnings"])
    # Extra folders do not block training (they are ignored by the loader).
    assert report["ready"] is True


def test_analyze_detects_corrupt_image(tmp_path):
    _make_dataset(tmp_path, {"train": {s: 3 for s in SLUGS}, "val": {s: 1 for s in SLUGS}})
    (tmp_path / "train" / "copper" / "broken.jpg").write_text("not an image")
    report = dc.analyze(tmp_path, SLUGS, min_per_class=2, min_val_per_class=1, check_images=True)
    assert report["ready"] is False
    assert report["corrupt"]


def test_list_images_ignores_non_images(tmp_path):
    _write_image(tmp_path / "copper" / "a.jpg")
    (tmp_path / "copper" / "notes.txt").write_text("ignore me")
    assert [p.name for p in dc.list_images(tmp_path / "copper")] == ["a.jpg"]


# --------------------------------------------------------------------------- #
# evaluate.compute_metrics
# --------------------------------------------------------------------------- #


def test_compute_metrics_perfect():
    probs = [[0.9, 0.05, 0.05], [0.1, 0.8, 0.1], [0.1, 0.2, 0.7]]
    m = ev.compute_metrics([0, 1, 2], probs, SLUGS)
    assert m["top1"] == 1.0
    assert m["top3"] == 1.0
    assert m["macro_f1"] == 1.0
    assert m["n"] == 3


def test_compute_metrics_counts_top3_but_not_top1():
    # truth=0 is ranked 2nd -> wrong top-1, right top-3.
    probs = [[0.4, 0.5, 0.1]]
    m = ev.compute_metrics([0], probs, SLUGS)
    assert m["top1"] == 0.0
    assert m["top3"] == 1.0


def test_compute_metrics_confusion_matrix():
    probs = [[0.9, 0.1, 0.0], [0.8, 0.2, 0.0]]  # both truth=0 but second predicted 0 too
    m = ev.compute_metrics([0, 1], probs, SLUGS)
    # truth 0 -> pred 0 ; truth 1 -> pred 0
    assert m["confusion"][0][0] == 1
    assert m["confusion"][1][0] == 1
    assert m["per_class"]["copper"]["recall"] == 1.0
    assert m["per_class"]["aluminum"]["recall"] == 0.0


def test_compute_metrics_rejects_width_mismatch():
    with pytest.raises(ValueError):
        ev.compute_metrics([0], [[0.5, 0.5]], SLUGS)


def test_compute_metrics_rejects_empty():
    with pytest.raises(ValueError):
        ev.compute_metrics([], [], SLUGS)


def test_load_eval_set_reads_folder_slugs(tmp_path):
    _write_image(tmp_path / "copper" / "a.jpg")
    _write_image(tmp_path / "brass" / "b.jpg")
    y_true, paths = ev.load_eval_set(tmp_path, SLUGS)
    assert y_true == [0, 2]
    assert len(paths) == 2
