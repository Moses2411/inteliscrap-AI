from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

EMERALD = RGBColor(0x05, 0x96, 0x69)
DARK = RGBColor(0x1F, 0x29, 0x37)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT_GRAY = RGBColor(0xF3, 0xF4, 0xF6)
ACCENT = RGBColor(0xD9, 0x77, 0x0E)
RED = RGBColor(0xDC, 0x26, 0x26)

def set_slide_bg(slide, color):
    bg = slide.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = color

def add_shape(slide, left, top, width, height, color, shape_type=MSO_SHAPE.RECTANGLE):
    shape = slide.shapes.add_shape(shape_type, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()
    return shape

def add_textbox(slide, left, top, width, height, text, font_size=18, bold=False, color=WHITE, align=PP_ALIGN.LEFT):
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = Pt(font_size)
    p.font.bold = bold
    p.font.color.rgb = color
    p.alignment = align
    return txBox

def add_bullet_textbox(slide, left, top, width, height, items, font_size=16, color=DARK):
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    for i, item in enumerate(items):
        if i == 0:
            p = tf.paragraphs[0]
        else:
            p = tf.add_paragraph()
        p.text = item
        p.font.size = Pt(font_size)
        p.font.color.rgb = color
        p.space_after = Pt(8)
        p.level = 0
    return txBox

def add_card(slide, left, top, width, height, title, body, icon_text=""):
    card = add_shape(slide, left, top, width, height, WHITE)
    card.shadow.inherit = False
    if icon_text:
        add_textbox(slide, left + Inches(0.3), top + Inches(0.2), width - Inches(0.6), Inches(0.6),
                    icon_text, font_size=28, color=EMERALD, align=PP_ALIGN.LEFT)
    add_textbox(slide, left + Inches(0.3), top + Inches(0.7), width - Inches(0.6), Inches(0.5),
                title, font_size=18, bold=True, color=DARK)
    add_textbox(slide, left + Inches(0.3), top + Inches(1.2), width - Inches(0.6), height - Inches(1.5),
                body, font_size=13, color=RGBColor(0x6B, 0x72, 0x80))


# === SLIDE 1: TITLE ===
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, DARK)

add_shape(slide, Inches(0), Inches(0), Inches(0.3), Inches(7.5), EMERALD)

add_textbox(slide, Inches(1.5), Inches(1.5), Inches(10), Inches(1.2),
            "IntelliScrap AI", font_size=56, bold=True, color=WHITE)
add_textbox(slide, Inches(1.5), Inches(2.7), Inches(10), Inches(1),
            "Empowering Informal Recyclers with Multimodal Edge Intelligence", font_size=24, color=RGBColor(0xA1, 0xA1, 0xAA))

add_shape(slide, Inches(1.5), Inches(3.8), Inches(2), Inches(0.06), EMERALD)

add_textbox(slide, Inches(1.5), Inches(4.2), Inches(6), Inches(0.5),
            "Team Nexus  |  Build with Gemma Hackathon 2026  |  ABU Zaria", font_size=16, color=RGBColor(0xA1, 0xA1, 0xAA))


# === SLIDE 2: THE PROBLEM ===
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, LIGHT_GRAY)

add_shape(slide, Inches(0), Inches(0), Inches(0.3), Inches(7.5), RED)
add_textbox(slide, Inches(1.5), Inches(0.4), Inches(10), Inches(0.8),
            "The Problem", font_size=40, bold=True, color=DARK)

problems = [
    "🔴  Waste pickers handle toxic e-waste daily without knowing the dangers",
    "🔴  Middlemen exploit lack of material knowledge — paying far below market value",
    "🔴  No access to real-time scrap pricing or safety information",
    "🔴  Language barrier — most safety info is in English, not Hausa or Pidgin",
    "🔴  Internet connectivity is unreliable in Northern Nigeria"
]
add_bullet_textbox(slide, Inches(1.5), Inches(1.5), Inches(10), Inches(4),
                   problems, font_size=20, color=DARK)

# Bottom stat bar
bar = add_shape(slide, Inches(0), Inches(6.5), Inches(13.333), Inches(1), DARK)
add_textbox(slide, Inches(1.5), Inches(6.7), Inches(10), Inches(0.5),
            "Northern Nigeria produces over 1.2 million tonnes of e-waste annually — most handled by informal recyclers",
            font_size=14, color=RGBColor(0xA1, 0xA1, 0xAA), align=PP_ALIGN.CENTER)


