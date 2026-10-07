import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  GitBranch,
  Languages,
  Phone,
  Recycle,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { AreaChart } from "../charts/AreaChart";
import { pageContainer, pageItem } from "../ui/PageMotion";

/** Cumulative public-repo commits (source: github.com/Moses2411, last 12 months). */
const COMMIT_LABELS = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];
const COMMIT_VALUES = [2, 8, 8, 8, 9, 9, 9, 78, 132, 168, 168, 173];

const TECH_BADGES = ["React 18", "TypeScript", "Vite", "Tailwind CSS", "FastAPI", "PostgreSQL", "Docker"];
const AI_BADGES = ["Ollama · llava:13b", "ONNX Runtime", "Transformers.js", "Local-first inference"];

const BANNER_CHIPS = [
  { icon: WifiOff, label: "Offline-first PWA" },
  { icon: Languages, label: "Hausa · Pidgin · English" },
  { icon: Phone, label: "USSD *347*101#" },
];

const TEAM = [
  { role: "Backend Lead", blurb: "FastAPI · sync · dispatch" },
  { role: "Frontend Lead", blurb: "Vite PWA · offline cache" },
  { role: "Edge AI Engineer", blurb: "llava:13b · ONNX fallback" },
  { role: "Accessibility", blurb: "Hausa/Pidgin TTS & audio" },
  { role: "QA / DevOps", blurb: "62 tests · Docker · CI" },
];

/** Counts a number up on mount (skips entirely for reduced motion). */
function useCountUp(target: number, duration = 1600) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

export default function HeroSection() {
  const commits = useCountUp(173);

  return (
    <motion.section
      aria-label="InteliScrap AI"
      initial="hidden"
      animate="show"
      variants={pageContainer}
      className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 sm:gap-5 sm:px-6"
    >
      {/* ── Banner card — title lockup over the Baban Bola street photo ── */}
      <motion.div
        variants={pageItem}
        className="relative overflow-hidden rounded-[26px] shadow-card-lg ring-1 ring-brand-950/10 dark:ring-white/10"
      >
        <motion.img
          src="/baban-bola.jpg"
          alt="A Baban Bola collector with his scrap cart buying scrap from a seller on a Lagos street"
          initial={{ scale: 1.08 }}
          animate={{ scale: 1.16 }}
          transition={{ duration: 26, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
          className="absolute inset-0 h-full w-full object-cover object-[50%_58%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-950/80 via-brand-950/65 to-brand-950/95" />
        <div className="absolute inset-0 bg-[radial-gradient(75%_60%_at_50%_-5%,rgba(16,185,129,0.45),transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_115%,rgba(251,191,36,0.30),transparent_60%)]" />

        <div className="relative flex flex-col items-center px-5 py-12 text-center sm:px-10 sm:py-16">
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30 backdrop-blur sm:h-14 sm:w-14">
              <Recycle className="h-6 w-6 text-gold-300 sm:h-7 sm:w-7" aria-hidden="true" />
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              InteliScrap AI
            </h1>
          </div>

          <p className="mt-4 text-xl font-extrabold text-gold-300 sm:text-2xl">
            Every bottle has a second life.
          </p>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brand-100/90 sm:text-[15px]">
            On-device AI that tells a waste picker{" "}
            <span className="font-semibold text-white">
              what a material is, what it&apos;s worth, and whether it will poison them
            </span>{" "}
            — in Hausa, Pidgin or English, with or without internet.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {BANNER_CHIPS.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-brand-100 backdrop-blur"
              >
                <Icon className="h-3.5 w-3.5 text-gold-300" aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button href="/login" variant="white" size="lg">
              Get started
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <a
              href="#promises"
              className="btn h-12 bg-white/10 px-6 text-base text-white ring-1 ring-inset ring-white/35 backdrop-blur hover:bg-white/20"
            >
              See how it works
            </a>
          </div>

          <p className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-brand-100 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-gold-300" aria-hidden="true" />
            Team Nexus · Build with Gemma Hackathon 2026 · ABU Zaria
          </p>
        </div>
      </motion.div>

      {/* ── Badge rows ── */}
      <motion.div variants={pageItem} className="flex flex-wrap items-center justify-center gap-2">
        <Badge tone="green">
          <span className="badge-dot bg-emerald-500" aria-hidden="true" />
          62 tests passing
        </Badge>
        <Badge tone="brand">PWA · Offline-first</Badge>
        <Badge tone="gold">Edge AI · on-device</Badge>
        <Badge tone="outline">v0.1.0</Badge>
        <Badge tone="outline">Apache-2.0</Badge>
      </motion.div>

      <motion.div variants={pageItem} className="flex flex-wrap items-center justify-center gap-2">
        {TECH_BADGES.map((t) => (
          <Badge key={t} tone="outline">
            {t}
          </Badge>
        ))}
      </motion.div>

      <motion.div variants={pageItem} className="flex flex-wrap items-center justify-center gap-2">
        <Badge tone="violet">AI Powered</Badge>
        {AI_BADGES.map((t) => (
          <Badge key={t} tone="outline">
            {t}
          </Badge>
        ))}
      </motion.div>

      {/* ── Activity chart card ── */}
      <motion.div variants={pageItem} id="proof" className="scroll-mt-24">
        <Card pad={false} className="overflow-hidden">
          <div className="flex items-start justify-between gap-3 px-5 pt-4 sm:px-6 sm:pt-5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/80 dark:text-brand-300">
                <GitBranch className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Contribution activity
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-bold text-slate-700 dark:text-slate-200">{commits}</span>{" "}
                  commits
                </p>
              </div>
            </div>
            <span className="hidden text-[11px] font-medium text-slate-400 sm:inline">
              inteliscrap-AI · public
            </span>
          </div>

          <div className="animate-chart-draw px-2 pb-4 pt-2 sm:px-4 sm:pb-5">
            <AreaChart
              labels={COMMIT_LABELS}
              series={[{ name: "Commits", values: COMMIT_VALUES }]}
              height={230}
            />
          </div>
        </Card>
      </motion.div>

      {/* ── Team card ── */}
      <motion.div variants={pageItem} id="team" className="scroll-mt-24">
        <Card>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Team Nexus</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Five roles, one shipped product · ABU Zaria
              </p>
            </div>
            <Badge tone="brand">Build with Gemma Hackathon 2026</Badge>
          </div>

          <div className="flex flex-wrap items-start justify-center gap-x-6 gap-y-5">
            {TEAM.map((m) => (
              <div
                key={m.role}
                className="group flex w-28 flex-col items-center gap-1.5 text-center"
              >
                <Avatar
                  name={m.role}
                  size="lg"
                  className="shadow-sm ring-2 ring-white transition-transform duration-200 group-hover:-translate-y-0.5 dark:ring-slate-800"
                />
                <p className="text-xs font-bold leading-tight text-slate-800 dark:text-slate-100">
                  {m.role}
                </p>
                <p className="text-[10px] leading-tight text-slate-500 dark:text-slate-400">
                  {m.blurb}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </motion.section>
  );
}
