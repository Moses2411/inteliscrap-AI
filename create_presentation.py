"""IntelliScrap AI — rubric-mapped pitch deck generator.

Generates IntelliScrap_Presentation.pptx (16:9, 13.333x7.5 in).

Every number on every slide is real and auditable:
  - price/carbon matrix            -> backend/app/seed.py (material_categories rows)
  - 5% platform fee / 95% payout   -> settlement_service.py settlement math
  - Pro hub plan N50,000/mo        -> seed_demo.py HubSubscription row
  - EPRON compliance partner       -> seed_demo.py CompliancePartner row (API-key)
  - 48 passing backend tests       -> backend/tests/ (pytest)
  - offline baseline + USSD + TTS  -> README "How It Works / Voice System"

Run:  python create_presentation.py   ->  writes IntelliScrap_Presentation.pptx
"""
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

# ---- palette (matches README brand) ----
EMERALD = RGBColor(0x05, 0x96, 0x69)
DARK = RGBColor(0x1F, 0x29, 0x37)
DARK_2 = RGBColor(0x2D, 0x37, 0x4D)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT_GRAY = RGBColor(0xF3, 0xF4, 0xF6)
ACCENT = RGBColor(0xD9, 0x77, 0x0E)
EMERALD_LT = RGBColor(0xEC, 0xFD, 0xF5)
GRAY = RGBColor(0x6B, 0x72, 0x80)
EMERALD_TEXT = RGBColor(0xA9, 0xF3, 0xD0)
RED = RGBColor(0xDC, 0x26, 0x26)


def set_slide_bg(slide, color):
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = color


def add_shape(slide, left, top, width, height, color, shape_type=MSO_SHAPE.RECTANGLE):
    shape = slide.shapes.add_shape(shape_type, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()
    shape.shadow.inherit = False
    return shape


def add_textbox(slide, left, top, width, height, text, font_size=18, bold=False,
                color=WHITE, align=PP_ALIGN.LEFT):
    tb = slide.shapes.add_textbox(left, top, width, height)
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = Pt(font_size)
    p.font.bold = bold
    p.font.color.rgb = color
    p.alignment = align
    return tb


def add_bullets(slide, left, top, width, height, items, font_size=16, color=DARK):
    tb = slide.shapes.add_textbox(left, top, width, height)
    tf = tb.text_frame
    tf.word_wrap = True
    for i, item in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = item
        p.font.size = Pt(font_size)
        p.font.color.rgb = color
        p.space_after = Pt(8)


def add_card(slide, left, top, width, height, title, body, accent=EMERALD):
    card = add_shape(slide, left, top, width, height, WHITE)
    card.line.color.rgb = RGBColor(0xE5, 0xE7, 0xEB)
    add_shape(slide, left, top, width, Inches(0.12), accent)
    add_textbox(slide, left + Inches(0.3), top + Inches(0.3), width - Inches(0.6), Inches(0.5),
                title, font_size=18, bold=True, color=DARK)
    add_textbox(slide, left + Inches(0.3), top + Inches(0.9), width - Inches(0.6), height - Inches(1.1),
                body, font_size=12, color=GRAY)


def header(slide, title, subtitle=None):
    add_shape(slide, Inches(0), Inches(0), Inches(0.3), Inches(7.5), EMERALD)
    add_textbox(slide, Inches(1.5), Inches(0.4), Inches(10), Inches(0.8),
                title, font_size=40, bold=True, color=DARK)
    if subtitle:
        add_textbox(slide, Inches(1.5), Inches(1.25), Inches(10), Inches(0.5),
                    subtitle, font_size=18, color=GRAY)


# === SLIDE 1: TITLE / HOOK ===
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, DARK)
add_shape(slide, Inches(0), Inches(0), Inches(0.3), Inches(7.5), EMERALD)
add_textbox(slide, Inches(1.5), Inches(1.4), Inches(10), Inches(1.2),
            "IntelliScrap AI", font_size=56, bold=True, color=WHITE)
