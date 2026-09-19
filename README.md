# InteliScrap AI

Empowering Informal Recyclers, laboratory cleaners, office cleaners and general cleaners with Multimodal Edge Intelligence

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [System Components](#system-components)
4. [Prerequisites](#prerequisites)
5. [Quick Start](#quick-start)
8. [Voice System (TTS)](#voice-system-tts)
9. [Dual-Mode Inference](#dual-mode-inference)
11. [API Endpoints](#api-endpoints)
12. [Testing](#testing)
13. [Troubleshooting](#troubleshooting)
14. [Deployment](#deployment)
15. [Project Structure](#project-structure)

---

## Overview

InteliScrap AI is an offline-first Progressive Web Application (PWA) that helps informal waste recyclers (Baban Bola) in Northern Nigeria identify scrap materials, detect hazardous substances, and determine fair market prices — all without internet access.

The application uses an on-device ONNX image classifier to analyze photos of scrap materials on-device — instantly showing the material type, safety hazards, and fair pricing in Hausa, Nigerian Pidgin, or English. When the on-device model is unavailable and the phone is online, the backend runs a vision model over Ollama. If neither is available, the app honestly asks the collector to select the material manually — it **never fabricates** a result.

### Core Problem
- Waste pickers handle toxic e-waste without knowing the dangers
- Middlemen exploit lack of material knowledge to underpay
- No access to real-time scrap pricing

### Solution
- Snap a photo → on-device AI (or server vision model) classifies the material → shows fair price → reads safety warnings in the local language
- Works offline via on-device ONNX + cached prices; manual material selection as a last-resort fallback
- PWA installs on any smartphone; feature-phone users get USSD registration, location, and SMS pickup notifications

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Android Phone (PWA)                │
│  ┌─────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Camera  │  │ IndexedDB│  │ ONNX classifier   │  │
│  │ Capture │──┤ (offline │  │  (edge, wasm)     │  │
│  │         │  │  scans)  │  └────────┬──────────┘  │
│  └────┬────┘  └──────────┘           │              │
│       │                              │              │
│       ▼                              ▼              │
│  ┌──────────────────────────────────────────────┐   │
│  │   services/analysis.ts (fallback chain)      │   │
│  │   ONNX edge → server /analyze → manual pick  │   │
│  └──────────────────────┬───────────────────────┘   │
└─────────────────────────┬───────────────────────────┘
                          │ HTTPS (or localhost)
                          ▼
┌──────────────────────────────────────────────────────┐
│              FastAPI Backend (Python)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │  Sync    │  │  Prices  │  │ /api/v1/analyze  │   │
│  │  API     │  │  Matrix  │  │ → Ollama vision  │   │
│  │          │  │          │  │  model (llava)   │   │
│  └──────────┘  └────┬─────┘  └────────┬─────────┘   │
│  ┌──────────────────┴───┐  ┌─────────┴─────────┐    │
│  │ PostgreSQL / SQLite  │  │ USSD + SMS outbox │    │
│  └──────────────────────┘  └───────────────────┘    │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
               ┌────────────────┐
               │  Ollama Server │
               │  (localhost)   │
               │  ┌──────────┐  │
               │  │ llava:13b│  │
               │  │ (config) │  │
               │  └──────────┘  │
               └────────────────┘
```

---

## System Components

### Frontend (React PWA + Vite + TypeScript + Tailwind)
- **CameraCapture** — Activates device camera or accepts image upload
- **vision/visionEngine** — On-device ONNX scrap classifier (runs in-browser via onnxruntime-web wasm)
- **vision/visionEngineRuntime** — Offline runtime model via transformers.js (zero-shot CLIP) as a secondary on-device path
- **services/analysis** — Fallback chain: bundled ONNX → server `/api/v1/analyze` → runtime model → manual material selection (never mocks)
- **ManualMaterialSelect** — Honest manual picker when no AI path is available offline
- **useAudioTTS** — Text-to-speech in Hausa/Pidgin via Google TTS proxy
- **IndexedDB (Dexie.js)** — Offline scan persistence, survives browser close
- **PWA Service Worker** — Caches assets and API responses for offline use
- **Sync Engine** — Queues scans offline, uploads when connectivity returns
- **Dark mode** — Class-based theme with light/dark toggle, persisted and system-aware

### Backend (FastAPI + SQLAlchemy + PostgreSQL/SQLite)
- **Sync API** — Bidirectional scan synchronization with conflict resolution (newer timestamp wins)
- **Price Matrix** — Material → price per kg in Naira, cached locally
- **User Management** — Phone-number-based registration + JWT auth
- **Analyze Proxy** — Forwards images to Ollama (configurable model), returns structured JSON
- **USSD Handler** — Feature-phone self-registration + preset-location menus (no smartphone needed)
- **SMS Outbox** — Africa's Talking SMS notifications (`sms.new_offer`, `sms.location`) with retry worker
- **H3 Matcher** — Uber H3 hex-grid dispatch of offers to nearby collectors
- **TTS Proxy** — Fetches audio from Google Translate TTS, returns MP3
- **Recycling Hubs** — Hub registration, monthly subscriptions, daily buy requests with live progress tracking
- **Compliance Manifests** — API-key-protected traceability export for PROs / recyclers / FG (EPR audits)
- **Hub Delivery Traceability** — Settled collections linked to the hub request they fulfill
- **Health Check** — Database connectivity monitoring

### AI Layer (fallback chain)
1. **Bundled ONNX** — `vision/visionEngine` classifies the photo in-browser (works fully offline)
2. **Server vision model** — When online and edge inference is unavailable, the backend calls Ollama with `OLLAMA_VISION_MODEL` (default `llava:13b`, configurable via env)
3. **Runtime model (transformers.js)** — Offline fallback that downloads a zero-shot CLIP once (cached locally), trusted above a confidence threshold
4. **Manual selection** — If no AI path succeeds, the collector picks the material from the visible scrap classes; the result is never fabricated

---

## Prerequisites

| Dependency | Version | Required For |
|---|---|---|
| Node.js | >=18 | Frontend (React PWA) |
| npm | >=9 | Package management |
| **Python** | **3.11 or 3.12 (64-bit ONLY)** | Backend (FastAPI) |
| pip | >=23 | Python packages |
| Ollama | latest | Configurable server-side vision model (`llava:13b` default) |

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

Snap or upload any image. The app runs the bundled ONNX classifier first; if no model is in `frontend/public/models/`, it goes to the server `/api/v1/analyze` when online, then to the on-device runtime model (transformers.js, offline-capable after one download), and finally offers an honest **manual material picker** — there is no random/mock result ever.

---

## Running with Ollama (Server Vision Model)

### 1. Install Ollama

Download from https://ollama.com and install.

### 2. Pull the Vision Model

Run the following command in your terminal:

```bash
ollama pull llava:13b
```

### 3. Run the Model

```bash
ollama run llava:13b
```

Keep this terminal window open. Ollama serves on http://localhost:11434.

The model is configurable via the `OLLAMA_VISION_MODEL` environment variable (and `OLLAMA_BASE_URL` for a remote Ollama host). Set them in `backend/.env`:

```bash
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_VISION_MODEL=llava:13b
```

### 4. Start Backend + Frontend

```bash
# Terminal 1: Ollama (already running)
ollama run llava:13b

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
Upload photo → services/analysis.ts
  → ONNX edge classifier (if bundled) → done
  → POST /api/v1/analyze → Ollama :11434 → llava:13b → structured JSON → displayed
  → Manual material selection (offline, no model available)
```

---

## Running Without Ollama (Offline / No Model)

When no AI model is reachable — no bundled ONNX, backend Ollama down, and the runtime model not yet downloaded or below the confidence threshold — the app shows a **manual material selection grid** built from the trade-rule knowledge base. Results from this path use `source: "manual"` and are presented honestly (zero AI confidence), so a pickup request can still be posted.

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

## Analysis Fallback Chain

`services/analysis.ts` resolves the analysis source transparently:

| Path | Requirements | How It Works |
|---|---|---|
| **Bundled ONNX classifier** | `frontend/public/models/mobilenetv4_scrap_int8.onnx` present | Runs the (ideally scrap-tuned) classifier in-browser via onnxruntime-web (wasm). Fully offline, no backend. Results carry `source: "onnx"`. |
| **Server `/api/v1/analyze`** | `navigator.onLine` + Ollama reachable | POSTs the base64 image; the backend proxies to Ollama (`OLLAMA_VISION_MODEL`). Results carry `source: "server"`. |
| **Runtime model (transformers.js)** | Offline; first run needs to download once from Hugging Face (cached) | Zero-shot CLIP matches the photo against the 8 scrap categories in the browser. Only trusted when the top match clears a confidence threshold; falls through otherwise. Results carry `source: "onnx"`. |
| **Manual selection** | No AI path available | The app never fabricates — it shows the scrap-classes grid and stores the pick with `source: "manual"` and zero AI confidence. |

Every result carries a `source` field so collectors can trust what they're seeing.

---

## Bundling a Real Scrap Classifier (Training)

The bundled edge model is what makes the app accurate and fully offline. A training pipeline lives in `training/`:

```
training/
├── data/train/<slug>/    # e.g. data/train/copper/*.jpg, data/train/lead-battery/*.jpg
├── data/val/<slug>/      # same 8 slugs: copper, aluminum, pet-plastic, lead-battery, brass, steel, e-waste, glass
├── train.py              # fine-tunes MobileNetV4 (or MobileNetV3 fallback) → exports int8 ONNX
└── verify_model.py       # checks input/output shape + class order match classes.json
```

Run it once you have labeled photos (a few hundred per class):

```
pip install -r training/requirements.txt
python training/train.py --data training/data --out frontend/public/models/mobilenetv4_scrap_int8.onnx
python training/verify_model.py --image path/to/test_photo.jpg
```

The exported model must satisfy the browser contract: float32 `[1, 3, 224, 224]` ImageNet-normalized input, one output of 8 logits whose index order equals `frontend/public/models/classes.json`. Trained output goes straight to `frontend/public/models/mobilenetv4_scrap_int8.onnx`; a `prebuild` step already copies the onnxruntime wasm to `public/ort/` so edge inference runs on deploy.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Database connectivity check |
| POST | `/api/v1/sync` | Upload local scans, get updated prices |
| POST | `/api/v1/auth/otp/request` | Request SMS OTP for phone login |
| POST | `/api/v1/auth/otp/verify` | Verify OTP, receive JWT access token |
| GET | `/api/v1/auth/me` | Current authenticated user |
| POST | `/api/v1/users/register` | Register user by phone number |
| PATCH | `/api/v1/users/me/location` | Update own coordinates (indexes collector into H3 hex grid) |
| GET | `/api/v1/users/{id}` | Get user details |
| GET | `/api/v1/prices` | List all material prices |
| PUT | `/api/v1/prices/{class}` | Update price for a material |
| GET | `/api/v1/materials` | List material categories (slug, name, price, hazardous flag) |
| POST | `/api/v1/analyze` | Send image for vision-model analysis (Ollama) |
| GET | `/api/v1/tts` | Text-to-speech audio proxy |
| POST | `/api/v1/listings` | Create a scrap listing from a scan (auto-dispatches to nearby collectors) |
| GET | `/api/v1/listings` | List active listings |
| GET | `/api/v1/listings/{listing_id}` | Get a single listing |
| POST | `/api/v1/pickups/offers` → GET `/api/v1/pickups/offers` | Offers dispatched to the current collector (H3 disk ring) |
| POST | `/api/v1/pickups/{pickup_id}/accept` | Accept an offer (other pending offers expire) |
| GET | `/api/v1/pickups/active` | List the collector's active/accepted jobs |
| POST | `/api/v1/ussd/callback` | Africa's Talking USSD callback (registration + preset-location menus, plain-text menu) |
| GET/POST | `/api/v1/voice/*` | Voice callbacks (register/accepted pickups via IVR) |
| POST | `/api/v1/transactions` | Platform fee settlement on completed pickups |
| GET | `/api/v1/impact/*` | Impact dashboard aggregates (summary, daily, by-material) |
| GET/POST | `/api/v1/outbox/*` | SMS outbox inspection/processing |
| POST | `/api/v1/hubs/register` | Register a recycling hub (owner becomes `recycling_hub` role) |
| GET | `/api/v1/hubs/` | List active recycling hubs |
| GET | `/api/v1/hubs/me` | The current user's registered hub |
| POST | `/api/v1/hubs/requests` | Hub publishes a daily buy request (material × quantity) |
| GET | `/api/v1/hubs/requests` | Hub's own requests with live `fulfilled_kg` progress |
| GET | `/api/v1/hubs/deliveries` | Traceability: which collections/deliveries fed this hub |
| POST | `/api/v1/hubs/subscribe` | Start a hub's monthly subscription (revenue) |
| GET | `/api/v1/hubs/subscriptions` | List the hub's subscription history |
| GET | `/api/v1/compliance/manifesto` | EPR compliance export (API-key auth, `X-API-Key` header) |
| GET | `/docs` | Swagger API documentation |

### Recycling Hub + End-of-Life Traceability

Registered recycling hubs (recyclers/aggregators) publish **daily buy requests** — what quantity of which recyclable they need for that day. Collectors see it as a live public demand board:

1. Hub registers via `POST /api/v1/hubs/register` (account role becomes `recycling_hub`).
2. Hub posts a daily request: `POST /api/v1/hubs/requests` with `material_category_id`, `requested_kg`, and the date.
3. When a settled pickup's seller hub matches a registered hub **and** that hub has an open request for the same material, the settlement writes a `HubDelivery` (the traceability link) and adds the quantity to the request's `fulfilled_kg`.
4. When `fulfilled_kg >= requested_kg`, the request flips to `filled` automatically — the live progress board stays honest without manual entry.
5. Hubs pay a **monthly subscription** (`POST /api/v1/hubs/subscribe`, renewable `next_billing_at`) — this is the platform's primary recurring B2B revenue stream.

### Compliance Manifesto (EPR) Export

PROs, recycling companies, and FG/EPR auditors authenticate with an API key (`X-API-Key` header) against `GET /api/v1/compliance/manifesto`. The response is a read-only, auditable export of every settled collection in a date range: transaction, registered collector, material, weight, value, carbon offset, and originating hub — the source-verifiable record EPR contracts require.

### USSD Registration & Location (feature phones)

A collector can self-register without a smartphone by dialing the USSD shortcode:

1. Dial `*347*101#` (configurable). The first screen asks for **Consent & Registration**.
2. Reply `1` → the hub menu lists **6 preset hubs** (Samaru, Sabon Gari, Kongo, Bomo, Hanwa, Dutsen Abba).
3. Reply `1*N` → the backend creates a `collector` user, resolves the hub lat/lng + H3 hex, and confirms. The collector is now joinable for offers.
4. Registered callers reach the **Main Menu** including `4. Wurin da nake aiki` → `4*N` to change their work hub on the move.
5. When a new offer matches their hex, the outbox worker SMSes them, and they can **accept via USSD or IVR (voice callback)**.

The `ussd_handler` uses a `session_id`-based state machine (`_register_flow`, `_location_flow`) so a reply-only flow works on any feature phone.

### Hexagon (Uber H3) Collector Matching

When a listing is created with coordinates, the platform dispatches it using the same **hexagonal gridding pattern Uber uses** for rider–driver matching:

1. The seller's location is bucketed into an **Uber H3 hexagon** cell at resolution `H3_RESOLUTION` (default `8` ≈ 460 m cells).
2. `h3.grid_disk(origin, k)` expands the search **hexagon-by-hexagon, ring-by-ring** outward until the dispatch radius (`DISPATCH_RADIUS_M`, default 5 km) is covered.
3. Active collectors whose stored `h3_cell` falls inside that hexagon disk are candidates — no full-table distance scan.
4. Candidates are ranked by exact **haversine** distance, filtered to the radius, and the closest `DISPATCH_MAX_COLLECTORS` (default `5`) each receive a `Pickup` in `offered` status (listing → `matched`).

Collectors keep their hex bucket fresh via `PATCH /api/v1/users/me/location`, which recomputes `h3_cell`. The `h3` index is stored on `users` (`idx_users_h3_cell`) for Postgres and the on-the-fly fallback keeps SQLite/dev working identically.

**Guarantees:** a listing is only `offered` to collectors; as soon as one accepts (via **USSD** or **IVR**), the pickup becomes `accepted`, the listing moves to `scheduled`, and all other pending `offered` pickups are no longer surfaced — the listing is unavailable to every other picker.

### POST /api/v1/analyze

```json
// Request
{ "image_base64": "<base64-encoded JPEG, no data: prefix>" }

// Response (200)
{
  "material_class": "Lead-Acid Battery",
  "confidence": 0.94,
  "toxicity_hazards": ["corrosive_acid", "lead_poisoning"],
  "safety_instructions": "Do not break open. Avoid skin contact."
}
```

The frontend maps `material_class` back onto the trade-rule slug. Returns `502` when Ollama is unreachable.

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

48 tests cover: health check, sync (empty/single/idempotency/conflict/deletion), auth OTP flow, price updates, **H3 collector matching**, **USSD registration with preset hubs**, **USSD hub-location change**, pickups API, and user location updates.

```bash
cd frontend
npm run typecheck   # TypeScript strict checks
npm run build       # Production PWA build
```

---

## Troubleshooting

| Problem | Cause | Solution |
|---|---|---|
| `Microsoft Visual C++ 14.0 or greater is required` during `pip install` | You are using 32-bit Python or Python 3.14+. PyPI lacks pre-compiled wheels for these versions. | Uninstall 32-bit Python. Install Python 3.12 64-bit (x86-64). Delete your `.venv` folder, re-create it (`py -3.12 -m venv .venv`), and run `pip install -r requirements.txt`. |
| Backend returns 502 on `/api/v1/analyze` | Ollama isn't running on port 11434 or the vision model isn't pulled. | Start it with `ollama run llava:13b` (or set `OLLAMA_VISION_MODEL`/`OLLAMA_BASE_URL`). If Ollama is off, the app falls back to manual material selection. |
| Scan shows "Manual" with no AI result | No ONNX model bundled and no server reachable. | Bundle a model under `frontend/public/models/` for offline edge classification, or run Ollama. This is intentional — the app never fabricates results. |
| `.venv\Scripts\activate` fails on PowerShell | Execution Policy blocking scripts. | Run in standard CMD (`cmd.exe`), or run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process` in PowerShell. |
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
│   │   ├── config.py                 # Pydantic settings from environment (incl. Ollama + dispatch)
│   │   ├── database.py               # Async SQLAlchemy engine + session factory
│   │   ├── models.py                 # ORM: User, ScrapScan, PriceMatrix, Listing, Pickup, SmsOutbox
│   │   ├── schemas.py                # Pydantic v2 request/response models
│   │   ├── api/
│   │   │   ├── analyze.py            # POST /api/v1/analyze (Ollama vision proxy)
│   │   │   ├── auth.py               # OTP login + JWT
│   │   │   ├── health.py             # GET /health
│   │   │   ├── impact.py             # Impact dashboard aggregates
│   │   │   ├── listings.py           # Scrap listings + auto-dispatch
│   │   │   ├── materials.py          # Material categories
│   │   │   ├── outbox.py             # SMS outbox inspection/process
│   │   │   ├── pickups.py            # OFFERS / ACCEPT / ACTIVE
│   │   │   ├── prices.py             # GET/PUT price matrix
│   │   │   ├── sync.py               # POST /api/v1/sync (bidirectional)
│   │   │   ├── transactions.py       # Platform fee settlement
│   │   │   ├── tts.py                # GET /api/v1/tts (Google TTS proxy)
│   │   │   ├── users.py              # POST/GET user management + location
│   │   │   ├── ussd.py               # USSD callback endpoint
│   │   │   └── voice.py              # IVR callbacks + audio
│   │   ├── services/
│   │   │   ├── analyze_service.py    # Ollama API call + prompt template (configurable model)
│   │   │   ├── matching_service.py   # Uber H3 hex-grid, disk-ring, top-N dispatch
│   │   │   ├── outbox_service.py     # SMS outbox worker (Africa's Talking)
│   │   │   ├── price_service.py      # Price matrix upsert logic
│   │   │   ├── sync_service.py       # Conflict resolution (timestamp wins)
│   │   │   ├── user_service.py       # User CRUD + H3 index
│   │   │   └── ussd_handler.py       # USSD state machine: register, hub location, main menu
│   │   └── middleware/
│   │       └── cors.py               # CORS configuration
│   ├── tests/
│   │   ├── conftest.py               # Async test fixtures (SQLite)
│   │   ├── test_health.py
│   │   ├── test_sync.py              # Idempotency + conflict tests
│   │   ├── test_matching.py          # H3 dispatch + accept-lock tests
│   │   ├── test_auth.py              # OTP flow tests
│   │   └── test_ussd.py              # Registration + hub-location USSD tests
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
│   │   ├── index.css                 # Tailwind + component classes (dark mode, skeleton)
│   │   ├── types/index.ts            # All TypeScript interfaces (incl. VisionAnalysis.source)
│   │   ├── services/
│   │   │   ├── analysis.ts           # Fallback chain: ONNX → server → manual
│   │   │   ├── db.ts                 # Dexie.js IndexedDB schema
│   │   │   ├── sync.ts               # API sync client
│   │   │   ├── pickups.ts            # Offers/accept/active API client
│   │   │   └── camera.ts             # WebRTC + file upload utilities
│   │   ├── vision/
│   │   │   └── visionEngine.ts       # On-device ONNX classifier + scrap classes
│   │   ├── hooks/
│   │   │   ├── useVision.ts          # Analysis hook (progress + error)
│   │   │   ├── useAudioTTS.ts        # TTS with backend proxy fallback
│   │   │   └── useSync.ts            # Scan sync orchestration
│   │   ├── store/
│   │   │   ├── appStore.ts           # Context definition
│   │   │   └── AppProvider.tsx       # useReducer state (language, theme, scans)
│   │   ├── pages/
│   │   │   ├── ScanPage.tsx          # Camera/upload → analysis → result/manual
│   │   │   ├── HistoryPage.tsx       # Past scans with sync status
│   │   │   ├── PickupsPage.tsx       # Collector offers with skeletons
│   │   │   ├── MyPickupsPage.tsx     # Accepted jobs
│   │   │   └── SettingsPage.tsx      # Language, voice test, about, dark mode
│   │   ├── components/
│   │   │   ├── Camera/
│   │   │   │   └── CameraCapture.tsx # Camera + upload with fallbacks
│   │   │   ├── Scanner/
│   │   │   │   ├── ScanResult.tsx    # Material, hazards, price, TTS, source badge
│   │   │   │   └── ManualMaterialSelect.tsx  # Honest manual picker
│   │   │   ├── Pickup/
│   │   │   │   ├── OfferCard.tsx     # Rich offer card (weight, value, hazards)
│   │   │   │   ├── OfferCardSkeleton.tsx
│   │   │   │   └── PostPickupForm.tsx# Post listing after scan
│   │   │   ├── Layout/
│   │   │   │   ├── AppShell.tsx      # Online/offline detection + layout
│   │   │   │   ├── Header.tsx        # Brand, connectivity, language, theme toggle
│   │   │   │   └── BottomNav.tsx     # Tab navigation
│   │   │   └── UI/
│   │   │       ├── LoadingSpinner.tsx
│   │   │       ├── EmptyState.tsx    # Empty lists
│   │   │       └── HazardBadge.tsx   # Color-coded hazard level badge
│   │   ├── locales/
│   │   │   ├── en.json               # English phrases
│   │   │   ├── ha.json               # Hausa hazard/safety/phrases dictionary
│   │   │   └── pcm.json              # Pidgin hazard/safety/phrases dictionary
│   │   └── utils/
│   │       ├── formatters.ts         # Currency, confidence, date formatters
│   │       └── offline.ts            # Online/offline hook
│   ├── public/
│   │   ├── icons/                    # PWA app icons (192x192, 512x512)
│   │   └── models/                   # Optional bundled ONNX model + labels
│   ├── vite.config.ts                # + VitePWA plugin + API proxy
│   ├── tailwind.config.js            # Brand colors + darkMode class
│   ├── tsconfig.json
│   ├── package.json
│   ├── nginx.conf                    # Production nginx config
│   ├── Dockerfile                    # Multi-stage production build
│   └── Dockerfile.dev
│
├── .github/workflows/
│   └── ci.yml                        # GitHub Actions (backend tests + frontend build)
├── docker-compose.yml                # Local dev orchestration
├── .gitignore
└── README.md
```

### Team Member Ownership

| Member | Role | Files |
|---|---|---|
| Member 1 | Lead Backend & Database Engineer | `backend/app/main.py`, `models.py`, `database.py`, `schemas.py`, `api/*`, `services/{user,price,sync,analyze,matching,outbox}_service.py`, `services/ussd_handler.py` |
| Member 2 | Frontend & PWA Architect | `frontend/src/App.tsx`, `main.tsx`, `services/`, `store/`, `pages/`, `components/Layout/`, `components/Camera/`, `components/Scanner/`, `utils/` |
| Member 3 | Edge AI & On-Device ML Engineer | `frontend/src/vision/visionEngine.ts`, `frontend/src/services/analysis.ts`, `backend/app/services/analyze_service.py` |
| Member 4 | Accessibility & Audio Engineer | `frontend/src/hooks/useAudioTTS.ts`, `frontend/src/locales/` |
| Member 5 | QA, DevOps & Sync Engineer | `backend/tests/`, `docker-compose.yml`, `.github/workflows/`, `Dockerfile` files, sync conflict logic |

---

## License

Apache 2.0
