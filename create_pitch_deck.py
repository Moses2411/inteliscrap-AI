"""
IntelliScrap AI — Business-Model-Canvas Pitch Deck
Rubric-driven, 19 slides, 16:9 (13.333 x 7.5 in).
Maps 1:1 to the judge rubric: every criterion gets its own slide +
a visible rubric tag (Core / High) in the header.
"""
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

# ----------------------------------------------------------------------------
# Palette & typography
# ----------------------------------------------------------------------------
EMERALD   = RGBColor(0x05, 0x96, 0x69)   # primary brand green
EMERALD_D = RGBColor(0x04, 0x78, 0x57)
EM_LIGHT  = RGBColor(0xEC, 0xFD, 0xF5)   # pale green fill
AMBER     = RGBColor(0xF5, 0x9E, 0x0B)
RED       = RGBColor(0xDC, 0x26, 0x26)
BLUE      = RGBColor(0x25, 0x67, 0xEB)
NAVY      = RGBColor(0x0B, 0x12, 0x20)   # deep page background
NAVY_CARD = RGBColor(0x16, 0x21, 0x33)   # card on dark
SLATE     = RGBColor(0x1E, 0x29, 0x37)   # alt dark
DARKTXT   = RGBColor(0x0F, 0x17, 0x2A)
MUTED     = RGBColor(0x64, 0x74, 0x8B)
FAINT     = RGBColor(0x94, 0xA3, 0xB8)
LIGHT     = RGBColor(0xF8, 0xFA, 0xFC)   # light page background
CARD      = RGBColor(0xFF, 0xFF, 0xFF)
BORDER    = RGBColor(0xE2, 0xE8, 0xF0)
WHITE     = RGBColor(0xFF, 0xFF, 0xFF)
SOFTGRAY  = RGBColor(0xCB, 0xD5, 0xE1)

FONT = "Segoe UI"

SW, SH = 13.333, 7.5
MX = 0.95            # content left/right margin
CW = SW - 2 * MX     # 11.433 content width

prs = Presentation()
prs.slide_width = Inches(SW)
prs.slide_height = Inches(SH)

_slide_no = [0]


# ----------------------------------------------------------------------------
# Low-level helpers
# ----------------------------------------------------------------------------
def bg(slide, color):
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = color


def rect(slide, x, y, w, h, fill, line=None, rounded=False, radius=0.09, line_w=0.75):
    st = MSO_SHAPE.ROUNDED_RECTANGLE if rounded else MSO_SHAPE.RECTANGLE
    s = slide.shapes.add_shape(st, Inches(x), Inches(y), Inches(w), Inches(h))
    if rounded:
        try:
            s.adjustments[0] = radius
        except Exception:
            pass
    if fill is None:
        s.fill.background()
    else:
        s.fill.solid()
        s.fill.fore_color.rgb = fill
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line
        s.line.width = Pt(line_w)
    s.shadow.inherit = False
    return s


def txt(slide, x, y, w, h, text, size=12, bold=False, color=DARKTXT,
        align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, font=FONT, italic=False,
        line_spacing=None):
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    p = tf.paragraphs[0]
    p.alignment = align
    p.text = text
    p.font.size = Pt(size)
    p.font.bold = bold
    p.font.italic = italic
    p.font.color.rgb = color
    p.font.name = font
    if line_spacing:
        p.line_spacing = line_spacing
    return tb


def paras(slide, x, y, w, h, items, anchor=MSO_ANCHOR.TOP):
    """items: list of dicts {text,size,bold,color,align,space_after,space_before,line}."""
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    for i, it in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = it.get("align", PP_ALIGN.LEFT)
        p.text = it.get("text", "")
        p.font.size = Pt(it.get("size", 12))
        p.font.bold = it.get("bold", False)
        p.font.italic = it.get("italic", False)
        p.font.color.rgb = it.get("color", DARKTXT)
        p.font.name = it.get("font", FONT)
        p.space_after = Pt(it.get("space_after", 0))
        p.space_before = Pt(it.get("space_before", 0))
        if it.get("line"):
            p.line_spacing = it["line"]
    return tb


def chip(slide, x, y, w, h, text, fill, color=WHITE, size=9, bold=True, line=None):
    s = rect(slide, x, y, w, h, fill, rounded=True, radius=0.5, line=line)
    tf = s.text_frame
    tf.word_wrap = False
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.margin_left = tf.margin_right = Inches(0.05)
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    p.text = text
    p.font.size = Pt(size)
    p.font.bold = bold
    p.font.color.rgb = color
    p.font.name = FONT
    return s


def card(slide, x, y, w, h, fill=CARD, line=BORDER, radius=0.06):
    return rect(slide, x, y, w, h, fill, rounded=True, radius=radius, line=line)


def footer(slide, dark=False, note=None):
    col = FAINT if not dark else RGBColor(0x4E, 0x5B, 0x6E)
    _slide_no[0] += 1
    txt(slide, MX, 7.12, 6, 0.3, "IntelliScrap AI  ·  Pitch Deck  ·  BMC",
        size=9, color=col)
    txt(slide, SW - 1.2, 7.12, 0.5, 0.3, f"{_slide_no[0]:02d}",
        size=9, color=col, align=PP_ALIGN.RIGHT)
    if note:
        txt(slide, MX + 4.4, 7.12, 6.8, 0.3, note, size=9, color=col,
            align=PP_ALIGN.RIGHT)


def header(slide, title, tag=None, sub=None, dark=False, title_size=30):
    """Standard content-slide header: left bar + title + subtitle + rubric chip."""
    bar_col = EMERALD if not dark else EMERALD
    rect(slide, 0, 0, 0.16, SH, bar_col)
    tcol = WHITE if dark else DARKTXT
    scol = SOFTGRAY if dark else MUTED
    txt(slide, MX, 0.32, 11.2, 0.62, title, size=title_size, bold=True, color=tcol)
    if sub:
        txt(slide, MX, 0.96, 11.2, 0.38, sub, size=12.5, color=scol)
    if tag:
        chip(slide, 9.35, 0.42, 3.03, 0.34, tag.upper(), EMERALD,
             size=8.5, bold=True)
    rect(slide, MX, 1.40, CW, 0.014, RGBColor(0xD8, 0xDE, 0xE7))


