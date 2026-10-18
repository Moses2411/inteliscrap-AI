#!/usr/bin/env python3
"""Standalone MTN MoMo sandbox API user + API key provisioner.

Uses the Collections subscription key to create:
1. An API user (UUID)
2. An API key for that user

Then prints the full MOMO_* env block to copy into backend/.env (or your
Render service environment). Pass ``--write`` to upsert the values into
backend/.env automatically.

Environment variables (or .env in backend/):
- MOMO_SUBSCRIPTION_KEY (required) — Collections product primary key
- MOMO_BASE_URL (optional) — default https://sandbox.momodeveloper.mtn.com
- MOMO_CALLBACK_HOST or MOMO_CALLBACK_BASE_URL (optional) — provider callback
  host; the host is extracted from the base URL when a full URL is given
"""
from __future__ import annotations

import argparse
import asyncio
import os
import re
import sys
import uuid
from pathlib import Path

try:
    import httpx
    from dotenv import load_dotenv
except Exception as exc:  # pragma: no cover - bootstrap
    print(f"Missing dependencies: {exc}", file=sys.stderr)
    print("Install with: pip install httpx python-dotenv", file=sys.stderr)
    sys.exit(1)


def load_env() -> None:
    backend_dir = Path(__file__).resolve().parents[1]
    for candidate in (backend_dir / ".env", Path.cwd() / ".env"):
        if candidate.exists():
            load_dotenv(candidate, override=False)


def base_url() -> str:
    return (os.getenv("MOMO_BASE_URL") or "https://sandbox.momodeveloper.mtn.com").rstrip("/")


def subscription_key() -> str:
    key = os.getenv("MOMO_SUBSCRIPTION_KEY") or ""
    if not key:
        print("MOMO_SUBSCRIPTION_KEY is required", file=sys.stderr)
        sys.exit(2)
    return key


def callback_host() -> str:
    """Host MoMo should send provider callbacks to (not a full URL)."""
    host = os.getenv("MOMO_CALLBACK_HOST") or ""
    if host:
        return host
    base = os.getenv("MOMO_CALLBACK_BASE_URL") or ""
    if base:
        match = re.match(r"https?://([^/:]+)", base.strip())
        if match:
            return match.group(1)
    return "inteliscrap.example.com"


def _safe_json(resp: httpx.Response) -> object:
    try:
        return resp.json()
    except Exception:  # noqa: BLE001
        return None


def _extract_error(resp: httpx.Response) -> str:
    payload = _safe_json(resp)
    if isinstance(payload, dict):
        for k in ("message", "detail", "error", "code"):
            v = payload.get(k)
            if v:
                return str(v)
    t = (resp.text or "").strip()
    return t[:200] or f"MoMo request failed ({resp.status_code})"


def env_values(subscription_key: str, base: str, api_user: str, api_key: str) -> dict[str, str]:
    """Every MOMO_* variable backend/app/config.py reads, ready to paste."""
    values = {
        "MOMO_ENABLED": "true",
        "MOMO_BASE_URL": base,
        "MOMO_SUBSCRIPTION_KEY": subscription_key,
        "MOMO_API_USER": api_user,
        "MOMO_API_KEY": api_key,
        "MOMO_TARGET_ENVIRONMENT": os.getenv("MOMO_TARGET_ENVIRONMENT") or "sandbox",
        "MOMO_CURRENCY": os.getenv("MOMO_CURRENCY") or "EUR",
        "MOMO_MSISDN_COUNTRY_CODE": os.getenv("MOMO_MSISDN_COUNTRY_CODE") or "234",
    }
    callback = os.getenv("MOMO_CALLBACK_BASE_URL") or ""
    if callback:
        values["MOMO_CALLBACK_BASE_URL"] = callback
    return values


