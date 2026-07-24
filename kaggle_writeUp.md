# InteliScrap AI
### Turning Every Smartphone Camera Into a Hausa-Speaking Safety Inspector for Nigeria's Informal Recyclers

**Team Nexus | Build with Gemma Hackathon, GDG on Campus ABU Zaria, 2026**
**Track: Gemma for Local Languages & Literacy**

---

## The Problem: A Silent, Invisible Occupational Hazard

Across Northern Nigeria's cities, an entire informal economy runs on the backs of scrap collectors known locally as *Baban Bola* aka "Yan Kilo". They sift through discarded electronics, batteries, and industrial waste every single day — sorting copper from aluminum, plastic from e-waste boards — with their bare hands and no protective equipment.

Three compounding failures make this dangerous and unfair:

1. **Toxic exposure without knowledge.** Lead-acid batteries, lithium-ion cells, and circuit boards contain corrosive acids, heavy metals, and mercury. Most collectors have no formal training to recognize which materials are hazardous, or how to handle them safely.
2. **Information asymmetry at the point of sale.** Middlemen who *do* understand material value routinely underpay collectors who cannot verify fair market prices.
3. **A literacy and language wall.** Existing safety and pricing information — where it exists at all — is written in English, in formats that assume smartphone fluency and formal literacy neither guaranteed nor common among this workforce. Hausa, spoken by tens of millions across the region, remains almost entirely absent from digital safety tooling.

This is not a hypothetical problem. It is a daily, physical risk borne by people with the least access to the information that could protect them.

## The Solution: Snap, Speak, Sell Smarter

**InteliScrap AI** is an offline-first Progressive Web App that turns a low-end Android smartphone into a multimodal scrap-identification assistant. The interaction model is deliberately built for low-literacy use:

1. **Snap a photo** of a scrap material using the device camera.
2. **Gemma 4 classifies it** on-device or on a local proxy — identifying the material, flagging toxicity hazards, and estimating a fair price in Naira per kilogram.
3. **The result is read aloud**, not just displayed, in Hausa, English or Nigerian Pidgin — removing the literacy barrier entirely from the safety-critical step of the workflow.
4. **Everything works offline.** Scans queue locally and sync automatically the moment connectivity returns, so the tool is just as useful in a scrapyard with no signal as it is in a city center.

The result is a single, closed loop — see it, hear it, price it, stay safe — that fits into a collector's existing routine rather than demanding a new one.

## Why Gemma 4 Is the Core of This, Not a Feature Bolted On

Gemma 4 is not incidental to InteliScrap AI — it *is* the product. Every other component (the PWA shell, the sync engine, the TTS layer) exists purely to get a photo to Gemma 4 and get an actionable, spoken answer back to a user with no reliable connectivity. We built a genuinely **dual-mode inference architecture** around this constraint, because a real deployment target — a scrapyard in Zaria — cannot assume any particular device capability or network state:

- **WebLLM path (production/on-device):** On WebGPU-capable Android devices (Chrome 113+, Android 12+), Gemma 4 runs entirely inside the browser via a Web Worker after a one-time ~700MB model download. From that point forward, inference requires zero backend connectivity — the phone *is* the inference engine.
- **Ollama proxy path (development/demo):** For laptops or devices without WebGPU, the frontend transparently falls back to a FastAPI backend that proxies image analysis requests to a local Ollama server running Gemma 4 on `localhost:11434`.
- **Runtime self-detection:** The `useGemma` hook probes WebLLM availability on the first analysis call and permanently commits to whichever path succeeds for that session — meaning the exact same codebase runs identically whether deployed to production or demoed on a judge's laptop, with no configuration branching.

This mattered enormously for the "offline or low-connectivity environment" requirement of the hackathon brief: we didn't want offline support to be a checkbox feature that degrades gracefully to "please reconnect." We wanted the *default* production path to require no network at all.

## Multimodal + Language: Where Gemma 4 Does the Heavy Lifting

Gemma 4's multimodal image understanding is what makes the classification step possible from a single photo, and its structured output capability lets us request a strict JSON schema (`material_class`, `confidence`, `toxicity_hazards`, `safety_instructions`, `estimated_value`) directly from the model — no separate classifier or brittle regex parsing layer required. That JSON contract is what lets the frontend render a hazard badge, a price estimate, and a "Read Aloud" button from one model call.

The language layer is deliberately decoupled from the model call itself. Rather than asking Gemma 4 to generate Hausa prose on the fly (introducing risk of inconsistent phrasing for safety-critical instructions), we map its structured hazard and material outputs against curated Hausa (`ha.json`) and Pidgin (`pcm.json`) locale dictionaries — covering 15 hazard types, 17 material names, and 8 safety instruction templates — before routing the result to a Google TTS proxy for authentic native-accent audio. This gives us Gemma 4's classification intelligence with the phrasing reliability that a safety-warning use case demands.

## Engineering Decisions Under a One-Day Sprint

Building this in a single day forced sharp, defensible trade-offs across a five-person team split across backend, frontend/PWA, edge AI, accessibility/audio, and QA/DevOps:

- **SQLite over PostgreSQL for local development**, with a straight async-SQLAlchemy swap path to Postgres for production — avoided losing hours to `asyncpg` build-tool issues on Windows machines mid-sprint, without compromising the production data model.
- **IndexedDB (via Dexie.js) as the offline source of truth**, with a sync API that resolves conflicts by newest-timestamp-wins. This was tested explicitly for idempotency (duplicate scans don't double-write) and deleted-scan propagation, because a sync layer that silently corrupts a collector's scan history is worse than no sync layer at all.
- **A mock-mode fallback pool** (8 material types with realistic hazard mappings) that activates automatically whenever both WebLLM and the Ollama proxy are unavailable — so the UI, sync, and TTS flows remain fully demonstrable and testable even in a degraded environment, which was essential for reliable judge demos.
- **PWA-first over native app**, deliberately, because it requires no app-store install, no login wall, and installs directly to a home screen from a browser — the lowest-friction distribution path for a user base with limited data and limited familiarity with app stores.

## Impact and Why This Fits Local Languages & Literacy

InteliScrap AI directly targets the track's core challenge: Hausa remains critically underdeveloped in digital tooling despite its enormous speaker base. We are not translating an existing English tool as an afterthought — the entire interaction is designed around **spoken-first, literacy-independent output** for a workforce actively excluded from most digital safety and pricing information. The same architecture generalizes cleanly beyond scrap recycling to any low-literacy, low-connectivity occupational safety context in the region.

## What's Next

Immediate priorities beyond the hackathon scope include: expanding the locale dictionaries with community-sourced Hausa dialectal variants, adding a lightweight on-device fine-tune for material types specific to Northern Nigerian scrap streams, and partnering with local recycling cooperatives to validate the price matrix against real market data rather than static seed values.

---

**Public Code Repository:** https://github.com/Moses2411/inteliscrap-AI
**License:** Apache 2.0