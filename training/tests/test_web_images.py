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


class _FlakySession:
    """Fails the first `failures` requests, then returns a payload with one image."""

    def __init__(self, failures: int):
        self.failures = failures
        self.calls = 0

    def get(self, url, timeout=None):  # noqa: ARG002
        self.calls += 1
        if self.calls <= self.failures:
            raise ConnectionResetError("reset by peer")
        return _Resp('<a class="iusc" m="{&quot;murl&quot;:&quot;https://e/a.jpg&quot;}"></a>')


class _Resp:
    def __init__(self, text: str):
        self.text = text

    def raise_for_status(self):
        return None


def test_bing_search_retries_then_succeeds(monkeypatch):
    monkeypatch.setattr(fw.time, "sleep", lambda *_: None)
    session = _FlakySession(failures=2)
    assert fw.bing_search_urls(session, "copper", 0, attempts=3) == ["https://e/a.jpg"]
    assert session.calls == 3


def test_bing_search_raises_after_attempts(monkeypatch):
    monkeypatch.setattr(fw.time, "sleep", lambda *_: None)
    session = _FlakySession(failures=99)
    try:
        fw.bing_search_urls(session, "copper", 0, attempts=3)
    except ConnectionResetError:
        pass
    else:  # pragma: no cover
        raise AssertionError("expected the last error to propagate")
    assert session.calls == 3