# === SLIDE 3: THE SOLUTION ===
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, DARK)

add_shape(slide, Inches(0), Inches(0), Inches(0.3), Inches(7.5), EMERALD)
add_textbox(slide, Inches(1.5), Inches(0.4), Inches(10), Inches(0.8),
            "Our Solution", font_size=40, bold=True, color=WHITE)

# Cards
card_data = [
    ("Snap & Analyze", "Take a photo of any scrap material\nGemma 4 instantly identifies it"),
    ("Safety First", "Detects toxic hazards\nPlays warnings in Hausa / Pidgin"),
    ("Fair Pricing", "Shows real-time market price\nper kg in Naira"),
    ("Works Offline", "PWA installs on any smartphone\nNo internet needed after setup"),
]
for i, (title, body) in enumerate(card_data):
    add_card(slide, Inches(1.5 + i * 3), Inches(1.8), Inches(2.7), Inches(3.2), title, body)

add_textbox(slide, Inches(1.5), Inches(5.5), Inches(10), Inches(0.5),
            "Powered by Google Gemma 4 — running entirely on-device via WebLLM or Ollama",
            font_size=14, color=RGBColor(0xA1, 0xA1, 0xAA), align=PP_ALIGN.CENTER)


# === SLIDE 4: HOW IT WORKS ===
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, WHITE)

add_shape(slide, Inches(0), Inches(0), Inches(0.3), Inches(7.5), EMERALD)
add_textbox(slide, Inches(1.5), Inches(0.4), Inches(10), Inches(0.8),
            "How It Works", font_size=40, bold=True, color=DARK)

steps = [
    ("1", "User captures photo\nof scrap material", "via phone camera or upload"),
    ("2", "Image sent to\nthe AI engine", "WebLLM (in-browser)\nor Ollama (backend)"),
    ("3", "Gemma 4 classifies\n& detects hazards", "Returns: material type,\nconfidence, toxicity"),
    ("4", "Result displayed\nin local language", "Shows price, hazards,\nsafety instructions"),
]

for i, (num, title, desc) in enumerate(steps):
    x = Inches(1.5 + i * 3)
    # Circle with number
    circle = add_shape(slide, x + Inches(0.8), Inches(1.6), Inches(0.8), Inches(0.8), EMERALD, MSO_SHAPE.OVAL)
    add_textbox(slide, x + Inches(0.8), Inches(1.7), Inches(0.8), Inches(0.6),
                num, font_size=28, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    # Arrow (except last)
    if i < 3:
        add_textbox(slide, x + Inches(1.8), Inches(1.8), Inches(1.0), Inches(0.5),
                    "→", font_size=36, bold=True, color=EMERALD, align=PP_ALIGN.CENTER)
    # Card
    add_card(slide, x, Inches(2.8), Inches(2.6), Inches(3.5), title, desc)


# === SLIDE 5: ARCHITECTURE ===
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, LIGHT_GRAY)

add_shape(slide, Inches(0), Inches(0), Inches(0.3), Inches(7.5), EMERALD)
add_textbox(slide, Inches(1.5), Inches(0.4), Inches(10), Inches(0.8),
            "Architecture", font_size=40, bold=True, color=DARK)

# Phone box
phone = add_shape(slide, Inches(1), Inches(1.5), Inches(5), Inches(3.5), WHITE)
phone.line.color.rgb = RGBColor(0xE5, 0xE7, 0xEB)
add_textbox(slide, Inches(1.3), Inches(1.6), Inches(4.5), Inches(0.4),
            "📱  Phone (PWA)", font_size=16, bold=True, color=EMERALD)
phone_items = [
    "  •  Camera Capture — snap or upload photo",
    "  •  useGemma — dual-mode inference engine",
    "  •  WebLLM (in-browser)  /  Ollama proxy",
    "  •  IndexedDB — offline scan persistence",
    "  •  TTS — reads results in Hausa / Pidgin",
]
add_bullet_textbox(slide, Inches(1.3), Inches(2.1), Inches(4.5), Inches(2.5),
                   phone_items, font_size=13, color=DARK)

# Backend box
be = add_shape(slide, Inches(1), Inches(5.3), Inches(5), Inches(1.8), WHITE)
be.line.color.rgb = RGBColor(0xE5, 0xE7, 0xEB)
add_textbox(slide, Inches(1.3), Inches(5.4), Inches(4.5), Inches(0.4),
            "🖥️  FastAPI Backend", font_size=16, bold=True, color=EMERALD)