def icon_dot(slide, x, y, d, glyph, fill=EMERALD, gsize=16, gcolor=WHITE):
    c = rect(slide, x, y, d, d, fill, rounded=True, radius=0.5)
    tf = c.text_frame
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.margin_left = tf.margin_right = 0
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    p.text = glyph
    p.font.size = Pt(gsize)
    p.font.bold = True
    p.font.color.rgb = gcolor
    p.font.name = FONT


def stat_block(slide, x, y, w, number, label, color=EMERALD, dark=False,
               num_size=30, label_size=11):
    txt(slide, x, y, w, 0.55, number, size=num_size, bold=True, color=color)
    txt(slide, x, y + 0.52, w, 0.6, label, size=label_size,
        color=WHITE if dark else MUTED)


def add_table(slide, x, y, total_w, col_ws, rows, row_hs, header_fill,
              header_color=WHITE, body_color=DARKTXT, font_size=11,
              header_size=10.5, body_fill=CARD, alt_fill=LIGHT,
              aligns=None):
    nrows, ncols = len(rows), len(rows[0])
    total_h = sum(row_hs)
    gfx = slide.shapes.add_table(nrows, ncols, Inches(x), Inches(y),
                                 Inches(total_w), Inches(total_h))
    table = gfx.table
    table.first_row = True
    table.horz_banding = False
    for i, cw in enumerate(col_ws):
        table.columns[i].width = Inches(cw)
    for i, rh in enumerate(row_hs):
        table.rows[i].height = Inches(rh)
    for r, row in enumerate(rows):
        for c, cell_text in enumerate(row):
            cell = table.cell(r, c)
            if r == 0:
                cell.fill.solid()
                cell.fill.fore_color.rgb = header_fill
                col = header_color
                bold = True
                sz = header_size
            else:
                cell.fill.solid()
                cell.fill.fore_color.rgb = body_fill if r % 2 == 1 else alt_fill
                col = body_color
                bold = False
                sz = font_size
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            cell.margin_left = Inches(0.09)
            cell.margin_right = Inches(0.07)
            cell.margin_top = Inches(0.03)
            cell.margin_bottom = Inches(0.03)
            tf = cell.text_frame
            tf.word_wrap = True
            lines = cell_text if isinstance(cell_text, (list, tuple)) else [cell_text]
            for k, ln in enumerate(lines):
                p = tf.paragraphs[0] if k == 0 else tf.add_paragraph()
                p.text = ln
                p.font.size = Pt(sz if k > 0 or r > 0 else sz)
                p.font.bold = bold if (k == 0) else False
                p.font.color.rgb = col
                p.font.name = FONT
                if aligns:
                    p.alignment = aligns[c]
                p.line_spacing = 1.0
    return table


def new_slide(bgcolor):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    bg(s, bgcolor)
    return s


# ============================================================================
# SLIDE 1 — TITLE
# ============================================================================
s = new_slide(NAVY)
rect(s, 0, 0, 0.22, SH, EMERALD)
rect(s, 0.22, 0, 0.045, SH, EMERALD_D)

chip(s, MX, 1.02, 5.6, 0.36, "BUILD WITH GEMMA · GEMMA FOR GOOD 2026",
     EMERALD, size=10, bold=True)
txt(s, MX, 1.6, 11.2, 1.3, "IntelliScrap AI", size=64, bold=True, color=WHITE)
txt(s, MX, 2.8, 11.2, 0.95,
    "The offline-first AI co-pilot that makes informal recycling safer, fairer, and traceable.",
    size=22, color=SOFTGRAY)
rect(s, MX, 3.95, 2.2, 0.055, EMERALD)
txt(s, MX, 4.2, 11.2, 0.75,
    "Empowering informal waste pickers — the Baban Bola of Northern Nigeria — with "
    "multimodal edge intelligence in Hausa, Pidgin and English.",
    size=15, color=FAINT, line_spacing=1.15)

tags = [("OFFLINE-FIRST PWA", 0), ("EDGE AI · ZERO DATA COST", 1),
        ("3 LANGUAGES · VOICE-FIRST", 2), ("MARKETPLACE + EPR COMPLIANCE", 3)]
for label, i in tags:
    chip(s, MX + i * 2.85, 5.35, 2.7, 0.4, label, NAVY_CARD, color=EM_LIGHT,
         size=9.5, line=RGBColor(0x2A, 0x3A, 0x52))

txt(s, MX, 6.55, 8, 0.35, "TEAM NEXUS  ·  ABU ZARIA  ·  TRACK 1 — LOCAL LANGUAGES & LITERACY",
    size=11.5, color=RGBColor(0x7C, 0x8A, 0x9F))
txt(s, SW - MX - 4.2, 6.55, 4.2, 0.35, "github.com/Moses2411/inteliscrap-AI",
    size=11.5, color=RGBColor(0x7C, 0x8A, 0x9F), align=PP_ALIGN.RIGHT)
_slide_no[0] += 1

# ============================================================================
# SLIDE 2 — THE PROBLEM
# ============================================================================
s = new_slide(LIGHT)
header(s, "The Problem", tag="Problem — Evidence",
       sub="Evidenced pain points at the bottom of the recycling chain")
problems = [
    ("🧯", "HEALTH — toxic e-waste, handled blind",
     ["Leaking batteries, mercury tubes and bloated lithium cells are picked up bare-handed.",
      "Result: chemical burns, lead poisoning and respiratory illness."]),
    ("💰", "MONEY — collectors squeezed by middlemen",
     ["Cart-pushers and pickers rarely know grades or prices.",
      "Reported payouts run 30–50% below fair value — no bargaining power."]),
    ("🛒", "CART ECONOMY — households short-changed at the door",
     ["Roaming cart-pushers buy scrap door-to-door at whatever price they name.",
      "Households sell valuable scrap for cents; the real value leaves the home."]),
    ("🌍", "ENVIRONMENT — open burning & dumping",
     ["Heavy metals leach into soil and groundwater.",
      "Zaria's Kubanni watershed and surrounding farmland are directly threatened."]),
]
positions = [(MX, 1.62), (6.76, 1.62), (MX, 3.86), (6.76, 3.86)]
for (x, y), (ic, t, bl) in zip(positions, problems):
    card(s, x, y, 5.62, 2.06)
    icon_dot(s, x + 0.26, y + 0.22, 0.54, ic, EMERALD, 15)
    txt(s, x + 0.94, y + 0.24, 4.55, 0.55, t, size=12.5, bold=True, color=DARKTXT,
        line_spacing=1.0)
    paras(s, x + 0.26, y + 0.92, 5.15, 1.05,
          [{"text": "•  " + b, "size": 10.5, "color": MUTED, "space_after": 4,
            "line": 1.1} for b in bl])

