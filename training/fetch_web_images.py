"""Bootstrap the training set from Bing image search (best-effort).

This is a *bootstrap* tool, not a source of truth. Web images are copyrighted and
noisy (odd crops, collages, watermarks, wrong subjects), so treat the result as
temporary filler until you have your own field photos. It downloads, validates
and de-duplicates images, then splits them into ``train/`` and ``val/`` so the
normal pipeline can run immediately.

Usage:
    python training/fetch_web_images.py --per-class 130
    python training/fetch_web_images.py --classes copper,brass --per-class 30
    python training/fetch_web_images.py --dry-run --classes copper

Then:
    python training/dataset_check.py --data training/data
"""

from __future__ import annotations

import argparse
import hashlib
import html
import io
import json
import re
import sys
import time
import warnings
from pathlib import Path

import requests
from PIL import Image

# Palette-with-transparency warnings are harmless for our RGB conversion.
warnings.filterwarnings("ignore", message="Palette images with Transparency")

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CLASSES_JSON = ROOT / "frontend" / "public" / "models" / "classes.json"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

# Several queries per class: a single query only yields a few dozen unique images
# before Bing starts repeating itself.
DEFAULT_QUERY_SETS = {
    "copper": ["copper scrap metal wire", "bare bright copper wire", "copper pipe scrap", "copper scrap pile"],
    "aluminum": ["aluminum scrap metal", "aluminium extrusion scrap", "aluminum cans recycling", "aluminum scrap pile"],
    "pet-plastic": ["PET plastic bottles waste", "clear plastic bottles recycling pile", "plastic bottle bales waste", "waste plastic bottles pile"],
    "lead-battery": ["lead acid battery scrap", "car battery recycling", "used car batteries pile", "lead acid battery waste"],
    "brass": ["brass scrap metal fittings", "brass taps valves scrap", "brass scrap pile", "brass fittings recycling"],
    "steel": ["steel scrap metal", "steel rebar scrap", "scrap steel pile yard", "steel scrap recycling"],
    "e-waste": ["electronic circuit board e-waste", "printed circuit board scrap", "e-waste circuit boards", "electronic waste boards pile"],
    "glass": ["glass bottles scrap recycling", "waste glass bottles pile", "glass bottle recycling", "broken glass bottles recycling"],
}

MAX_BYTES = 8 * 1024 * 1024
MIN_SIDE = 200
SAVE_SIDE = 640


def load_slugs(classes_json: Path) -> list[str]:
    data = json.loads(classes_json.read_text(encoding="utf-8"))
    return [c["slug"] for c in data]


def parse_murls(text: str) -> list[str]:
    """Extract original image URLs from a Bing images (async) HTML payload."""
    text = html.unescape(text)
    found = re.findall(r'"murl":"(.*?)"', text)
    # Bing sometimes JSON-escapes forward slashes.
    return [u.replace("\\/", "/") for u in found if u.startswith("http")]


def bing_search_urls(session: requests.Session, query: str, first: int) -> list[str]:
    url = (
        "https://www.bing.com/images/async?q="
        + requests.utils.quote(query)
        + f"&first={first}&count=35&mmasync=1"
    )
    resp = session.get(url, timeout=20)
    resp.raise_for_status()
    return parse_murls(resp.text)


def to_jpeg(raw: bytes) -> bytes | None:
    """Validate that `raw` is a usable image and return a resized RGB JPEG."""
    try:
        with Image.open(io.BytesIO(raw)) as img:
            img = img.convert("RGB")
            if min(img.size) < MIN_SIDE:
                return None
            img.thumbnail((SAVE_SIDE, SAVE_SIDE))
            out = io.BytesIO()
            img.save(out, format="JPEG", quality=88)
            return out.getvalue()
    except Exception:  # noqa: BLE001 - any decode failure means skip
        return None


