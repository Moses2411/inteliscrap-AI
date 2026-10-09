import { motion } from "framer-motion";
import {
  Banknote,
  Languages,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  TrendingDown,
  WifiOff,
} from "lucide-react";
import { Card } from "../ui/Card";
import { StatCard } from "../ui/StatCard";
import { pageItem, pageStagger } from "../ui/PageMotion";
import { cn } from "../../lib/cn";
import type { ComponentType, ReactNode } from "react";

type LucideIcon = ComponentType<{ className?: string; [key: string]: any }>;

const PROBLEM_STATS = [
  {
    value: "32M t",
    label: "Nigeria's waste / year",
    hint: "Less than 15% is recycled",
    icon: <Trash2 className="h-5 w-5" />,
  },
  {
    value: "30–50%",
    label: "Middleman underpay",
    hint: "Sellers lose margin to informal brokers",
    icon: <TrendingDown className="h-5 w-5" />,
  },
  {
    value: "1 in 5",
    label: "Burnt at dumpsites",
    hint: "Toxic smoke harms communities",
    icon: <ShieldAlert className="h-5 w-5" />,
  },
];

const LANG_CODES = [
  { code: "EN", label: "English" },
  { code: "HA", label: "Hausa" },
  { code: "PCM", label: "Nigerian Pidgin" },
  { code: "YO", label: "Yoruba" },
  { code: "IG", label: "Igbo" },
];

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-400">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
        {title}
      </h2>
    </div>
  );
}

function TileHead({ icon: Icon, tone, tag }: { icon: LucideIcon; tone: "brand" | "gold" | "sky"; tag: string }) {
  const toneClasses = {
    brand: "bg-brand-50 text-brand-600 dark:bg-brand-950/80 dark:text-brand-300",
    gold: "bg-gold-50 text-gold-600 dark:bg-gold-950/80 dark:text-gold-300",
    sky: "bg-sky-50 text-sky-600 dark:bg-sky-950/80 dark:text-sky-300",
  };
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", toneClasses[tone])}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">{tag}</span>
    </div>
  );
}

function Tile({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card hover className={cn("relative flex flex-col h-full overflow-hidden", className)}>
      {children}
    </Card>
  );
}