# Evidence strip
b = rect(s, 0, 6.02, SW, 1.1, NAVY)
txt(s, MX, 6.14, 5, 0.28, "WHY IT MATTERS — EVIDENCE", size=10, bold=True,
    color=EMERALD)
txt(s, 6.2, 6.16, 6.18, 0.26, "Commonly cited estimates — full sources on request.",
    size=8, color=RGBColor(0x6B, 0x7A, 0x8F), align=PP_ALIGN.RIGHT)
stats = [("~62M t", "global e-waste / yr"),
         (">1.1M t/yr", "Nigeria e-waste"),
         ("60–90%", "informal-hand flows"),
         ("6 hubs", "recognised in Zaria")]
for i, (n, l) in enumerate(stats):
    stat_block(s, MX + i * 2.9, 6.44, 2.7, n, l, color=EM_LIGHT, dark=True,
               num_size=19, label_size=8.5)
footer(s)

# ============================================================================
# SLIDE 3 — THE SOLUTION
# ============================================================================
s = new_slide(NAVY)
header(s, "Our Solution", tag="Product — Core", dark=True,
       sub="A multimodal, offline-first co-pilot in every picker's pocket")
steps = [
    ("1", "Snap", "Capture dirty, broken scrap with any phone camera — no special kit needed."),
    ("2", "Edge AI", "Classification runs on-device — works fully offline with zero data cost."),
    ("3", "Safety + Price", "Hazard flags and a fair ₦/kg price from the live market matrix."),
    ("4", "Local Voice", "Reads the result aloud in Hausa, Pidgin or English; one tap lists it for doorstep pickup."),
]
for i, (num, t, d) in enumerate(steps):
    x = MX + i * 2.97
    c = rect(s, x + 0.62, 1.62, 0.72, 0.72, EMERALD, rounded=True, radius=0.5)
    tf = c.text_frame
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    p.text = num
    p.font.size = Pt(22)
    p.font.bold = True
    p.font.color.rgb = WHITE
    p.font.name = FONT
    if i < 3:
        txt(s, x + 1.42, 1.86, 0.5, 0.3, "→", size=20, bold=True, color=EMERALD)
    card(s, x, 2.58, 2.72, 2.5, fill=NAVY_CARD, line=RGBColor(0x28, 0x39, 0x53))
    txt(s, x + 0.25, 2.8, 2.25, 0.4, t, size=15, bold=True, color=EM_LIGHT)
    txt(s, x + 0.25, 3.28, 2.25, 1.6, d, size=10.5, color=RGBColor(0xA5, 0xB4, 0xC7),
        line_spacing=1.1)

b = rect(s, 0, 5.42, SW, 0.78, SLATE)
txt(s, MX, 5.56, 11.4, 0.5,
    "Honesty by design — every result carries a source badge (edge / server / manual). "
    "We never fabricate an answer.",
    size=14, bold=True, color=WHITE)
chips = [("8 material classes",), ("15 hazard types",), ("3 languages",),
         ("Edge → server → fallback",)]
for i, (t_,) in enumerate(chips):
    chip(s, MX + i * 2.9, 6.42, 2.72, 0.38, t_, RGBColor(0x1B, 0x29, 0x40),
         color=SOFTGRAY, size=9.5, line=RGBColor(0x2A, 0x3A, 0x52))
footer(s, dark=True)

# ============================================================================
# SLIDE 4 — CUSTOMER SEGMENTS
# ============================================================================
s = new_slide(LIGHT)
header(s, "Customer Segments", tag="Segments — Core",
       sub="Specific, well-evidenced target groups — prioritised for a Zaria-first pilot")
segs = [
    ("PRIMARY", "Informal Collectors — “Baban Bola”",
     ["Hundreds active across Zaria's six recognised hubs (Samaru, Sabon Gari, Kongo, "
      "Bomo, Hanwa, Dutsen Abba).", "Handle the large majority of recoverable scrap; "
      "daily toxic exposure, no priced market access."]),
    ("PRIMARY", "Households & Small Sellers",
     ["Homes, shops and offices holding scrap — batteries, cables, PET bottles.",
      "List it once → fair offers → doorstep pickup: passive home income from scrap that today is given away."]),
    ("SECONDARY", "Recycling Hubs & Aggregators",
     ["Need predictable, quality-sorted supply and verifiable sourcing.",
      "Pay for volume and for evidence of origin (EPR-ready)."]),
    ("B2B", "PROs, NGOs & EPR Bodies",
     ["Regulated producers need auditable collection data for compliance.",
      "NGOs need measurable impact to report to funders and regulators."]),
]
positions = [(MX, 1.62), (6.62, 1.62), (MX, 3.92), (6.62, 3.92)]
for (x, y), (tag, t, bl) in zip(positions, segs):
    card(s, x, y, 5.72, 2.12)
    cc = EMERALD if tag in ("PRIMARY",) else (AMBER if tag == "SECONDARY" else BLUE)
    chip(s, x + 0.25, y + 0.2, 1.35, 0.28, tag, cc, size=8.5)
    txt(s, x + 1.7, y + 0.18, 3.95, 0.35, t, size=12.5, bold=True, color=DARKTXT)
    paras(s, x + 0.25, y + 0.62, 5.25, 1.4,
          [{"text": "•  " + b, "size": 10.5, "color": MUTED, "space_after": 4,
            "line": 1.08} for b in bl])
txt(s, MX, 6.24, 11.4, 0.35,
    "Segments are encoded in the product: USSD preset hubs, collector / seller / hub roles, "
    "and NGO + compliance dashboards.",
    size=10.5, color=MUTED, italic=True)
footer(s)