def fetch_class(
    session: requests.Session,
    slug: str,
    queries: list[str],
    out_root: Path,
    per_class: int,
    val_ratio: float,
    delay: float,
    dry_run: bool,
    seen_hashes: set[str],
) -> tuple[int, int]:
    train_dir = out_root / "train" / slug
    val_dir = out_root / "val" / slug
    train_dir.mkdir(parents=True, exist_ok=True)
    val_dir.mkdir(parents=True, exist_ok=True)

    existing = len(list(train_dir.glob("*.jpg"))) + len(list(val_dir.glob("*.jpg")))
    target_new = max(0, per_class - existing)
    if target_new == 0:
        print(f"  [{slug}] already has {existing} images (>= {per_class}); skipping")
        return len(list(train_dir.glob("*.jpg"))), len(list(val_dir.glob("*.jpg")))

    saved = 0
    val_every = max(1, round(1 / val_ratio)) if val_ratio > 0 else 0

    for query in queries:
        if saved >= target_new:
            break
        first = 1
        pages = 0
        while saved < target_new and pages < 6:
            try:
                urls = bing_search_urls(session, query, first)
            except Exception as exc:  # noqa: BLE001
                print(f"  [{slug}] '{query}' search failed at first={first}: {exc}")
                break
            if not urls:
                break
            pages += 1
            first += 35

            for url in urls:
                if saved >= target_new:
                    break
                if dry_run:
                    print(f"  [{slug}] would download {url}")
                    saved += 1
                    continue
                try:
                    resp = session.get(url, timeout=8, stream=True)
                    if resp.status_code != 200:
                        continue
                    raw = resp.content[: MAX_BYTES + 1]
                    if len(raw) > MAX_BYTES:
                        continue
                except Exception:  # noqa: BLE001
                    continue

                digest = hashlib.sha256(raw).hexdigest()
                if digest in seen_hashes:
                    continue
                jpeg = to_jpeg(raw)
                if jpeg is None:
                    continue
                seen_hashes.add(digest)

                total_idx = existing + saved
                dest = val_dir if (val_every and total_idx % val_every == 0) else train_dir
                path = dest / f"{slug}_{digest[:10]}.jpg"
                if path.exists():
                    continue
                path.write_bytes(jpeg)
                saved += 1
                if delay:
                    time.sleep(delay)

            print(f"  [{slug}] '{query[:28]}' page {pages}: {saved}/{target_new} new kept")

    n_val = len(list(val_dir.glob("*.jpg")))
    n_train = len(list(train_dir.glob("*.jpg")))
    return n_train, n_val


def main() -> int:
    parser = argparse.ArgumentParser(description="Bootstrap scrap images from Bing image search")
    parser.add_argument("--out", type=Path, default=ROOT / "training" / "data")
    parser.add_argument("--classes", type=str, default="", help="comma-separated slugs (default: all)")
    parser.add_argument("--per-class", type=int, default=130)
    parser.add_argument("--val-ratio", type=float, default=0.15)
    parser.add_argument("--delay", type=float, default=0.15, help="seconds between downloads")
    parser.add_argument("--dry-run", action="store_true", help="list URLs without downloading")
    args = parser.parse_args()

    try:
        sys.stdout.reconfigure(line_buffering=True)  # stream progress when piped to a log
    except Exception:  # noqa: BLE001
        pass

    slugs = load_slugs(DEFAULT_CLASSES_JSON)
    wanted = [s.strip() for s in args.classes.split(",") if s.strip()] or slugs
    unknown = [s for s in wanted if s not in slugs]
    if unknown:
        print(f"ERROR: unknown slugs {unknown}; valid: {slugs}", file=sys.stderr)
        return 2

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"})

    seen_hashes: set[str] = set()
    results: dict[str, tuple[int, int]] = {}
    for slug in wanted:
        print(f"Fetching '{slug}' ...")
        results[slug] = fetch_class(
            session,
            slug,
            DEFAULT_QUERY_SETS.get(slug, [f"{slug} scrap"]),
            args.out,
            args.per_class,
            args.val_ratio,
            args.delay,
            args.dry_run,
            seen_hashes,
        )

    print("\nclass            train    val")
    print("-" * 30)
    for slug in wanted:
        train, val = results[slug]
        print(f"{slug:<16}{train:>6}{val:>7}")

    print(
        "\nNOTE: these are scraped web images (copyrighted, noisy). Review them, "
        "replace with field photos, then run:\n"
        "  python training/dataset_check.py --data training/data --check-images"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