export default function ValueSection() {
  return (
    <motion.section
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.12 }}
      variants={pageStagger}
      className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 sm:px-6"
    >
      {/* The problem */}
      <motion.div variants={pageItem} id="why" className="scroll-mt-24">
        <SectionHeading eyebrow="The problem" title="The numbers that shouldn't be true" />
        <div className="grid gap-4 sm:grid-cols-3">
          {PROBLEM_STATS.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} hint={s.hint} icon={s.icon} />
          ))}
        </div>
      </motion.div>

      {/* Three promises (bento) - removed "Know the material" */}
      <motion.div variants={pageItem} id="promises" className="scroll-mt-24">
        <SectionHeading
          eyebrow="Value proposition"
          title="Three promises each tied to a real problem"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:auto-rows-[minmax(11rem,auto)] lg:grid-cols-6">
          {/* 1 – Know the price – 6 cols */}
          <Tile className="sm:col-span-2 lg:col-span-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="sm:w-[42%]">
                <TileHead icon={Banknote} tone="gold" tag="Fair income" />
                <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">Know the price</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Live market prices per kg from recycling hubs — no middleman markup.
                </p>
              </div>
              <div className="sm:flex-1">
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <div className="flex items-center justify-between text-sm font-semibold text-slate-600 dark:text-slate-300">
                    <span>PET</span>
                    <span className="text-brand-600 dark:text-brand-300">₦120/kg</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm font-semibold text-slate-600 dark:text-slate-300">
                    <span>HDPE</span>
                    <span className="text-brand-600 dark:text-brand-300">₦140/kg</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm font-semibold text-slate-600 dark:text-slate-300">
                    <span>Aluminium</span>
                    <span className="text-brand-600 dark:text-brand-300">₦850/kg</span>
                  </div>
                </div>
              </div>
            </div>
          </Tile>

          {/* 2 – Know the risk – 3 cols */}
          <Tile className="lg:col-span-3">
            <TileHead icon={ShieldCheck} tone="sky" tag="Trust" />
            <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">Know the risk</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Built-in safety cards flag hazardous items (batteries, medical, chemical) and
              show handling instructions.
            </p>
            <dl className="mt-auto space-y-1.5 pt-5 text-xs">
              <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                <dt className="text-slate-500 dark:text-slate-400">Battery detected</dt>
                <dd className="font-bold text-red-600 dark:text-red-400">High risk</dd>
              </div>
              <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                <dt className="text-slate-500 dark:text-slate-400">Medical waste</dt>
                <dd className="font-bold text-red-600 dark:text-red-400">Do not handle</dd>
              </div>
            </dl>
          </Tile>

          {/* 3 – Know the truth – 3 cols */}
          <Tile className="lg:col-span-3">
            <TileHead icon={ShieldCheck} tone="sky" tag="Trust" />
            <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">Know the truth</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              The app never fabricates a result. Offline, you pick the material yourself and it says so.
            </p>
            <dl className="mt-auto space-y-1.5 pt-5 text-xs">
              <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                <dt className="text-slate-500 dark:text-slate-400">source</dt>
                <dd className="font-bold text-slate-900 dark:text-white">manual</dd>
              </div>
              <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                <dt className="text-slate-500 dark:text-slate-400">AI confidence</dt>
                <dd className="font-bold text-slate-900 dark:text-white">0%</dd>
              </div>
            </dl>
          </Tile>
        </div>
      </motion.div>

      {/* Offline / language layer — asymmetric bento */}
      <motion.div variants={pageItem} id="offline" className="scroll-mt-24">
        <SectionHeading
          eyebrow="The unfair advantage"
          title="Built for where the phone actually is"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:auto-rows-[minmax(11rem,auto)] lg:grid-cols-6">
          {/* Anchor — offline-first (dark, 4×2) */}
          <Card gradient className="flex flex-col sm:col-span-2 lg:col-span-4 lg:row-span-2">
            <div className="flex flex-1 flex-col">
              <div className="flex items-center gap-2 text-xs font-semibold text-brand-200">
                <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
                <span>No signal · still works</span>
              </div>
              <h3 className="mt-3 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                Classification runs on the phone itself
              </h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-brand-100/90">
                The AI model is installed on the device. A collector in a market with no
                bars still points the camera, still gets a material, a price and a
                hazard flag.
              </p>

              {/* Mock scan result — the artifact the app actually produces */}
              <div className="mt-auto pt-6">
                <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15 backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-white">PET bottle</span>
                    <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold text-white">
                      94% confidence
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-brand-100/80">
                    <span>Fair price · ₦120/kg</span>
                    <span className="font-semibold text-brand-200">on-device</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Languages (2×1) */}
          <Card hover className="flex flex-col lg:col-span-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Languages className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Full UI + voice guides</span>
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-white">
              Hausa, Pidgin, Yoruba, Igbo
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Not a translated veneer — the whole flow speaks the language the seller
              already speaks.
            </p>
            <div className="mt-auto flex flex-wrap gap-1.5 pt-4" aria-label="Supported languages">
              {LANG_CODES.map((l) => (
                <span
                  key={l.code}
                  title={l.label}
                  className={
                    l.code === "HA" || l.code === "PCM"
                      ? "rounded-full bg-brand-50 px-2 py-1 text-[11px] font-bold text-brand-700 dark:bg-brand-950/70 dark:text-brand-300"
                      : "rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }
                >
                  {l.code}
                </span>
              ))}
            </div>
          </Card>

          {/* SMS / IVR (2×1) */}
          <Card hover className="flex flex-col lg:col-span-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Any phone, zero data</span>
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-white">
              Offers arrive by SMS and voice
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              The outbox sends offers over SMS; missed them? An IVR call reads them out.
            </p>
            {/* Mock SMS bubble */}
            <div className="mt-auto pt-4">
              <div className="rounded-2xl rounded-tl-md bg-slate-100 p-3 dark:bg-slate-800/70">
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                  SMS · IntelliScrap
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                  New offer: 12kg PET → ₦1,440. Collector Musa is 400m away. Reply YES to
                  accept.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </motion.div>
    </motion.section>
  );
}