# ============================================================================
# SLIDE 5 — VALUE PROPOSITIONS
# ============================================================================
s = new_slide(CARD)
header(s, "Value Propositions", tag="Value — Core",
       sub="Clear benefits tied to named problems — for every segment")
vps = [
    ("💰", "For Collectors", "Fair prices + dispatched jobs.",
     "Live ₦/kg matrix lifts per-load income; the H3 grid routes pickups to their door instead of door-to-door hunting.",
     "Solves: middleman squeeze & unpredictable cart income."),
    ("🗣️", "For Collectors & Sellers", "Safety that speaks their language.",
     "Hazard alerts and handling instructions voiced in Hausa and Pidgin.",
     "Solves: blind handling of toxic e-waste."),
    ("🏠", "For Households", "Passive home income from scrap.",
     "Household scrap listed once is collected with fair, competing offers — no giveaways, no cents-at-the-door.",
     "Solves: uninformed cart-pusher deals."),
    ("🧾", "For Hubs, PROs & NGOs", "Traceable, audit-ready supply.",
     "Daily buy-requests with live fill progress and EPR-ready exports.",
     "Solves: unreliable feedstock & unverifiable compliance."),
]
positions = [(MX, 1.62), (6.62, 1.62), (MX, 4.02), (6.62, 4.02)]
for (x, y), (ic, who, head, body, sol) in zip(positions, vps):
    card(s, x, y, 5.72, 2.22)
    icon_dot(s, x + 0.26, y + 0.24, 0.56, ic, EMERALD, 16)
    txt(s, x + 0.95, y + 0.28, 4.6, 0.35, who, size=11.5, bold=True, color=EMERALD_D)
    txt(s, x + 0.26, y + 0.92, 5.2, 0.4, head, size=14.5, bold=True, color=DARKTXT)
    txt(s, x + 0.26, y + 1.32, 5.2, 0.6, body, size=11, color=MUTED, line_spacing=1.08)
    txt(s, x + 0.26, y + 1.86, 5.2, 0.3, sol, size=10, italic=True, color=EMERALD_D)
txt(s, MX, 6.42, 11.4, 0.35,
    "Every benefit above maps 1:1 to a problem named on the Problem slide — benefit, "
    "not feature.", size=10.5, color=MUTED, italic=True)
footer(s)

# ============================================================================
# SLIDE 6 — PROBLEM–SOLUTION FIT
# ============================================================================
s = new_slide(LIGHT)
header(s, "Problem–Solution Fit", tag="Fit — High",
       sub="Evidenced problem → logical solution → measurable outcome")
rows = [
    ["Problem (evidenced)", "Solution (already delivered)", "Outcome (measurable)"],
    [["Toxic e-waste handled blind", "burns, poisonings, illness"],
     ["Edge classifier flags hazards;", "local audio in Hausa / Pidgin"],
     ["Fewer injuries; safer handling habits"]],
    [["Middlemen underpay via", "information asymmetry"],
     ["Always-on ₦/kg matrix +", "source-badged results"],
     ["Higher collector earnings and bargaining power"]],
    [["Door-to-door cart buying is uninformed", "— households get cents for scrap"],
     ["Household listing → fair offers →", "dispatched doorstep pickup"],
     ["Passive home income; collectors get steady jobs"]],
    [["No safe selling / deposit channel", "for households"],
     ["Listing → H3 grid dispatch →", "SMS / USSD offers → settlement"],
     ["More volume to registered hubs, fully traceable"]],
    [["EPR compliance is unmeasured", "and costly to prove"],
     ["Per-settlement compliance", "manifesto exported via API"],
     ["Audit-ready data for PROs, NGOs and regulators"]],
]
add_table(s, MX, 1.62, CW, [3.6, 4.4, 3.43], rows, [0.42, 0.66, 0.78, 0.78, 0.78, 0.78],
          EMERALD, header_color=WHITE, body_color=DARKTXT, font_size=10.5,
          header_size=11, body_fill=CARD, alt_fill=RGBColor(0xF1, 0xF7, 0xF4))
txt(s, MX, 6.2, 11.4, 0.35,
    "The fit is instrumented end-to-end: scan → classify → price → list → dispatch → settle → "
    "compliance record.",
    size=11, bold=True, color=EMERALD_D)
footer(s)

# ============================================================================
# SLIDE 7 — CHANNELS
# ============================================================================
s = new_slide(CARD)
header(s, "Channels", tag="Channels — Core",
       sub="Realistic, context-appropriate reach — digital where it works, low-tech where it must")
chans = [
    ("📱", "Offline-first PWA",
     ["Install once from a QR / share link handed out at hubs.",
      "Households list scrap at home; collectors receive job offers on the same screen — fully offline."], "home"),
    ("*️⃣", "USSD  *347*101#",
     ["Self-registration and menus run on any feature phone.",
      "Six preset hub locations; no smartphone or app store needed."], "0"),
    ("✉️", "SMS + Voice (IVR)",
     ["OTP login, pickup offers and ‘accept by reply’ messaging.",
      "Runs on Africa's Talking rails with a retry outbox worker."], "off"),
    ("🤝", "On-field onboarding",
     ["Agents at hubs and community gates walk pickers through signup.",
      "NGO and community-radio routes spread trusted word-of-mouth."], "local"),
]
positions = [(MX, 1.62), (6.62, 1.62), (MX, 3.92), (6.62, 3.92)]
for (x, y), (ic, t, bl, _) in zip(positions, chans):
    card(s, x, y, 5.72, 2.05)
    icon_dot(s, x + 0.26, y + 0.22, 0.56, ic, BLUE, 16)
    txt(s, x + 0.95, y + 0.26, 4.6, 0.4, t, size=13.5, bold=True, color=DARKTXT)
    paras(s, x + 0.26, y + 0.98, 5.2, 1.0,
          [{"text": "•  " + b, "size": 10.5, "color": MUTED, "space_after": 3,
            "line": 1.08} for b in bl])
b = rect(s, 0, 6.24, SW, 0.62, NAVY)
txt(s, MX, 6.38, 11.4, 0.4,
    "No paid advertising in year one — distribution rides existing community, hub and "
    "telecom rails.", size=12.5, bold=True, color=WHITE)
footer(s)

