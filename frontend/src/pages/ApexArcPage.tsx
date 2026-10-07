import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

const NAV_LINKS = ["About Us", "Our Services", "Portfolio", "Process", "Contact"];

function ArcMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 20" fill="none" aria-hidden="true" className={className}>
      <path d="M2 18a12 12 0 0 1 24 0" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M8.5 18a5.5 5.5 0 0 1 11 0" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * GEOMETRY SPEC (measured against the reference @ 1440×720)
 * ─────────────────────────────────────────────────────────
 * page container : max-w-[1600px] · px-6 (24px) → hero box x=24…1392
 * navigation     : h-16 (64px), sits OUTSIDE + ABOVE the rounded box
 * gap nav→hero   : pt-6 (24px)  → hero top y=88
 * hero box       : ONE rounded rect · radius 28px · overflow-hidden
 *                  aspect 16/6 @ lg (=522px tall @1440) → bottom y=610
 *                  aspect 16/9 @ sm · min-h 520px on mobile
 * text overlay   : bottom-left · inset 40/48/56px (p-10 → p-14)
 *                  max-w 55% of the box (spec: 50–60%)
 * CTA            : BELOW the box (mt-6) · left edge = text left edge
 *                  h-12 (48px) pill → y=634…682 · page pb-8
 */
export default function ApexArcPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [heroImage, setHeroImage] = useState(true);

  useEffect(() => {
    const previous = document.title;
    document.title = "Apex Arc — Designing Spaces That Inspire & Endure";
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      {/* GEOMETRY: nav is NOT part of the rounded container — full width, above it */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
        {/* GEOMETRY: same container + px-6 as the hero so logo aligns with its left edge */}
        <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between px-6">
          <a href="/apex-arc" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white dark:bg-brand-500">
              <ArcMark className="h-4 w-5" />
            </span>
            <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
              Apex Arc
            </span>
          </a>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link}
                href="#"
                className="rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                {link}
              </a>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={menuOpen}
            className="btn-icon md:hidden"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-slate-200 bg-white px-6 py-2 dark:border-slate-800 dark:bg-slate-950 md:hidden">
            {NAV_LINKS.map((link) => (
              <a
                key={link}
                href="#"
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {link}
              </a>
            ))}
          </div>
        )}
      </header>

      {/* GEOMETRY: page container — max-w-[1600px] · px-6 · pt-6 gap under nav · pb-8 under CTA */}
      <main className="mx-auto w-full max-w-[1600px] px-6 pb-8 pt-6">
        {/*
          GEOMETRY: the hero is ONE continuous rounded rectangle (radius 24–28px).
          No inner wrapper gets its own radius — the <img> is clipped by this box only.
        */}
        <section className="relative isolate min-h-[520px] overflow-hidden rounded-[20px] bg-gradient-to-br from-slate-800 via-slate-700 to-brand-900 shadow-card-lg ring-1 ring-slate-900/10 sm:aspect-[16/9] sm:min-h-0 sm:rounded-[24px] lg:aspect-[16/6] lg:rounded-[28px] dark:ring-white/10">
          {/* GEOMETRY: background image fills the box edge-to-edge, object-cover, no padding */}
          {heroImage && (
            <img
              src="/apex-hero.jpg"
              alt="Modern house with clean architectural lines"
              onError={() => setHeroImage(false)}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}

          {/* Readability: white text stays legible over any part of the image, both themes */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />

          {/*
            GEOMETRY: content overlay pinned to the BOTTOM-LEFT quadrant.
            Inset 40px → 48px → 56px (p-10 → p-12 → p-14), spec range 40–60px.
            Never centered.
          */}
          <div className="absolute bottom-0 left-0 w-full p-10 sm:p-12 lg:p-14">
            {/* GEOMETRY: text block capped at 50–60% of the container width */}
            <div className="max-w-[560px] drop-shadow-md lg:max-w-[55%]">
              <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
                {/* GEOMETRY: two fixed lines, as in the reference */}
                <span className="block">Designing Spaces</span>
                <span className="block">That Inspire &amp; Endure</span>
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-white/85 sm:text-base">
                We transform visions into timeless architecture, blending innovative design with
                functional excellence.
              </p>
            </div>
          </div>
        </section>

        {/*
          GEOMETRY: CTA sits BELOW the rounded box (mt-6 = 24px), pill h-12,
          LEFT edge flush with the text block above
          (page px-6 24 + overlay inset 56 = x80 — set ml-0 if you want it
          flush with the card edge instead).
        */}
        <button
          type="button"
          className="btn ml-10 mt-6 h-12 rounded-full bg-brand-600 px-8 text-[15px] text-white shadow-sm hover:bg-brand-700 sm:ml-12 lg:ml-14"
        >
          Schedule a Free Consultation
        </button>
      </main>
    </div>
  );
}