be_items = [
    "  •  Sync API — bidirectional scan sync with conflict resolution",
    "  •  Price Matrix — material → price per kg in Naira",
    "  •  TTS Proxy — Google Translate TTS (Hausa / Nigerian English)",
]
add_bullet_textbox(slide, Inches(1.3), Inches(5.9), Inches(4.5), Inches(1.2),
                   be_items, font_size=12, color=DARK)

# Right side - AI Layer
ai = add_shape(slide, Inches(7), Inches(1.5), Inches(5.5), Inches(5.6), WHITE)
ai.line.color.rgb = RGBColor(0xE5, 0xE7, 0xEB)
add_textbox(slide, Inches(7.3), Inches(1.6), Inches(5), Inches(0.4),
            "🧠  AI Layer — Google Gemma 4", font_size=16, bold=True, color=EMERALD)

# Dual mode boxes
dm1 = add_shape(slide, Inches(7.3), Inches(2.3), Inches(4.8), Inches(1.6), RGBColor(0xEC, 0xFD, 0xF5))
dm1.line.color.rgb = RGBColor(0xA7, 0xF3, 0xD0)
add_textbox(slide, Inches(7.5), Inches(2.4), Inches(4.3), Inches(0.3),
            "WebLLM (Production)", font_size=15, bold=True, color=EMERALD)
add_textbox(slide, Inches(7.5), Inches(2.8), Inches(4.3), Inches(1),
            "Runs Gemma 2 in-browser via WebGPU\nZero backend dependency\n~700MB model cached locally\nWorks on Android 12+ / Chrome 113+",
            font_size=12, color=DARK)

dm2 = add_shape(slide, Inches(7.3), Inches(4.2), Inches(4.8), Inches(1.6), RGBColor(0xEF, 0xF6, 0xFF))
dm2.line.color.rgb = RGBColor(0xBF, 0xDB, 0xFE)
add_textbox(slide, Inches(7.5), Inches(4.3), Inches(4.3), Inches(0.3),
            "Ollama (Development)", font_size=15, bold=True, color=RGBColor(0x25, 0x67, 0xEB))
add_textbox(slide, Inches(7.5), Inches(4.7), Inches(4.3), Inches(1),
            "Runs Gemma 4 on local server\nProxied via FastAPI backend\nUsed in laptop demos / development",
            font_size=12, color=DARK)

# Fallback
fb = add_shape(slide, Inches(7.3), Inches(6.1), Inches(4.8), Inches(0.7), RGBColor(0xFF, 0xFB, 0xEB))
fb.line.color.rgb = RGBColor(0xFD, 0xE6, 0x8A)
add_textbox(slide, Inches(7.5), Inches(6.2), Inches(4.3), Inches(0.5),
            "⚡ Fallback: Random mock results when no model available",
            font_size=11, bold=True, color=ACCENT)


# === SLIDE 6: KEY FEATURES ===
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, WHITE)

add_shape(slide, Inches(0), Inches(0), Inches(0.3), Inches(7.5), EMERALD)
add_textbox(slide, Inches(1.5), Inches(0.4), Inches(10), Inches(0.8),
            "Key Features", font_size=40, bold=True, color=DARK)

features = [
    ("📸", "Multimodal AI", "Analyzes scrap photos using Google Gemma 4\nIdentifies 20+ material types & toxic hazards"),
    ("🗣️", "Local Language TTS", "Reads results aloud in Hausa & Nigerian Pidgin\nAuto-plays on scan completion"),
    ("📡", "Offline-First PWA", "Installs on any smartphone home screen\nFull functionality without internet"),
    ("💾", "IndexedDB Persistence", "All scans saved locally\nSyncs when connectivity returns"),
    ("📊", "Real-Time Pricing", "Live market prices per kg in Naira\nUpdates automatically on sync"),
    ("🔄", "Bidirectional Sync", "Conflict resolution (newer timestamp wins)\nDeleted scan propagation"),
]

for i, (icon, title, desc) in enumerate(features):
    col = i % 3
    row = i // 3
    x = Inches(1.5 + col * 3.8)
    y = Inches(1.5 + row * 2.8)
    card = add_shape(slide, x, y, Inches(3.5), Inches(2.4), LIGHT_GRAY)
    add_textbox(slide, x + Inches(0.3), y + Inches(0.2), Inches(3), Inches(0.5),
                icon, font_size=24, color=EMERALD)
    add_textbox(slide, x + Inches(0.3), y + Inches(0.7), Inches(3), Inches(0.4),
                title, font_size=18, bold=True, color=DARK)
    add_textbox(slide, x + Inches(0.3), y + Inches(1.1), Inches(3), Inches(1.2),
                desc, font_size=12, color=RGBColor(0x6B, 0x72, 0x80))