# ============================================================================
# SLIDE 8 — CUSTOMER RELATIONSHIPS
# ============================================================================
s = new_slide(LIGHT)
header(s, "Customer Relationships", tag="Relationships — Core",
       sub="A trust & retention plan built for low-literacy, offline users")
life = [("ACQUIRE", "Onfield + USSD + PWA install at hubs"),
        ("ONBOARD", "Consent-first signup; voice-guided first scan"),
        ("RETAIN", "Fair prices, source-badged results, SMS follow-ups"),
        ("GROW", "Scans → listings → settlements → visible income")]
for i, (k, v) in enumerate(life):
    x = MX + i * 2.92
    rect(s, x, 1.58, 2.68, 0.92, CARD, line=BORDER, rounded=True, radius=0.14)
    txt(s, x + 0.18, 1.68, 2.4, 0.3, k, size=10.5, bold=True, color=EMERALD_D)
    txt(s, x + 0.18, 1.98, 2.4, 0.5, v, size=9.5, color=MUTED, line_spacing=1.0)
    if i < 3:
        txt(s, x + 2.64, 1.75, 0.35, 0.3, "→", size=14, bold=True, color=EMERALD)

pillars = [
    ("🗣️", "Voice-first experience",
     "TTS in Hausa, Pidgin & English with a visual-first UI — usable by non-readers."),
    ("🔍", "Radical transparency",
     "Every result shows its source (edge / server / manual); we never fabricate."),
    ("⚖️", "Fairness loop",
     "Price shown before accept; offer exclusivity prevents double-selling; settlement history is open."),
    ("📴", "Offline reliability",
     "Scans persist locally (IndexedDB) and sync when connectivity returns — no lost work."),
]
positions = [(MX, 2.86), (6.62, 2.86), (MX, 4.56), (6.62, 4.56)]
for (x, y), (ic, t, d) in zip(positions, pillars):
    card(s, x, y, 5.72, 1.5)
    icon_dot(s, x + 0.24, y + 0.22, 0.5, ic, EMERALD, 13)
    txt(s, x + 0.88, y + 0.22, 4.7, 0.35, t, size=12.5, bold=True, color=DARKTXT)
    txt(s, x + 0.88, y + 0.6, 4.65, 0.8, d, size=10.5, color=MUTED, line_spacing=1.08)
txt(s, MX, 6.28, 11.4, 0.35,
    "Retention loop: every scan can become a priced listing, a settled pickup and impact "
    "evidence — value users can see and re-use.",
    size=10.5, color=MUTED, italic=True)
footer(s)

# ============================================================================
# SLIDE 9 — REVENUE STREAMS
# ============================================================================
s = new_slide(CARD)
header(s, "Revenue Streams", tag="Revenue — High",
       sub="Grounded pricing logic — the arithmetic is already implemented")
revs = [
    ("📈", "Platform transaction fee",
     ["5% of gross value on every settled pickup (platform_fee_rate = 0.05, in code).",
      "Example: 10 kg copper @ ₦3,200/kg = ₦32,000 gross → ₦1,600 fee."]),
    ("🏭", "Hub subscription",
     ["₦50,000 / month “Pro” plan per registered recycling hub (implemented).",
      "Recurring B2B base with renewal billing (next_billing_at)."]),
    ("🧾", "Compliance & data products",
     ["API-key EPR manifesto exports + impact analytics sold to PROs and NGOs.",
      "Replaces costly manual audits with a verifiable ledger."]),
]
for i, (ic, t, bl) in enumerate(revs):
    x = MX + i * 3.95
    card(s, x, 1.62, 3.62, 2.6)
    icon_dot(s, x + 0.26, 1.84, 0.56, ic, EMERALD, 16)
    txt(s, x + 0.26, 2.56, 3.1, 0.4, t, size=13.5, bold=True, color=DARKTXT)
    paras(s, x + 0.26, 3.0, 3.12, 1.2,
          [{"text": "•  " + b, "size": 10.5, "color": MUTED, "space_after": 4,
            "line": 1.1} for b in bl])

b = rect(s, 0, 4.55, SW, 1.35, NAVY)
txt(s, MX, 4.72, 6, 0.3, "UNIT ECONOMICS — SAMPLE LOGIC", size=10.5, bold=True,
    color=EMERALD)
ue = [("≈ ₦0", "marginal cost per scan — edge inference runs on-device"),
      ("₦5–15", "cost per SMS / USSD event — online touchpoints only"),
      ("₦200K/mo", "4 hub subscriptions ≈ hosting + ~1,000 pickups' SMS + pilot ops")]
for i, (n, l) in enumerate(ue):
    stat_block(s, MX + i * 3.9, 5.12, 3.7, n, l, color=EM_LIGHT, dark=True,
               num_size=21, label_size=9.5)
txt(s, MX, 6.12, 11.4, 0.35,
    "Illustrative — figures traceable to implemented config (fee rate, plan price).",
    size=9.5, color=RGBColor(0x6B, 0x7A, 0x8F))
footer(s)

# ============================================================================
# SLIDE 10 — KEY RESOURCES
# ============================================================================
s = new_slide(LIGHT)
header(s, "Key Resources", tag="Resources — Core",
       sub="Realistic for a pre-revenue, hackathon-stage team")
res = [
    ("🛠️", "Working product",
     "Offline-first PWA + FastAPI backend; Docker + CI deployable to Render / Vercel."),
    ("🧠", "AI stack",
     "On-device ONNX classifier, server vision fallback, zero-shot runtime; export & verify pipeline."),
    ("📊", "Data assets",
     "₦ price matrix (8 classes incl. hazard flags); 3-language dictionaries with 15 hazard types + safety templates."),
    ("📡", "Field rails",
     "USSD / SMS / IVR on Africa's Talking; Uber-H3 hex dispatch; Postgres ledger; compliance API."),
    ("👥", "Team of five",
     "Named owners across backend, frontend, edge AI, audio & DevOps — all ABU Zaria."),
]
positions = [(MX, 1.62), (6.62, 1.62), (MX, 3.62), (6.62, 3.62), (MX, 5.62)]
for (x, y), (ic, t, d) in zip(positions, res):
    w = 5.72 if y < 5.2 else CW
    card(s, x, y, w, 1.7 if y < 5.2 else 1.1)
    icon_dot(s, x + 0.24, y + 0.2, 0.5, ic, EMERALD, 13)
    txt(s, x + 0.86, y + 0.2, w - 1.0, 0.35, t, size=12.5, bold=True, color=DARKTXT)
    txt(s, x + 0.86, y + 0.58, w - 1.1, 1.05, d, size=10.5, color=MUTED,
        line_spacing=1.08)
