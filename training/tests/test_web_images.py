"""Tests for the Bing bootstrap scraper's pure helpers (no network needed)."""

from __future__ import annotations

import io

from PIL import Image

import fetch_web_images as fw


def test_parse_murls_extracts_and_unescapes():
    payload = (
        '<a class="iusc" m="{&quot;murl&quot;:&quot;https://example.com/a.jpg&quot;}"></a>'
        '<a class="iusc" m="{&quot;murl&quot;:&quot;https:\\/\\/example.com\\/b.png&quot;}"></a>'
        '<a class="iusc" m="{&quot;murl&quot;:&quot;not-a-url&quot;}"></a>'
    )
    assert fw.parse_murls(payload) == [
        "https://example.com/a.jpg",
        "https://example.com/b.png",
    ]


def test_parse_murls_empty():
    assert fw.parse_murls("<html>no images here</html>") == []


def test_to_jpeg_rejects_tiny_image():
    buf = io.BytesIO()
    Image.new("RGB", (50, 50), (10, 20, 30)).save(buf, format="JPEG")
    assert fw.to_jpeg(buf.getvalue()) is None


def test_to_jpeg_returns_resized_jpeg():
    buf = io.BytesIO()
    Image.new("RGB", (900, 700), (120, 60, 30)).save(buf, format="JPEG")
    out = fw.to_jpeg(buf.getvalue())
    assert out is not None
    assert out[:2] == b"\xff\xd8"  # JPEG SOI marker
    with Image.open(io.BytesIO(out)) as img:
        assert max(img.size) <= fw.SAVE_SIDE


def test_to_jpeg_rejects_non_image():
    assert fw.to_jpeg(b"this is definitely not an image") is None
