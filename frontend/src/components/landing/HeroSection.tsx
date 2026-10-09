import { useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "../ui/Button";
import { pageItem, pageStagger } from "../ui/PageMotion";

/* ───────────────────────── Geometry ─────────────────────────
 * Card with a rectangular scoop cut from the bottom-left corner.
 * All radii are in PIXELS, so corners stay perfectly circular at any size
 * (objectBoundingBox clip-paths stretch arcs into ellipses).
 *
 *   ┌───────────────────────────────┐
 *   │                               │
 *   │                               │
 *   ╰───╮                           │   ← rl : convex corner above the scoop
 *       │ ← rin : rounded inner corner of the scoop
 *   ┌───╯                           │
 *   │ btn  ╰─ rc : convex corner at the scoop's bottom-right
 *   └──────────────────────────────┘
 */
const R = 28; // outer card corner radius
const RC = 22; // convex corner where the bottom edge meets the scoop wall
const RIN = 22; // rounded inner (concave) corner of the scoop
const RL = 22; // convex corner on the left edge above the scoop
const NOTCH_H = 84; // scoop height (button 56 + 14 padding top & bottom)
const INSET = 14; // gap between button and scoop walls

/** Scoop width scales with the card (44% like the reference), clamped so the
 *  CTA always fits on narrow phones and the scoop never dominates wide cards. */
export function getNotchWidth(w: number) {
  return Math.round(Math.min(400, Math.max(150, w * 0.44)));
}

export function scoopPath(W: number, H: number, nw: number, nh = NOTCH_H) {
  return [
    `M ${R},0`,
    `H ${W - R}`,
    `A ${R} ${R} 0 0 1 ${W},${R}`,
    `V ${H - R}`,
    `A ${R} ${R} 0 0 1 ${W - R},${H}`,
    `H ${nw + RC}`,
    `A ${RC} ${RC} 0 0 1 ${nw},${H - RC}`, // convex, bottom-right of scoop
    `V ${H - nh + RIN}`,
    `A ${RIN} ${RIN} 0 0 0 ${nw - RIN},${H - nh}`, // rounded inner corner
    `H ${RL}`,
    `A ${RL} ${RL} 0 0 1 0,${H - nh - RL}`, // convex, left edge
    `V ${R}`,
    `A ${R} ${R} 0 0 1 ${R},0`,
    `Z`,
  ].join(" ");
}

/** Measures an element and returns a px-based clip-path + notch width. */
function useScoopClip<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [geo, setGeo] = useState<{ clip: string; nw: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const { width: W, height: H } = el.getBoundingClientRect();
      if (!W || !H) return;
      const nw = getNotchWidth(W);
      setGeo({ clip: `path('${scoopPath(W, H, nw)}')`, nw });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, geo };
}

/* ───────────────────────── Placeholder image ───────────────────────── */
const PLACEHOLDER_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='1600' height='900' viewBox='0 0 1600 900'>
      <defs>
        <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0' stop-color='#475569'/><stop offset='1' stop-color='#1e293b'/>
        </linearGradient>
      </defs>
      <rect width='1600' height='900' fill='url(#g)'/>
      <g fill='none' stroke='#94a3b8' stroke-width='6' opacity='.55'>
        <rect x='690' y='330' width='220' height='170' rx='14'/>
        <circle cx='750' cy='390' r='22'/>
        <path d='M700 490 L770 430 L820 470 L860 440 L900 490'/>
      </g>
      <text x='800' y='560' text-anchor='middle' font-family='sans-serif' font-size='34' fill='#cbd5e1' opacity='.7'>Hero image placeholder</text>
    </svg>`
  );

/* ───────────────────────── Scooped card ───────────────────────── */
type Props = {
  imageSrc?: string;
  imageAlt?: string;
};

function ScoopedHeroCard({
  imageSrc = "/baban-bola.jpg",
  imageAlt = "A Baban Bola collector with his scrap cart buying scrap from a seller on a Lagos street",
}: Props) {
  const { ref, geo } = useScoopClip<HTMLDivElement>();
  const nw = geo?.nw ?? 280;
  const [src, setSrc] = useState(imageSrc);

  return (
    <div ref={ref} className="relative h-[480px] sm:h-[540px] lg:h-[560px]">
      {/* Clipped layer: image, scrim and text are all cut by the scoop */}
      <div
        className="relative h-full w-full overflow-hidden"
        style={geo ? { clipPath: geo.clip } : undefined}
      >
        <motion.img
          src={src}
          alt={imageAlt}
          onError={() => setSrc((s) => (s === PLACEHOLDER_IMG ? s : PLACEHOLDER_IMG))}
          initial={{ scale: 1.08 }}
          animate={{ scale: 1.16 }}
          transition={{ duration: 26, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
          className="absolute inset-0 h-full w-full object-cover object-[50%_58%]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/30 to-black/5" />

        {/* Text sits above the scoop: bottom padding must beat NOTCH_H (84px)
            at EVERY breakpoint — lg:p-14 would otherwise reset it to 56px. */}
        <div className="absolute bottom-0 left-0 w-full p-10 pb-28 sm:p-12 sm:pb-32 lg:p-14 lg:pb-32">
          <div className="max-w-[560px] drop-shadow-md lg:max-w-[55%]">
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl">
              <span className="block">Every kilogram of</span>
              <span className="block">scrap, fairly valued.</span>
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-white/85 sm:text-base">
              On-device AI that tells a waste picker{" "}
              <span className="font-semibold text-white">
                what a material is, what it&apos;s worth, and whether it will poison them
              </span>{" "}
              — covering Nigeria&apos;s major official and regional languages, with or without internet.
            </p>
          </div>
        </div>
      </div>

      {/* CTA lives inside the scoop (outside the clipped layer), sized to fit it */}
      <div
        className="absolute z-20"
        style={{
          left: INSET,
          bottom: INSET,
          width: nw - INSET * 2,
          height: NOTCH_H - INSET * 2,
        }}
      >
        <Button
          href="/login"
          variant="primary"
          size="md"
          className="h-full w-full justify-center rounded-xl shadow-lg"
        >
          Get started
        </Button>
      </div>
    </div>
  );
}

/* ───────────────────────── Section (container = PWA width) ─────────────────────────
 * Matches LandingNav / ValueSection / CtaBand: max-w-5xl, px-4 → sm:px-6,
 * so the hero always aligns with the rest of the page at every breakpoint.
 */
export default function HeroSection(props: Props) {
  return (
    <motion.section
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      variants={pageStagger}
      className="mx-auto w-full max-w-5xl px-4 sm:px-6"
    >
      <motion.div variants={pageItem}>
        <ScoopedHeroCard {...props} />
      </motion.div>
    </motion.section>
  );
}