# === SLIDE 7: TECH STACK ===
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, DARK)

add_shape(slide, Inches(0), Inches(0), Inches(0.3), Inches(7.5), EMERALD)
add_textbox(slide, Inches(1.5), Inches(0.4), Inches(10), Inches(0.8),
            "Technology Stack", font_size=40, bold=True, color=WHITE)

stacks = [
    ("Frontend", "React 18  |  TypeScript  |  Tailwind CSS\nVite  |  VitePWA  |  Dexie.js\nWebLLM (MLC AI)  |  Lucide Icons"),
    ("Backend", "Python  |  FastAPI  |  SQLAlchemy\nSQLite / PostgreSQL  |  Alembic\nhttpx  |  Pydantic v2"),
    ("AI / ML", "Google Gemma 4 (via Ollama)\nGoogle Gemma 2 (via WebLLM)\nWebGPU  |  @mlc-ai/web-llm"),
    ("DevOps", "Docker  |  Render  |  GitHub Actions\nNginx  |  PostgreSQL 16"),
]

for i, (title, items) in enumerate(stacks):
    x = Inches(1.5 + i * 3)
    card = add_shape(slide, x, Inches(1.6), Inches(2.8), Inches(4.5), RGBColor(0x2D, 0x37, 0x4D))
    add_textbox(slide, x + Inches(0.3), Inches(1.8), Inches(2.3), Inches(0.4),
                title, font_size=20, bold=True, color=EMERALD)
    add_textbox(slide, x + Inches(0.3), Inches(2.4), Inches(2.3), Inches(3.5),
                items, font_size=13, color=RGBColor(0xCE, 0xD4, 0xDA))


# === SLIDE 8: DEMO FLOW ===
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, WHITE)

add_shape(slide, Inches(0), Inches(0), Inches(0.3), Inches(7.5), EMERALD)
add_textbox(slide, Inches(1.5), Inches(0.4), Inches(10), Inches(0.8),
            "Demo Flow", font_size=40, bold=True, color=DARK)

demos = [
    ("00:00", "Open App", "PWA loads from home screen\n(fully offline after initial load)"),
    ("00:15", "Snap Photo", "Camera captures scrap material\nor upload from gallery"),
    ("00:30", "AI Analysis", "Gemma classifies material &\ndetects toxic hazards"),
    ("00:50", "Read Aloud", "TTS plays result in Hausa\nwith safety instructions"),
    ("01:10", "View History", "Browse past scans with\nsync status indicators"),
    ("01:30", "Settings", "Toggle language, test voice,\nview about information"),
]

for i, (time, title, desc) in enumerate(demos):
    col = i % 3
    row = i // 3
    x = Inches(1.5 + col * 3.8)
    y = Inches(1.5 + row * 2.6)
    card = add_shape(slide, x, y, Inches(3.5), Inches(2.2), LIGHT_GRAY)
    add_textbox(slide, x + Inches(0.3), y + Inches(0.15), Inches(3), Inches(0.3),
                time, font_size=13, bold=True, color=EMERALD)
    add_textbox(slide, x + Inches(0.3), y + Inches(0.5), Inches(3), Inches(0.3),
                title, font_size=17, bold=True, color=DARK)
    add_textbox(slide, x + Inches(0.3), y + Inches(0.9), Inches(3), Inches(1.2),
                desc, font_size=12, color=RGBColor(0x6B, 0x72, 0x80))


# === SLIDE 9: HACKATHON JOURNEY ===
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, LIGHT_GRAY)

add_shape(slide, Inches(0), Inches(0), Inches(0.3), Inches(7.5), EMERALD)
add_textbox(slide, Inches(1.5), Inches(0.4), Inches(10), Inches(0.8),
            "Build with Gemma Hackathon Journey", font_size=36, bold=True, color=DARK)

add_textbox(slide, Inches(1.5), Inches(1.5), Inches(10), Inches(0.5),
            "From Concept to Working Prototype in 7 Days", font_size=20, color=RGBColor(0x6B, 0x72, 0x80))