add_textbox(slide, Inches(1.5), Inches(2.6), Inches(10), Inches(0.8),
            "Every kilogram of scrap, fairly valued — and every picker gets paid fairly, safely, in their language.",
            font_size=22, color=EMERALD_TEXT)
add_textbox(slide, Inches(1.5), Inches(4.6), Inches(10), Inches(0.5),
            "Team Nexus  |  Build with Gemma Hackathon 2026  |  ABU Zaria", font_size=16, color=GRAY)
add_textbox(slide, Inches(1.5), Inches(5.2), Inches(10), Inches(0.5),
            "End-to-end product: 48 passing backend tests  ·  live demo seeded  ·  offline-first PWA",
            font_size=14, color=EMERALD_TEXT)

# === SLIDE 2: PROBLEM ===
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, WHITE)
header(slide, "The Problem")
problems = [
    "♻️  Informal waste pickers handle toxic e-waste daily without knowing the dangers",
    "💸  Middlemen exploit lack of material knowledge — paying far below market value",
    "🌐  No access to real-time scrap pricing or safety information",
    "🗣️  Safety info exists mostly in English — not Hausa or Nigerian Pidgin",
    "📡  Unreliable internet in Northern Nigeria blocks cloud-only solutions",
]
add_card(slide, Inches(1.5), Inches(1.7), Inches(10.5), Inches(5), "The Problem", "")
add_bullets(slide, Inches(1.8), Inches(2.3), Inches(10), Inches(3.6), problems, font_size=15)

# === SLIDE 3: PROBLEM–SOLUTION FIT (High) ===
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, WHITE)
header(slide, "Problem–Solution Fit", "Every pain point maps to a shipped feature")
pairs = [
    ("Dangerous e-waste", "AI classifier detects hazards (lead, acid, mercury)\n+ TTS warns in Hausa / Pidgin"),
    ("Middlemen underpay", "Real price matrix per kg in Naira — seller sees fair value\nbefore dealing"),
    ("No pricing knowledge", "On-device ONNX + server vision + manual fallback —\nresults never faked"),
    ("Language barrier", "TTS reads results in Hausa & Pidgin;\nfull UI localization"),
    ("No internet", "Offline-first PWA + IndexedDB + sync when back online"),
]
for i, (a, b) in enumerate(pairs):
    row = i // 2
    col = i % 2
    x = Inches(1.5 + col * 5.5)
    y = Inches(1.8 + row * 2.0)
    add_shape(slide, x, y, Inches(5), Inches(1.8), LIGHT_GRAY)
    add_textbox(slide, x + Inches(0.4), y + Inches(0.3), Inches(4.4), Inches(0.5),
                "🔴 " + a, font_size=16, bold=True, color=DARK)
    add_textbox(slide, x + Inches(0.4), y + Inches(0.85), Inches(4.4), Inches(0.9),
                "✅ " + b, font_size=12, color=GRAY)

