# InteliScrap AI

Empowering Informal Recyclers, laboratory cleaners, office cleaners and general cleaners with Multimodal Edge Intelligence

**Team Nexus — Build with Gemma Hackathon (ABU Zaria)**

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [System Components](#system-components)
4. [Prerequisites](#prerequisites)
5. [Quick Start](#quick-start)
6. [Running with Ollama (Real Gemma 4)](#running-with-ollama-real-gemma-4)
7. [Running Without Ollama (Mock Mode)](#running-without-ollama-mock-mode)
8. [Voice System (TTS)](#voice-system-tts)
9. [Dual-Mode Inference](#dual-mode-inference)
10. [Demo Flow for Hackathon](#demo-flow-for-hackathon)
11. [API Endpoints](#api-endpoints)
12. [Testing](#testing)
13. [Troubleshooting](#troubleshooting)
14. [Deployment](#deployment)
15. [Project Structure](#project-structure)

---

## Overview

InteliScrap AI is an offline-first Progressive Web Application (PWA) that helps informal waste recyclers (Baban Bola) in Northern Nigeria identify scrap materials, detect hazardous substances, and determine fair market prices — all without internet access.

The application uses Google Gemma 4 (via Ollama or WebLLM) to analyze photos of scrap materials on-device, providing instant safety warnings and pricing in Hausa or Nigerian Pidgin.

### Core Problem
- Waste pickers handle toxic e-waste without knowing the dangers
- Middlemen exploit lack of material knowledge to underpay
- No access to real-time scrap pricing

### Solution
- Snap a photo → Gemma 4 classifies the material → shows fair price → reads safety warnings in local language
- Works entirely offline after initial setup
- PWA installs on any smartphone

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Android Phone (PWA)                │
│  ┌─────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Camera  │  │ IndexedDB│  │ WebLLM (Gemma 4)  │  │
│  │ Capture │──┤ (offline │  │  (if WebGPU)      │  │
│  │         │  │  scans)  │  └────────┬──────────┘  │
│  └────┬────┘  └──────────┘           │              │
│       │                              │              │
│       ▼                              ▼              │
│  ┌──────────────────────────────────────────────┐   │
│  │         useGemma.ts (dual-mode)              │   │
│  │  WebLLM (in-browser)  OR  Ollama (backend)  │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS (or localhost)
                       ▼
┌──────────────────────────────────────────────────────┐
│              FastAPI Backend (Python)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │  Sync    │  │  Prices  │  │ Analyze Proxy    │   │
│  │  API     │  │  Matrix  │  │ → Ollama:11434   │   │
│  └──────────┘  └──────────┘  └────────┬─────────┘   │
│                                        │              │
│  ┌─────────────────────────────────────┴──────────┐  │
│  │  PostgreSQL / SQLite                          │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │  Ollama Server │
              │  (localhost)   │
              │  ┌──────────┐  │
              │  │ Gemma 4  │  │
              │  │ Model    │  │
              │  └──────────┘  │
              └────────────────┘
```

---

## System Components

### Frontend (React PWA + Vite + TypeScript + Tailwind)
- **CameraCapture** — Activates device camera or accepts image upload
- **useGemma** — Dual-mode inference engine (WebLLM in-browser OR backend Ollama proxy)
- **useAudioTTS** — Text-to-speech in Hausa/Pidgin via Google TTS proxy
- **IndexedDB (Dexie.js)** — Offline scan persistence, survives browser close
- **PWA Service Worker** — Caches assets and API responses for offline use
- **Sync Engine** — Queues scans offline, uploads when connectivity returns

### Backend (FastAPI + SQLAlchemy + PostgreSQL/SQLite)
- **Sync API** — Bidirectional scan synchronization with conflict resolution (newer timestamp wins)
- **Price Matrix** — Material → price per kg in Naira, cached locally
- **User Management** — Phone-number-based registration
- **Analyze Proxy** — Forwards images to Ollama, returns structured JSON
- **TTS Proxy** — Fetches audio from Google Translate TTS, returns MP3
- **Health Check** — Database connectivity monitoring

### AI Layer (Gemma 4 via Ollama or WebLLM)
- **Ollama Path** — Used in development / laptop demo. Runs Gemma 4 as a local server
- **WebLLM Path** — Used in production / phone demo. Runs Gemma 4 in-browser via WebGPU
- **Fallback** — Random mock results when neither model is available

---

## Prerequisites

| Dependency | Version | Required For |
|---|---|---|
| Node.js | >=18 | Frontend (React PWA) |
| npm | >=9 | Package management |
| **Python** | **3.11 or 3.12 (64-bit ONLY)** | Backend (FastAPI) |
| pip | >=23 | Python packages |
| Ollama | latest | Real Gemma 4 inference |

> ⚠️ **CRITICAL WINDOWS SETUP WARNINGS:**
>
> 1. **Do NOT use Python 3.14 (or pre-releases):** Pre-compiled binary wheels (`.whl`) are not yet available on PyPI for Python 3.14. Installing packages like `pydantic-core` will attempt to compile from source and fail without C++/Rust tools.
> 2. **Install 64-bit (amd64) Python ONLY:** If you accidentally install the 32-bit (`win32`) Python installer, package installations like `httptools` and `greenlet` will fail with errors demanding `Microsoft Visual C++ 14.0 or greater is required`. Download the **64-bit Windows installer (x86-64)** from Python's official download page.
> 3. **Add Python to PATH:** Ensure you check the box **"Add python.exe to PATH"** on the first screen of the Python installer.

### Optional (for production deployment)
- PostgreSQL 15+ (SQLite used in development)
- ngrok (for HTTPS demo on phone)

---

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/IntelliScrap.git
cd IntelliScrap
```

### 2. Set Up and Start the Backend

Open Command Prompt (`cmd.exe`) or terminal:

```bash
cd backend

# 1. Verify you are using 64-bit Python 3.12
py -3.12 --version

# 2. Create an isolated virtual environment
py -3.12 -m venv .venv

# 3. Activate the virtual environment
# On Windows Command Prompt (cmd.exe):
.venv\Scripts\activate

# On Windows PowerShell:
# .venv\Scripts\Activate.ps1

# On Linux/macOS:
# source .venv/bin/activate

# 4. Upgrade pip inside the environment
python -m pip install --upgrade pip

# 5. Install backend dependencies
pip install -r requirements.txt

# 6. Run the FastAPI backend server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Verify: Open http://localhost:8000/docs — you should see the FastAPI Swagger UI.

### 3. Set Up and Start the Frontend

Open a **new** terminal window:

```bash
cd frontend

# 1. Install Node modules
npm install

# 2. Start the Vite development server
npx vite --host 0.0.0.0 --port 5173
```

Verify: Open http://localhost:5173 — you should see the InteliScrap AI app.

### 4. Test the App

At this point the app runs entirely with mock data (no real analysis). Upload any image and you'll receive a random result from a pool of 8 material types. This is useful for testing the UI flow.

---

## Running with Ollama (Real Gemma 4)

### 1. Install Ollama

Download from https://ollama.com and install.

### 2. Pull the Gemma 4 Model

Run the following command in your terminal:

```bash
ollama pull gemma4:e2b
```

### 3. Run the Model

```bash
ollama run gemma4:e2b
```

Keep this terminal window open. Ollama serves on http://localhost:11434.

### 4. Start Backend + Frontend

```bash
# Terminal 1: Ollama (already running)
ollama run gemma4:e2b

# Terminal 2: Backend (inside .venv)
cd backend
.venv\Scripts\activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 3: Frontend
cd frontend
npx vite --host 0.0.0.0 --port 5173
```

### 5. How It Works

```
Upload photo → Frontend /api/analyze → Backend → Ollama :11434 → Gemma 4 → structured JSON → displayed
```

The app first tries WebLLM (in-browser). If WebGPU is unavailable, it falls back to the backend's Ollama proxy. Both paths return the same result format.

---

## Running Without Ollama (Mock Mode)

Without Ollama, the backend's `/api/v1/analyze` endpoint returns 502 (Ollama unreachable). The frontend catches this and falls back to a random mock result.

```
Upload photo → Frontend tries WebLLM → fails (no WebGPU)
            → Backend tries Ollama → fails (502)
            → Frontend picks random result from mock pool
            → Displays on screen with simulated confidence
```

The mock pool contains 8 material types (Copper, Lead-Acid Battery, Aluminum, Lithium-Ion, PET Plastic, E-Waste Board, Rubber, Glass) with realistic hazard mappings.

---

## Voice System (TTS)

### Architecture

```
Frontend "Read Aloud" button
  → Creates <audio> element with src="/api/v1/tts?text=...&lang=ha"
  → Vite dev server proxies /api/ to backend
  → Backend fetches MP3 from Google Translate TTS
  → Returns audio/mpeg to frontend
  → Browser plays it
```

### Fallback Chain

1. **Google TTS (via backend proxy)** — Native Hausa/Nigerian English accent. Requires internet on the backend. This is what produces authentic voice.
2. **Browser Speech Synthesis** — Uses OS voices with `lang="ha-NG"` or `lang="en-NG"`. On Android (target device), Google TTS provides native Hausa voices. On Windows without Hausa language pack, it falls back to whatever is available.

### Language Support

- **Hausa**: Google TTS language code `ha`, Web Speech `ha-NG`
- **Nigerian Pidgin**: Google TTS language code `en`, Web Speech `en-NG`

The locale files (`locales/ha.json`, `locales/pcm.json`) contain full dictionaries for:
- 15 hazard types (corrosive acid, lead poisoning, mercury exposure, etc.)
- 17 material names
- 8 safety instruction templates

---

## Dual-Mode Inference

The `useGemma` hook handles two inference paths transparently:

| Mode | Requirements | How It Works |
|---|---|---|
| **WebLLM** | Chrome 113+, WebGPU, Android 12+ | Downloads Gemma model (~700MB) to browser on first visit. Runs entirely in-browser via Web Worker. Zero backend dependency. Used in production deployment. |
| **Ollama Proxy** | Ollama running on backend machine | Sends image to backend `/api/v1/analyze`. Backend proxies to `localhost:11434`. Used in development / laptop demo. |

On first analysis call, the hook probes WebLLM availability:
- If WebLLM succeeds → caches that decision, uses WebLLM for all future calls
- If WebLLM fails → switches to Ollama proxy permanently for the session

This means the app works identically whether deployed (WebLLM) or running locally (Ollama). No code changes needed.

---

## Demo Flow for Hackathon

```
00:00 - App loads on phone (offline)
00:15 - Snap photo of scrap material
00:30 - Gemma 4 analyzes and returns result
00:50 - Read Aloud plays in Hausa
01:10 - Browse history of past scans
01:30 - Navigate settings, toggle language
01:45 - Show PWA installed on home screen
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Database connectivity check |
| POST | `/api/v1/sync` | Upload local scans, get updated prices |
| POST | `/api/v1/users/register` | Register user by phone number |
| GET | `/api/v1/users/{id}` | Get user details |
| GET | `/api/v1/prices` | List all material prices |
| PUT | `/api/v1/prices/{class}` | Update price for a material |
| POST | `/api/v1/analyze` | Send image for Gemma 4 analysis |
| GET | `/api/v1/tts` | Text-to-speech audio proxy |
| GET | `/docs` | Swagger API documentation |

### POST /api/v1/analyze

```json
// Request
{ "image_base64": "<base64-encoded JPEG, no data: prefix>" }

// Response (200)
{
  "material_class": "Lead-Acid Battery",
  "confidence": 0.94,
  "toxicity_hazards": ["corrosive_acid", "lead_poisoning"],
  "safety_instructions": "Do not break open. Avoid skin contact.",
  "estimated_value": 1500
}
```

### GET /api/v1/tts

```
/api/v1/tts?text=An+gano+Copper&lang=ha
→ Response: audio/mpeg (binary MP3 data)
```

---

## Testing

```bash
cd backend
# Ensure virtual environment is active (.venv\Scripts\activate)
pytest -v
```

Tests cover:
- Health check endpoint
- Sync with empty scans
- Sync with single scan
- Sync idempotency (duplicate scans don't create duplicates)
- Sync conflict resolution (newer data wins)
- Deleted scan propagation

---

## Troubleshooting

| Problem | Cause | Solution |
|---|---|---|
| `Microsoft Visual C++ 14.0 or greater is required` during `pip install` | You are using 32-bit Python or Python 3.14+. PyPI lacks pre-compiled wheels for these versions. | Uninstall 32-bit Python. Install Python 3.12 64-bit (x86-64). Delete your `.venv` folder, re-create it (`py -3.12 -m venv .venv`), and run `pip install -r requirements.txt`. |
| `Error: pull model manifest: file does not exist` | Invalid Ollama model tag or outdated Ollama version. | Ensure Ollama is running up-to-date and verify model tag availability using `ollama pull gemma4:e2b`. |
| Backend returns 502 on `/api/v1/analyze` | Ollama isn't running on port 11434. | Open a terminal and start it with `ollama run gemma4:e2b`. If Ollama is off, the app automatically uses mock mode. |
| `.venv\Scripts\activate` fails on PowerShell | Execution Policy blocking scripts. | Run in standard CMD (`cmd.exe`), or run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process` in PowerShell. |
| Frontend shows "Loading AI model..." forever | The WebLLM probe is stuck or WebGPU is unsupported. | Refresh the page. The app falls back to backend proxy or mock after timeout. |
| Camera button does nothing | Camera permissions blocked or unsupported mode. | Try selecting "Upload Image" instead. |
| TTS sounds Chinese | No native Hausa voice installed in local browser OS. | Google TTS proxy (backend) handles native voices — ensure the backend is running. |
| Scans show "Pending" forever | Backend offline or internet disconnected. | The sync button manually triggers upload once connected. |
| `pip install asyncpg` fails | Missing C++ tools on Windows. | Use SQLite (default in local development config). |
| `npm install` hangs / ETARGET error | Corrupted npm cache. | Clear cache: `npm cache clean --force && npm install`. |

---

## Deployment

### Frontend (Vercel / Netlify)

```bash
cd frontend
npm run build
# Deploy the dist/ folder to your hosting provider
```

### Backend (Render / Railway)

```bash
cd backend
# Set environment variable: DATABASE_URL=postgresql+asyncpg://...
# Start command: uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Docker

```bash
docker compose up
```

This starts three containers: backend (FastAPI), frontend (Vite), and PostgreSQL.

---

## Project Structure

```
IntelliScrap/
├── backend/                          # Member 1 (Backend Lead)
│   ├── app/
│   │   ├── main.py                   # FastAPI entry, lifespan, router aggregation
│   │   ├── config.py                 # Pydantic settings from environment
│   │   ├── database.py               # Async SQLAlchemy engine + session factory
│   │   ├── models.py                 # ORM: User, ScrapScan, PriceMatrix
│   │   ├── schemas.py                # Pydantic v2 request/response models
│   │   ├── api/
│   │   │   ├── analyze.py            # POST /api/v1/analyze (Gemma 4 proxy)
│   │   │   ├── health.py             # GET /health
│   │   │   ├── prices.py             # GET/PUT price matrix
│   │   │   ├── sync.py               # POST /api/v1/sync (bidirectional)
│   │   │   ├── tts.py                # GET /api/v1/tts (Google TTS proxy)
│   │   │   └── users.py              # POST/GET user management
│   │   ├── services/
│   │   │   ├── analyze_service.py    # Ollama API call + prompt template
│   │   │   ├── price_service.py      # Price matrix upsert logic
│   │   │   ├── sync_service.py       # Conflict resolution (timestamp wins)
│   │   │   └── user_service.py       # User CRUD
│   │   └── middleware/
│   │       └── cors.py               # CORS configuration
│   ├── tests/
│   │   ├── conftest.py               # Async test fixtures (SQLite)
│   │   ├── test_health.py
│   │   └── test_sync.py              # Idempotency + conflict tests
│   ├── alembic/                      # Database migrations
│   ├── requirements.txt
│   ├── pyproject.toml
│   ├── Dockerfile
│   └── Dockerfile.dev
│
├── frontend/                         # Member 2 (Frontend/PWA Architect)
│   ├── src/
│   │   ├── main.tsx                  # Entry point
│   │   ├── App.tsx                   # Router + AppProvider
│   │   ├── index.css                 # Tailwind + custom component classes
│   │   ├── types/index.ts            # All TypeScript interfaces
│   │   ├── services/
│   │   │   ├── db.ts                 # Dexie.js IndexedDB schema
│   │   │   ├── sync.ts              # API sync client
│   │   │   └── camera.ts            # WebRTC + file upload utilities
│   │   ├── hooks/
│   │   │   ├── useGemma.ts           # Dual-mode inference (WebLLM / Ollama)
│   │   │   ├── useAudioTTS.ts        # TTS with backend proxy fallback
│   │   │   └── useSync.ts           # Scan sync orchestration
│   │   ├── store/
│   │   │   ├── appStore.ts           # Context definition
│   │   │   └── AppProvider.tsx       # useReducer-based state provider
│   │   ├── pages/
│   │   │   ├── ScanPage.tsx          # Camera/upload → analysis → result
│   │   │   ├── HistoryPage.tsx       # Past scans with sync status
│   │   │   └── SettingsPage.tsx      # Language, voice test, about
│   │   ├── components/
│   │   │   ├── Camera/
│   │   │   │   └── CameraCapture.tsx # Camera + upload with fallbacks
│   │   │   ├── Scanner/
│   │   │   │   └── ScanResult.tsx    # Material class, hazards, price, TTS
│   │   │   ├── Layout/
│   │   │   │   ├── AppShell.tsx      # Online/offline detection + layout
│   │   │   │   ├── Header.tsx        # Brand + connectivity indicator
│   │   │   │   └── BottomNav.tsx     # Tab navigation (Scan, History, Settings)
│   │   │   └── UI/
│   │   │       ├── LoadingSpinner.tsx # Progress-indicating spinner
│   │   │       └── HazardBadge.tsx   # Color-coded hazard level badge
│   │   ├── locales/
│   │   │   ├── ha.json              # Hausa hazard/safety/phrases dictionary
│   │   │   └── pcm.json             # Pidgin hazard/safety/phrases dictionary
│   │   └── utils/
│   │       ├── formatters.ts        # Currency, confidence, date formatters
│   │       └── offline.ts           # Online/offline hook
│   ├── public/
│   │   └── icons/                   # PWA app icons (192x192, 512x512)
│   ├── hooks/
│   │   └── gemmaWorker.ts           # Web Worker for WebLLM (Member 3)
│   ├── vite.config.ts               # + VitePWA plugin + API proxy
│   ├── tailwind.config.js           # Brand colors + hazard color tokens
│   ├── tsconfig.json
│   ├── package.json
│   ├── nginx.conf                   # Production nginx config
│   ├── Dockerfile                   # Multi-stage production build
│   └── Dockerfile.dev
│
├── .github/workflows/
│   └── ci.yml                      # GitHub Actions (backend tests + frontend build)
├── docker-compose.yml              # Local dev orchestration
├── .gitignore
└── README.md
```

### Team Member Ownership

| Member | Role | Files |
|---|---|---|
| Member 1 | Lead Backend & Database Engineer | `backend/app/main.py`, `models.py`, `database.py`, `schemas.py`, `api/sync.py`, `api/users.py`, `api/prices.py`, `api/analyze.py`, `api/tts.py`, `services/` |
| Member 2 | Frontend & PWA Architect | `frontend/src/App.tsx`, `main.tsx`, `services/`, `store/`, `pages/`, `components/Layout/`, `components/Camera/`, `components/Scanner/`, `utils/` |
| Member 3 | Edge AI & Local ML Engineer | `frontend/src/hooks/useGemma.ts`, `frontend/src/hooks/gemmaWorker.ts`, `backend/app/services/analyze_service.py` |
| Member 4 | Accessibility & Audio Engineer | `frontend/src/hooks/useAudioTTS.ts`, `frontend/src/locales/` |
| Member 5 | QA, DevOps & Sync Engineer | `backend/tests/`, `docker-compose.yml`, `.github/workflows/`, `Dockerfile` files, sync conflict logic |

---

## License

Apache 2.0 — Built for the Build with Gemma Hackathon 2026.
