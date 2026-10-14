"""Remove duplicate images so no photo appears in more than one split.

The web bootstrap scraper (``fetch_web_images.py``) can place the same bytes in
both ``train/`` and ``val/`` across resumed runs, which leaks the validation
set and inflates accuracy. This keeps a single copy per image — preferring the
earliest split in ``train > val > test`` order — and deletes the rest.

Usage:
    python training/dedupe_splits.py --data training/data --dry-run
    python training/dedupe_splits.py --data training/data
"""

from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPLITS = ("train", "val", "test")
IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".webp")


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def find_duplicates(data_root: Path) -> list[tuple[str, str, Path]]:
    """Return every image that should be deleted (a duplicate of an earlier one)."""
    by_digest: dict[str, list[tuple[str, str, Path]]] = {}
    for split in SPLITS:
        split_dir = data_root / split
        if not split_dir.is_dir():
            continue
        for slug_dir in sorted(p for p in split_dir.iterdir() if p.is_dir()):
            for image in sorted(p for p in slug_dir.iterdir() if p.suffix.lower() in IMAGE_EXTS):
                by_digest.setdefault(sha256_of(image), []).append((split, slug_dir.name, image))

    doomed: list[tuple[str, str, Path]] = []
    for entries in by_digest.values():
        if len(entries) < 2:
            continue
        keep = sorted(entries, key=lambda e: (SPLITS.index(e[0]), e[1], e[2].name))[0]
        for entry in entries:
            if entry is not keep:
                doomed.append(entry)
    return doomed


def main() -> int:
    parser = argparse.ArgumentParser(description="Remove cross-split duplicate images")
    parser.add_argument("--data", type=Path, default=ROOT / "training" / "data")
    parser.add_argument("--dry-run", action="store_true", help="list duplicates without deleting")
    args = parser.parse_args()

    if not args.data.is_dir():
        print(f"ERROR: {args.data} is not a directory", file=sys.stderr)
        return 2

    doomed = find_duplicates(args.data)
    for split, slug, path in doomed:
        print(f"remove duplicate {split}/{slug}/{path.name}")
        if not args.dry_run:
            path.unlink()

    verb = "would remove" if args.dry_run else "removed"
    print(f"{verb} {len(doomed)} duplicate image(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