txt(s, MX, 6.78, 11.4, 0.35,
    "Owned: code, tests, integrations. Needed next: community-labelled field images, "
    "2–3 pilot hubs, seed capital for field ops.",
    size=10.5, color=MUTED, italic=True)
footer(s)

# ============================================================================
# SLIDE 11 — KEY ACTIVITIES
# ============================================================================
s = new_slide(CARD)
header(s, "Key Activities", tag="Activities — Core",
       sub="A phased execution plan — what we do, and in what order")
acts = [
    ("P1 · NOW → M1", "Field data & model",
     ["Gather + label dirty field scrap with the community.",
      "Fine-tune edge ONNX classifier; verify on real phone hardware."]),
    ("P2 · M1 → M3", "Zaria pilot",
     ["Launch in 2–3 hubs: Samaru, Sabon Gari, Kongo.",
      "Field onboarding agents; USSD + SMS live; first settled pickups."]),
    ("P3 · M3 → M6", "Marketplace growth",
     ["Onboard 5+ registered hubs with daily buy-requests.",
      "Run fee settlement + subscription; publish impact dashboard."]),
    ("P4 · M6 → M12", "Compliance & scale",
     ["Sign one PRO / EPR compliance pilot; manifesto exports live.",
      "Package the playbook and replicate in a second city."]),
]
for i, (ph, t, bl) in enumerate(acts):
    x = MX + (i % 2) * 5.94
    y = 1.62 + (i // 2) * 2.42
    card(s, x, y, 5.72, 2.2)
    txt(s, x + 0.26, y + 0.2, 5.2, 0.3, ph, size=10, bold=True, color=EMERALD_D)
    txt(s, x + 0.26, y + 0.52, 5.2, 0.4, t, size=14.5, bold=True, color=DARKTXT)
    paras(s, x + 0.26, y + 1.0, 5.25, 1.05,
          [{"text": "•  " + b, "size": 10.5, "color": MUTED, "space_after": 3,
            "line": 1.08} for b in bl])
txt(s, MX, 6.62, 11.4, 0.35,
    "Execution machinery is already built — 60+ automated tests cover dispatch, USSD, "
    "sync conflicts and settlement.",
    size=11, bold=True, color=EMERALD_D)
footer(s)

# ============================================================================
# SLIDE 12 — KEY PARTNERSHIPS
# ============================================================================
s = new_slide(LIGHT)
header(s, "Key Partnerships", tag="Partnerships — Core",
       sub="Named partners with explicit value flowing in both directions")
parts = [
    ("Recycling hubs & aggregators", "Verified supply + traceable feedstock",
     "Demand volume, platform fees, subscriptions"),
    ("Africa's Talking", "USSD / SMS / voice channel volume",
     "Reliable messaging rails for OTP, offers, outbox"),
    ("Telecoms (MTN / Airtel / 9mobile)", "Service adoption and usage data",
     "Shortcode + zero-rated app access for pickers"),
    ("PROs / EPR bodies", "Auditable compliance data at scale",
     "B2B revenue and industry legitimacy"),
    ("NGOs & local government", "Impact metrics and a safer sector",
     "Funding, community trust, field access"),
    ("ABU Zaria community", "Real-world dataset and research case",
     "Validation, talent pipeline, local ties"),
]
positions = [(MX, 1.62), (4.72, 1.62), (8.49, 1.62),
             (MX, 3.62), (4.72, 3.62), (8.49, 3.62)]
for (x, y), (who, give, get) in zip(positions, parts):
    card(s, x, y, 3.62, 1.78)
    rect(s, x, y, 3.62, 0.06, EMERALD)
    txt(s, x + 0.24, y + 0.14, 3.15, 0.55, who, size=11.5, bold=True, color=DARKTXT,
        line_spacing=1.0)
    paras(s, x + 0.24, y + 0.72, 3.18, 1.0, [
        {"text": "GIVE:  " + give[:60] + ("…" if len(give) > 60 else ""),
         "size": 9.5, "color": EMERALD_D, "space_after": 3, "line": 1.05},
        {"text": "GET:  " + get[:60] + ("…" if len(get) > 60 else ""),
         "size": 9.5, "color": MUTED, "line": 1.05},
    ])
txt(s, MX, 5.62, 11.4, 0.35,
    "Partnerships are structured as exchanges, not donations — each partner's incentive "
    "is explicit.", size=10.5, color=MUTED, italic=True)
footer(s)

# ============================================================================
# SLIDE 13 — COST STRUCTURE
# ============================================================================
s = new_slide(CARD)
header(s, "Cost Structure", tag="Costs — High",
       sub="Simple, consistent unit economics that the revenue streams cover")
rows = [
    ["Item", "Type", "Estimate", "Notes"],
    ["Cloud hosting (backend, DB, CDN)", "Fixed", "~US$30 / month",
     "Render / Railway small tier"],
    ["SMS, USSD & voice", "Variable", "₦5–15 per event",
     "Africa's Talking; online touchpoints only"],
    ["Model training compute", "One-off", "Low",
     "Hackathon GPU / Colab allocations"],
    ["Field onboarding (agents, SIMs, fuel)", "Pilot", "~₦150–250K / month",
     "2–3 agents across Zaria hubs"],
    ["Compliance & ops overhead", "Fixed", "Small",
     "Monitoring, API keys, admin"]]
add_table(s, MX, 1.62, CW, [3.6, 1.3, 2.2, 4.33], rows,
          [0.4, 0.56, 0.56, 0.56, 0.56, 0.56],
          EMERALD, header_color=WHITE, body_color=DARKTXT, font_size=11,
          header_size=11, body_fill=CARD, alt_fill=RGBColor(0xF1, 0xF7, 0xF4),
          aligns=[PP_ALIGN.LEFT, PP_ALIGN.LEFT, PP_ALIGN.LEFT, PP_ALIGN.LEFT])
b = rect(s, 0, 5.78, SW, 0.85, NAVY)
txt(s, MX, 5.98, 11.4, 0.5,
    "Cash-flow logic: every hub subscription covers ~1,000 pickups' SMS envelope; "
    "transaction fees become incremental margin once fixed costs are covered.",
    size=12.5, bold=True, color=WHITE)
footer(s)

# ============================================================================
# SLIDE 14 — VALIDATION / TRACTION
# ============================================================================
s = new_slide(LIGHT)
header(s, "Validation / Traction", tag="Traction — High",
       sub="Real-world testing with numbers — and an honest gap")
card(s, MX, 1.62, 5.85, 3.9)
txt(s, MX + 0.3, 1.84, 5.2, 0.4, "✅  Already proven — with numbers", size=14,
    bold=True, color=EMERALD_D)
vitems = [
    "60+ automated tests green — H3 dispatch, USSD flows, sync conflicts, settlement, auth.",
    "End-to-end PWA: edge ONNX → server vision → honest manual picker (never fabricated).",
    "USSD *347*101# with 6 preset hubs; SMS offers & OTP; IVR accept — working.",
    "Real economics live: 5% fee settlement, ₦50,000/mo hub subscriptions, EPR manifesto API.",
    "Demo environment with settled transactions, live hub buy-requests and impact aggregates.",
    "Household listing flow live: scan → list at home → dispatched collector → settled payout.",
]
paras(s, MX + 0.3, 2.34, 5.35, 3.1,
      [{"text": "•  " + b, "size": 11, "color": MUTED, "space_after": 6, "line": 1.15}
       for b in vitems])

card(s, 7.02, 1.62, 5.85, 3.9, fill=NAVY, line=None)
txt(s, 7.32, 1.84, 5.2, 0.4, "Honest gap — and next step", size=14, bold=True,
    color=EM_LIGHT)
paras(s, 7.32, 2.34, 5.3, 3.1, [
    {"text": "We have not yet field-piloted at scale.",
     "size": 11.5, "bold": True, "color": WHITE, "space_after": 8, "line": 1.15},
    {"text": "Next: a 3-month Zaria pilot — 3 hubs, 500 collectors — tracking scans, "
             "settled pickups, income uplift and hazard alerts delivered.",
     "size": 11, "color": SOFTGRAY, "space_after": 8, "line": 1.15},
    {"text": "The metrics are already instrumented in the impact dashboard — the pilot "
             "simply turns them on in the field.",
     "size": 11, "color": SOFTGRAY, "line": 1.15},
])
strips = [("8", "material classes"), ("3", "languages"), ("15", "hazard types"),
          ("6", "preset hubs"), ("5%", "fee live"), ("60+", "tests green")]
for i, (n, l) in enumerate(strips):
    x = MX + i * 1.94
    rect(s, x, 5.72, 1.76, 0.72, CARD, line=BORDER, rounded=True, radius=0.16)
    txt(s, x, 5.8, 1.76, 0.35, n, size=15, bold=True, color=EMERALD, align=PP_ALIGN.CENTER)
    txt(s, x, 6.18, 1.76, 0.25, l, size=8.5, color=MUTED, align=PP_ALIGN.CENTER)
footer(s)

# ============================================================================
# SLIDE 15 — SCALABILITY
# ============================================================================
s = new_slide(NAVY)
header(s, "Scalability", tag="Scale — Core", dark=True,
       sub="A credible path beyond the first market — Zaria → Kaduna → Nigeria → West Africa")
sc = [
    ("🗺️", "Replicable playbook",
     "Every city is a set of hex-coded hubs. The same PWA + USSD stack launches a new "
     "city at very low cost."),
    ("🔁", "Network effects",
     "More collectors → denser supply → stronger hub demand → richer price data → a "
     "stronger value proposition."),
    ("🧱", "Data moat",
     "A proprietary price + collection dataset grows with every city — valuable to PROs, "
     "NGOs and policy."),
    ("⚖️", "Regulatory tailwind",
     "Nigeria's EPR obligations push producers toward auditable collection — we are "
     "purpose-built for exactly that."),
    ("0️⃣", "Near-zero marginal cost",
     "Edge-first inference means each new user adds negligible cloud cost — scale "
     "does not inflate infrastructure."),
]
for i, (ic, t, d) in enumerate(sc):
    x = MX + i * 2.37
    card(s, x, 1.66, 2.16, 3.55, fill=NAVY_CARD, line=RGBColor(0x26, 0x37, 0x50))
    txt(s, x + 0.2, 1.86, 1.8, 0.5, ic, size=20)
    txt(s, x + 0.2, 2.42, 1.8, 0.7, t, size=12.5, bold=True, color=EM_LIGHT,
        line_spacing=1.0)
    txt(s, x + 0.2, 3.2, 1.78, 1.9, d, size=9.5, color=RGBColor(0xA5, 0xB4, 0xC7),
        line_spacing=1.12)
b = rect(s, 0, 5.62, SW, 0.85, SLATE)
txt(s, MX, 5.84, 11.4, 0.5,
    "Offline-first isn't just for the first market — it fits the next hundred.",
    size=14, bold=True, color=WHITE)
footer(s, dark=True)

# ============================================================================
# SLIDE 16 — TEAM EXECUTION CAPACITY
# ============================================================================
s = new_slide(LIGHT)
header(s, "Team Execution Capacity", tag="Team — Core",
       sub="Defined roles, relevant capability, proven delivery")
team = [
    ("Backend & Database Lead",
     ["FastAPI, Postgres / SQLite", "Sync engine & conflict resolution",
      "Settlement & H3 dispatch"]),
    ("Frontend & PWA Architect",
     ["React / TypeScript / Tailwind PWA", "Offline storage (Dexie / IndexedDB)",
      "UI/UX & camera flows"]),
    ("Edge AI & On-Device ML",
     ["ONNX runtime integration", "Vision fallback chain",
      "Model export & verification"]),
    ("Accessibility & Audio",
     ["TTS voice system", "Hausa / Pidgin locales", "Low-literacy UX design"]),
    ("QA, DevOps & Sync",
     ["60+ automated tests", "Docker + CI/CD", "Deployment & monitoring"]),
]
for i, (t, bl) in enumerate(team):
    x = MX + i * 2.31
    card(s, x, 1.62, 2.12, 3.5)
    rect(s, x, 1.62, 2.12, 0.07, EMERALD)
    txt(s, x + 0.2, 1.9, 1.75, 0.9, t, size=12, bold=True, color=DARKTXT, line_spacing=1.0)
    paras(s, x + 0.2, 2.85, 1.76, 2.2,
          [{"text": "•  " + b, "size": 9.5, "color": MUTED, "space_after": 4,
            "line": 1.06} for b in bl])
txt(s, MX, 5.5, 11.4, 0.4,
    "Evidence of execution: a shipped monorepo with CI, Docker deployment, and a "
    "multi-contributor commit history across five team members.",
    size=11.5, bold=True, color=EMERALD_D)
footer(s)

# ============================================================================
# SLIDE 17 — RISK AWARENESS
# ============================================================================
s = new_slide(CARD)
header(s, "Risk Awareness", tag="Risks — Core",
       sub="Named risks with concrete mitigation plans")
rows = [
    ["Risk", "Sev.", "Mitigation plan"],
    ["Field accuracy on dirty / partial scrap", "High",
     "Community-labelled training data; edge + server dual path; honest manual fallback"],
    ["Low smartphone penetration & literacy", "High",
     "USSD / SMS / IVR feature-phone path; voice-first UI in Hausa, Pidgin, English"],
    ["Adoption & trust in the informal economy", "Med",
     "Co-design with Baban Bola; hub & community endorsement; visible price proof"],
    ["Scrap price volatility", "Med",
     "Admin-managed price matrix; periodic market syncs; cached offline prices"],
    ["Data privacy & consent", "Med",
     "Consent-first registration (USSD); minimal data; JWT-authenticated APIs"],
    ["EPR regulatory change", "Low",
     "Configurable, auditable exports that adapt to rule updates"],
]
add_table(s, MX, 1.62, CW, [3.9, 0.8, 6.73], rows, [0.4, 0.62, 0.62, 0.62, 0.62, 0.62, 0.62],
          EMERALD, header_color=WHITE, body_color=DARKTXT, font_size=10.5,
          header_size=11, body_fill=CARD, alt_fill=RGBColor(0xF1, 0xF7, 0xF4))
txt(s, MX, 6.15, 11.4, 0.35,
    "Every risk has a named owner on the team and a test or pilot milestone attached.",
    size=10.5, color=MUTED, italic=True)
footer(s)

# ============================================================================
# SLIDE 18 — THE ASK
# ============================================================================
s = new_slide(NAVY)
header(s, "The Ask", dark=True, tag="Next step",
       sub="What we need in the next 12 months to hit pilot numbers")
asks = [
    ("🤝", "Pilot partners",
     "2–3 Zaria recycling hubs and one NGO for field onboarding — as value-exchange "
     "partners, detailed earlier."),
    ("💰", "Seed funding",
     "≈ ₦2–4M for a 3-month pilot: field agents, SMS volume, incentives and labelled "
     "data collection."),
    ("🏛️", "Access & intros",
     "One PRO / EPR compliance pilot, plus telecom shortcode and zero-rating support."),
]
for i, (ic, t, d) in enumerate(asks):
    x = MX + i * 3.95
    card(s, x, 1.62, 3.62, 2.5, fill=NAVY_CARD, line=RGBColor(0x26, 0x37, 0x50))
    txt(s, x + 0.26, 1.82, 3.1, 0.5, ic, size=20)
    txt(s, x + 0.26, 2.44, 3.1, 0.4, t, size=14, bold=True, color=EM_LIGHT)
    txt(s, x + 0.26, 2.92, 3.12, 1.1, d, size=10.5, color=RGBColor(0xA5, 0xB4, 0xC7),
        line_spacing=1.12)

b = rect(s, 0, 4.52, SW, 1.85, SLATE)
txt(s, MX, 4.7, 8, 0.3, "12-MONTH TARGETS", size=10.5, bold=True, color=EMERALD)
targets = [("500", "collectors onboarded"), ("3", "active hubs"),
           ("150 t", "scrap diverted"), ("+30%", "target income uplift*"),
           ("1", "city replicated")]
for i, (n, l) in enumerate(targets):
    x = MX + i * 2.35
    stat_block(s, x, 5.12, 2.2, n, l, color=EM_LIGHT, dark=True, num_size=22,
               label_size=9.5)
txt(s, MX, 6.06, 11.4, 0.3,
    "*Income uplift vs. pre-pilot baselines, measured via the impact dashboard; "
    "hazard-alert delivery tracked per scan.",
    size=9, color=RGBColor(0x6B, 0x7A, 0x8F))
footer(s, dark=True, note="Success = a profitable hub-city model, with the numbers to replicate anywhere.")

# ============================================================================
# SLIDE 19 — THANK YOU
# ============================================================================
s = new_slide(EMERALD)
rect(s, 0, 0, 0.18, SH, EMERALD_D)
txt(s, 1.5, 2.0, 10.3, 1.2, "Thank You", size=60, bold=True, color=WHITE,
    align=PP_ALIGN.CENTER)
txt(s, 1.5, 3.25, 10.3, 0.6, "IntelliScrap AI — Empowering Informal Recyclers",
    size=22, color=EM_LIGHT, align=PP_ALIGN.CENTER)
rect(s, 5.55, 4.1, 2.23, 0.06, WHITE)
txt(s, 1.5, 4.5, 10.3, 1.6,
    "Team Nexus  ·  ABU Zaria  ·  Build with Gemma 2026\n"
    "github.com/Moses2411/inteliscrap-AI",
    size=16, color=EM_LIGHT, align=PP_ALIGN.CENTER, line_spacing=1.3)
txt(s, 1.5, 6.2, 10.3, 0.5,
    "Let's make informal recycling safer, fairer, and traceable.",
    size=15, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
_slide_no[0] += 1

# ----------------------------------------------------------------------------
OUT = r"C:\Users\Moses\Desktop\MCF\IntelliScrap\IntelliScrap_Pitch_Deck.pptx"
prs.save(OUT)
print("Saved:", OUT)
print("Slides:", len(prs.slides._sldIdLst))