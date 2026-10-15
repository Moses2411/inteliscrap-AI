"""Tests for the cross-split dedupe helper (temp dataset, no network)."""

from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image

import dedupe_splits as ds


def _write(path: Path, color: tuple[int, int, int]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", (32, 32), color).save(path, format="JPEG")


def test_keeps_one_copy_and_removes_the_rest(tmp_path):
    original = tmp_path / "train" / "copper" / "x.jpg"
    _write(original, (10, 20, 30))

    # Same bytes in val (cross-split) and in another class (cross-class conflict).
    duplicate_val = tmp_path / "val" / "copper" / "x.jpg"
    duplicate_val.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(original, duplicate_val)

    duplicate_class = tmp_path / "train" / "pet-plastic" / "y.jpg"
    duplicate_class.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(original, duplicate_class)

    doomed_paths = {path for _, _, path in ds.find_duplicates(tmp_path)}

    assert doomed_paths == {duplicate_val, duplicate_class}
    assert original not in doomed_paths


def test_prefers_train_over_val_over_test(tmp_path):
    train = tmp_path / "train" / "steel" / "a.jpg"
    _write(train, (1, 1, 1))
    for split in ("val", "test"):
        duplicate = tmp_path / split / "steel" / "a.jpg"
        duplicate.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(train, duplicate)

    doomed = {path for _, _, path in ds.find_duplicates(tmp_path)}

    assert doomed == {
        tmp_path / "val" / "steel" / "a.jpg",
        tmp_path / "test" / "steel" / "a.jpg",
    }


def test_unique_images_are_not_touched(tmp_path):
    _write(tmp_path / "train" / "brass" / "a.jpg", (1, 2, 3))
    _write(tmp_path / "train" / "brass" / "b.jpg", (4, 5, 6))
    _write(tmp_path / "val" / "brass" / "c.jpg", (7, 8, 9))

    assert ds.find_duplicates(tmp_path) == []
