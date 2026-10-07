#!/usr/bin/env bash
# NixOS-friendly launcher: exposes libstdc++ for prebuilt wheels (greenlet,
# asyncpg), activates .venv, and starts the FastAPI backend.
#
# Usage:
#   ./run.sh                          # uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
#   ./run.sh app.main:app --port 9000 # pass your own uvicorn args
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
    echo "No .venv found. Create it first:"
    echo "  nix shell nixpkgs#python312 -c python3 -m venv .venv"
    echo "  source .venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

# NixOS: prebuilt wheels (greenlet, asyncpg) need libstdc++.so.6, which is not
# on the default library path. Must be set before python starts.
if [ -z "${INTELISCRAP_LDPATH_SET:-}" ] && [ -d /nix/store ]; then
    _gcc_lib=""
    if command -v nix >/dev/null 2>&1; then
        _gcc_lib="$(nix build --no-link --print-out-paths nixpkgs#stdenv.cc.cc.lib 2>/dev/null | tail -n1)" || _gcc_lib=""
    fi
    if [ -z "${_gcc_lib}" ] || [ ! -d "${_gcc_lib}/lib" ]; then
        _gcc_lib="$(printf '%s\n' /nix/store/*-gcc-*-lib 2>/dev/null | tail -n1)" || _gcc_lib=""
    fi
    if [ -n "${_gcc_lib}" ] && [ -d "${_gcc_lib}/lib" ]; then
        export LD_LIBRARY_PATH="${_gcc_lib}/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
        export INTELISCRAP_LDPATH_SET=1
    fi
    unset _gcc_lib
fi

# Always activate (idempotent) — never trust a pre-set VIRTUAL_ENV.
# shellcheck disable=SC1091
source .venv/bin/activate

if [ "$#" -eq 0 ]; then
    set -- app.main:app --host 0.0.0.0 --port 8000 --reload
fi

exec python -m uvicorn "$@"