milestones = [
    ("Day 1-2", "Ideation & Design", "Identified problem space\nDesigned architecture"),
    ("Day 3-4", "Backend & Database", "FastAPI + SQLAlchemy\nSync engine with conflict resolution"),
    ("Day 5-6", "Frontend & AI", "React PWA + WebLLM\ndual-mode inference hook"),
    ("Day 7", "Integration & Polish", "TTS, offline support, PWA\nDemo preparation"),
]

for i, (time, title, desc) in enumerate(milestones):
    x = Inches(1.5 + i * 3)
    # Timeline dot
    dot = add_shape(slide, x + Inches(1), Inches(2.5), Inches(0.3), Inches(0.3), EMERALD, MSO_SHAPE.OVAL)
    # Line
    if i < 3:
        add_shape(slide, x + Inches(1.3), Inches(2.62), Inches(1.7), Inches(0.04), RGBColor(0xA7, 0xF3, 0xD0))
    # Card
    card = add_shape(slide, x, Inches(3.1), Inches(2.5), Inches(2.8), WHITE)
    card.line.color.rgb = RGBColor(0xE5, 0xE7, 0xEB)
    add_textbox(slide, x + Inches(0.3), Inches(3.3), Inches(2), Inches(0.3),
                time, font_size=13, bold=True, color=EMERALD)
    add_textbox(slide, x + Inches(0.3), Inches(3.7), Inches(2), Inches(0.3),
                title, font_size=16, bold=True, color=DARK)
    add_textbox(slide, x + Inches(0.3), Inches(4.1), Inches(2), Inches(1.5),
                desc, font_size=12, color=RGBColor(0x6B, 0x72, 0x80))


# === SLIDE 10: TEAM ===
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, DARK)

add_shape(slide, Inches(0), Inches(0), Inches(0.3), Inches(7.5), EMERALD)
add_textbox(slide, Inches(1.5), Inches(0.4), Inches(10), Inches(0.8),
            "Team Nexus", font_size=40, bold=True, color=WHITE)

members = [
    ("👨‍💻", "Backend Lead", "FastAPI, Database, Sync Engine\nAPI Design & Deployment"),
    ("👨‍🎨", "Frontend Architect", "React PWA, UI/UX, Camera\nOffline Storage (Dexie.js)"),
    ("🤖", "Edge AI Engineer", "WebLLM Integration, Ollama\nGemma 4 Model Optimization"),
    ("🔊", "Accessibility Engineer", "TTS, Hausa/Pidgin Locales\nVoice System Architecture"),
    ("🧪", "QA & DevOps", "Testing, Docker, CI/CD\nSync Conflict Resolution"),
]

for i, (emoji, role, desc) in enumerate(members):
    x = Inches(1.5 + i * 2.3)
    card = add_shape(slide, x, Inches(1.8), Inches(2.1), Inches(4), RGBColor(0x2D, 0x37, 0x4D))
    add_textbox(slide, x + Inches(0.3), Inches(2), Inches(1.6), Inches(0.6),
                emoji, font_size=32, color=WHITE, align=PP_ALIGN.CENTER)
    add_textbox(slide, x + Inches(0.3), Inches(2.6), Inches(1.6), Inches(0.4),
                role, font_size=15, bold=True, color=EMERALD, align=PP_ALIGN.CENTER)
    add_textbox(slide, x + Inches(0.3), Inches(3.1), Inches(1.6), Inches(2.5),
                desc, font_size=11, color=RGBColor(0xCE, 0xD4, 0xDA), align=PP_ALIGN.CENTER)


# === SLIDE 11: THANK YOU ===
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, EMERALD)

add_textbox(slide, Inches(1.5), Inches(2), Inches(10), Inches(1.2),
            "Thank You!", font_size=56, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
add_textbox(slide, Inches(1.5), Inches(3.2), Inches(10), Inches(0.8),
            "IntelliScrap AI — Empowering Informal Recyclers", font_size=24, color=RGBColor(0xA7, 0xF3, 0xD0), align=PP_ALIGN.CENTER)

add_shape(slide, Inches(5.5), Inches(4.2), Inches(2.3), Inches(0.06), WHITE)

add_textbox(slide, Inches(1.5), Inches(4.6), Inches(10), Inches(1.5),
            "github.com/Moses2411/inteliscrap-AI\n\nTeam Nexus  |  Build with Gemma Hackathon 2026  |  ABU Zaria",
            font_size=16, color=RGBColor(0xA7, 0xF3, 0xD0), align=PP_ALIGN.CENTER)

# Save
prs.save(r"C:\Users\Moses\Desktop\MCF\IntelliScrap\IntelliScrap_Presentation.pptx")
print("Presentation saved!")