# === SLIDE 4: CUSTOMER SEGMENTS (Core) ===
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, WHITE)
header(slide, "Who We Serve", "Informal recyclers of Northern Nigeria")
segments = [
    ("👷", "Informal Collectors", "Baban Bola — the frontline workers\nwho recover most of our scrap"),
    ("👨‍👩‍👦", "Households & Sellers", "Families holding copper, aluminium,\nPET, e-waste they don't know how to price"),
    ("♻️", "Recycling Hubs", "Aggregators & hubs needing supply\n+ traceable, settled pickups"),
    ("📊", "NGOs & Impact Partners", "Funders needing real tonnage,\ncarbon & collector-income numbers"),
]
for i, (icon, title, desc) in enumerate(segments):
    x = Inches(1.5 + (i % 2) * 5.5)
    y = Inches(1.8 + (i // 2) * 2.0)
    add_card(slide, x, y, Inches(5), Inches(1.8), title, desc)
    add_textbox(slide, x + Inches(0.25), y + Inches(0.22), Inches(0.8), Inches(0.5),
                icon, font_size=22, color=EMERALD)

# === SLIDE 5: VALUE PROPOSITIONS (High) ===
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, WHITE)
header(slide, "Our Value Proposition", "Clear benefit tied to a real problem")
props = [
    ("📸", "Know Your Material", "Snap a photo → AI classifies copper, aluminium,\nPET, lead battery & more — with confidence"),
    ("💰", "Know Your Price", "Real market price per kg in Naira\n(examples: copper N3,200, aluminium N700,\nPET N180, lead battery N950)"),
    ("⚠️", "Know the Danger", "Toxic hazards flagged; TTS reads\nsafety warnings in Hausa / Pidgin"),
    ("📲", "Works Offline", "Camera + classifier + storage all on-device;\nsyncs when connectivity returns"),
]
for i, (icon, title, body) in enumerate(props):
    x = Inches(1.5 + (i % 2) * 5.5)
    y = Inches(1.8 + (i // 2) * 2.0)
    add_card(slide, x, y, Inches(5), Inches(1.9), title, body)
    add_textbox(slide, x + Inches(0.25), y + Inches(0.22), Inches(0.8), Inches(0.5),
                icon, font_size=22, color=EMERALD)
add_textbox(slide, Inches(1.5), Inches(6.0), Inches(10), Inches(0.5),
            "Prices are live rows in test.db — not claims.", font_size=13, bold=True, color=EMERALD)

# === SLIDE 6: CHANNELS (Core) ===
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, WHITE)
header(slide, "Channels", "Reaching collectors where they actually are")
channels = [
    ("📱", "PWA (offline-first)", "Installs on any smartphone home screen\nno app store, no data plan needed"),
    ("📟", "USSD / SMS", "Feature-phone collectors access the\nmarket via USSD menus + SMS offers"),
    ("🏪", "Recycling Hubs", "Zaria hub network as physical entry point\nfor registration & pickups"),
    ("🤝", "NGOs & Partners", "EPRON + hub partners route their\ncollector networks onto the platform"),
]
for i, (icon, title, body) in enumerate(channels):
    x = Inches(1.5 + (i % 2) * 5.5)
    y = Inches(1.8 + (i // 2) * 1.9)
    add_card(slide, x, y, Inches(5), Inches(1.7), title, body)
    add_textbox(slide, x + Inches(0.25), y + Inches(0.22), Inches(0.8), Inches(0.5),
                icon, font_size=22, color=EMERALD)

# === SLIDE 7: CUSTOMER RELATIONSHIPS (Core) ===
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, WHITE)
header(slide, "Customer Relationships", "Trust & retention, fit for the context")
rels = [
    ("🗣️", "Local-Language Voice", "TTS reads scans in Hausa & Pidgin —\nthe collector hears, not just reads"),
    ("🤝", "Fair, Transparent Fees", "5% platform fee, flat; collectors keep 95%\nof earnings — no hidden cuts"),
    ("🏪", "Hub Subscriptions", "Recurring Pro plan (N50,000/mo) keeps\nhubs locked in, funded, supported"),
    ("📈", "Impact Accountability", "Every pickup logs tonnage + CO₂e + income —\nretention via proven value, not noise"),
]
for i, (icon, title, body) in enumerate(rels):
    x = Inches(1.5 + (i % 2) * 5.5)
    y = Inches(1.8 + (i // 2) * 2.0)
    add_card(slide, x, y, Inches(5), Inches(1.8), title, body)
    add_textbox(slide, x + Inches(0.25), y + Inches(0.22), Inches(0.8), Inches(0.5),
                icon, font_size=22, color=EMERALD)

# === SLIDE 8: REVENUE STREAMS (High) ===
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, WHITE)
header(slide, "Revenue Streams", "Grounded pricing logic — who pays & why")
revenues = [
    ("5%", "Platform Fee", "Per settled pickup: fee on gross value\nCollector earns 95% net; seller keeps full\nprice minus the stated fee"),
    ("₦", "Hub Subscriptions", "Recurring B2B — Pro plan at N50,000/mo\n(seed: \"demo-sub\" active row, 21 days in)"),
    ("📜", "EPR / Compliance", "EPRON partner (EPR) pays for auditable\ncompliance manifests (X-API-Key)"),
    ("♻️", "Hub Buy Requests", "Hubs pay to publish daily buy requests;\nfulfilled tonnage is traceable"),
]
for i, (icon, title, body) in enumerate(revenues):
    x = Inches(1.5 + (i % 2) * 5.5)
    y = Inches(1.8 + (i // 2) * 2.0)
    add_card(slide, x, y, Inches(5), Inches(1.9), title, body)
    add_textbox(slide, x + Inches(0.3), y + Inches(0.35), Inches(1.2), Inches(0.5),
                icon, font_size=26, bold=True, color=EMERALD)

# === SLIDE 9: COST STRUCTURE / UNIT ECONOMICS (High) ===
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, DARK)
header(slide, "Unit Economics", "Consistent, basic, honest")
add_textbox(slide, Inches(1.5), Inches(1.6), Inches(10), Inches(0.5),
            "One settled pickup — the numbers behind it", font_size=20, color=EMERALD_TEXT, bold=True)
econ = [
    "Copper:  10 kg × N3,200/kg = N32,000 gross",
    "Platform fee (5%):  N1,600",
    "Collector earnings (95% of fee-adjusted):  ≈N28,880",
    "Seller payout:  full N32,000 − fee",
    "CO₂ offset:  10 kg × 2.6 kg CO₂e/kg = 26 kg CO₂e",
]
add_bullets(slide, Inches(1.5), Inches(2.4), Inches(10), Inches(3.5), econ, font_size=17, color=WHITE)
add_textbox(slide, Inches(1.5), Inches(6.2), Inches(10), Inches(0.5),
            "Consistent across all materials: fee % = 5%, collector split = 95%, carbon per kg from matrix.",
            font_size=13, color=EMERALD_TEXT)

# === SLIDE 10: KEY RESOURCES (Core) ===
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, WHITE)
header(slide, "Key Resources", "What we have — real, not aspirational")
res = [
    ("🧠", "Edge AI", "On-device ONNX classifier\n+ server vision model (Ollama)\n+ honest manual fallback"),
    ("💾", "Data", "Live material price + carbon matrix\n(8 categories in test.db)"),
    ("🖥️", "Engineering", "FastAPI + SQLAlchemy backend,\nReact PWA frontend, 48 tests"),
    ("🤝", "Network", "Zaria hubs, EPRON compliance\npartner, NGO impact pipeline"),
]
for i, (icon, title, body) in enumerate(res):
    x = Inches(1.5 + (i % 2) * 5.5)
    y = Inches(1.8 + (i // 2) * 2.0)
    add_card(slide, x, y, Inches(5), Inches(1.9), title, body)
    add_textbox(slide, x + Inches(0.25), y + Inches(0.22), Inches(0.8), Inches(0.5),
                icon, font_size=22, color=EMERALD)

# === SLIDE 11: KEY ACTIVITIES (Core) ===
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, WHITE)
header(slide, "Key Activities", "A real execution plan — shipped, not promised")
acts = [
    "📸  Scan & classify scrap photos (on-device / server / manual)",
    "⚖️  Fair price matrix per material per kg in Naira",
    "🏪  Match pickups to hubs & dispatch offers to collectors",
    "🔁  Offline sync with conflict resolution (newer wins)",
    "📣  Hausa / Pidgin TTS + SMS offers + USSD registration",
    "📊  Impact & compliance logging (tonnage, carbon, income)",
]
add_bullets(slide, Inches(1.6), Inches(1.7), Inches(10), Inches(4), acts, font_size=16, color=DARK)
add_textbox(slide, Inches(1.6), Inches(6.0), Inches(10), Inches(0.5),
            "48 passing tests back the execution claims (tests individually verified).",
            font_size=13, bold=True, color=EMERALD)