def upsert_env(path: Path, values: dict[str, str]) -> None:
    """Insert or replace the given keys in a .env file, keeping other lines."""
    text = path.read_text(encoding="utf-8") if path.exists() else ""
    newline = "\r\n" if "\r\n" in text else "\n"
    lines = text.splitlines()
    remaining = dict(values)
    for i, line in enumerate(lines):
        name, sep, _ = line.partition("=")
        if sep and name.strip() in remaining:
            lines[i] = f"{name.strip()}={remaining.pop(name.strip())}"
    if remaining:
        if lines and lines[-1].strip():
            lines.append("")
        lines.extend(f"{name}={value}" for name, value in remaining.items())
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(newline.join(lines) + newline, encoding="utf-8")


async def provision(base: str, key: str) -> tuple[str | None, str | None, str | None]:
    """Create the API user + key.

    Returns ``(api_user, api_key, error)`` — ``error`` is set (and both values
    are ``None``) when MTN rejects the request.
    """
    api_user = str(uuid.uuid4())
    headers_key = {"Ocp-Apim-Subscription-Key": key}

    async with httpx.AsyncClient(timeout=20.0) as client:
        # Create API user
        r = await client.post(
            f"{base}/v1_0/apiuser",
            headers={**headers_key, "X-Reference-Id": api_user, "Content-Type": "application/json"},
            json={"providerCallbackHost": callback_host()},
        )
        if r.status_code not in (201,):
            return None, None, f"POST /v1_0/apiuser failed ({r.status_code}): {_extract_error(r)}"

        # Create API key
        r2 = await client.post(f"{base}/v1_0/apiuser/{api_user}/apikey", headers=headers_key)
        if r2.status_code not in (200, 201):
            return None, None, (
                f"POST /v1_0/apiuser/{{id}}/apikey failed ({r2.status_code}): "
                f"{_extract_error(r2)}"
            )
        data = _safe_json(r2) or {}
        api_key = data.get("apiKey")
        if not api_key:
            return None, None, "MoMo did not return apiKey"
        return api_user, api_key, None


async def main(
    write: bool,
    env_file: Path,
    retry: int = 1,
    interval: float = 60.0,
) -> int:
    """Provision, retrying while the MTN sandbox is unavailable.

    ``--retry N`` attempts the sandbox N times (waiting ``--interval`` seconds
    between tries) so a scheduled run can catch the sandbox when it recovers.
    """
    load_env()
    key = subscription_key()
    b = base_url()

    attempts = max(1, retry)
    api_user = api_key = None
    for attempt in range(1, attempts + 1):
        api_user, api_key, error = await provision(b, key)
        if error is None:
            break
        print(f"[{attempt}/{attempts}] {error}", file=sys.stderr)
        if attempt < attempts:
            print(f"Retrying in {interval:.0f}s...", file=sys.stderr)
            await asyncio.sleep(interval)
    else:
        print(
            "MTN sandbox is still unavailable - re-run later or schedule this "
            "script (see scripts/README.md).",
            file=sys.stderr,
        )
        return 1

    values = env_values(key, b, api_user, api_key)
    print("MoMo provisioning succeeded.", file=sys.stderr)
    for name, value in values.items():
        print(f"{name}={value}")
    if write:
        upsert_env(env_file, values)
        print(f"\nUpdated {env_file} - redeploy so the new env vars take effect.")
    else:
        print("\n=== Copy the block above into backend/.env or your Render env vars ===")
        print("Re-run with --write to update the target env file automatically.")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Provision MTN MoMo sandbox credentials and generate the MOMO_* env vars."
    )
    parser.add_argument("--write", action="store_true", help="upsert the values into the env file")
    parser.add_argument(
        "--env-file",
        type=Path,
        default=Path(__file__).resolve().parents[1] / ".env",
        help=".env file to read from and (with --write) to update",
    )
    parser.add_argument(
        "--retry",
        type=int,
        default=1,
        help="number of attempts before giving up (default 1)",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=60.0,
        help="seconds to wait between attempts when --retry > 1 (default 60)",
    )
    args = parser.parse_args()
    raise SystemExit(asyncio.run(main(args.write, args.env_file, args.retry, args.interval)))
