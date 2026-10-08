import { motion } from "framer-motion";
import {
  Banknote,
  Camera,
  Check,
  GitBranch,
  Languages,
  MessageSquare,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  TrendingDown,
  Volume2,
  WifiOff,
} from "lucide-react";
import { Card } from "../ui/Card";
import { StatCard } from "../ui/StatCard";
import { AreaChart } from "../charts/AreaChart";
import { pageItem, pageStagger } from "../ui/PageMotion";
import { cn } from "../../lib/cn";
import type { ComponentType, ReactNode } from "react";

type LucideIcon = ComponentType<{ className?: string;[key: string]: any }>;

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
    hint: "No material knowledge → exploited",
    icon: <TrendingDown className="h-5 w-5" />,
  },
  {
    value: "Zero",
    label: "Safety data in the field",
    hint: "Lead & e-waste handled blind",
    icon: <ShieldAlert className="h-5 w-5" />,
  },
];

/* ── Promises bento data ── */
const CATEGORIES = ["PET", "Aluminium", "Copper", "Lead battery", "E-waste", "Glass", "Cardboard", "Iron"];

/** Naira per kg. Bars are scaled against the highest price (copper). */
const PRICES = [
  { name: "Copper", price: 3200 },
  { name: "Lead battery", price: 950 },
  { name: "Aluminium", price: 700 },
  { name: "PET", price: 180 },
];
const MAX_PRICE = Math.max(...PRICES.map((p) => p.price));

const TONES = {
  brand: "bg-brand-50 text-brand-600 dark:bg-brand-950/80 dark:text-brand-300",
  gold: "bg-gold-50 text-gold-700 dark:bg-gold-950/80 dark:text-gold-300",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-950/80 dark:text-rose-300",
  sky: "bg-sky-50 text-sky-600 dark:bg-sky-950/80 dark:text-sky-300",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
} as const;
type Tone = keyof typeof TONES;

/** A bento cell: h-full + flex-col so a visual pinned with `mt-auto` fills the cell. */
function Tile({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <Card hover className={cn("flex h-full flex-col", className)}>
      {children}
    </Card>
  );
}

function IconChip({ icon: Icon, tone }: { icon: LucideIcon; tone: Tone }) {
  return (
    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", TONES[tone])}>
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

function TileHead({ icon, tone, tag }: { icon: LucideIcon; tone: Tone; tag: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <IconChip icon={icon} tone={tone} />
      <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", TONES[tone])}>{tag}</span>
    </div>
  );
}

function Chip({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", TONES[tone])}>{children}</span>
  );
}

const OFFLINE: Array<{ icon: typeof WifiOff; title: string; body: ReactNode }> = [
  {
    icon: WifiOff,
    title: "Offline-first PWA",
    body: "Installs to the home screen; camera, classifier and IndexedDB sync all work with no internet.",
  },
  {
    icon: Languages,
    title: "Local-language TTS",
    body: "Hazards & prices read aloud in Hausa (Wurin da nake aiki) and Nigerian Pidgin not just English.",
  },
  {
    icon: Phone,
    title: "USSD registration",
    body: (
      <>
        A collector on a feature phone registers by dialing{" "}
        <code className="kbd font-bold">*347*101#</code> no smartphone, no app store, no data
        plan.
      </>
    ),
  },
  {
    icon: MessageSquare,
    title: "SMS outbox + IVR",
    body: "Offers and pickups reach collectors even with zero data.",
  },
];

/** Cumulative public-repo commits (source: github.com/Moses2411, last 12 months). */
const COMMIT_LABELS = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];
const COMMIT_VALUES = [2, 8, 8, 8, 9, 9, 9, 78, 132, 168, 168, 173];

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

export default function ValueSection() {
  return (
    <motion.section
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.12 }}
      variants={pageStagger}
      className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 sm:px-6"
    >
      {/* ── The problem ── */}
      <motion.div variants={pageItem} id="why" className="scroll-mt-24">
        <SectionHeading eyebrow="The problem" title="The numbers that shouldn't be true" />
        <div className="grid gap-4 sm:grid-cols-3">
          {PROBLEM_STATS.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} hint={s.hint} icon={s.icon} />
          ))}
        </div>
      </motion.div>

      {/* ── Four promises — bento: 6 (×2 rows) | 6 / 3 + 3, every row sums to 12 ── */}
      <motion.div variants={pageItem} id="promises" className="scroll-mt-24">
        <SectionHeading
          eyebrow="Value proposition"
          title="One app, four promises each tied to a real problem"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:auto-rows-[minmax(11rem,auto)] lg:grid-cols-12">
          {/* 1 · Know the material — 6 cols × 2 rows */}
          <Tile className="sm:col-span-2 lg:col-span-6 lg:row-span-2">
            <TileHead icon={Camera} tone="brand" tag="Fairness" />
            <h3 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">Know the material</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Photo → on-device ONNX classifier (or server vision) identifies the material from 8
              categories with a confidence score.
            </p>

            <div className="mt-auto pt-6">
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <span>Confidence shown with every result</span>
                  <Check className="h-4 w-4 text-brand-600 dark:text-brand-300" aria-hidden="true" />
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-full w-[88%] rounded-full bg-brand-600 dark:bg-brand-300" />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {CATEGORIES.map((c) => (
                  <span
                    key={c}
                    className="rounded-lg bg-slate-100 px-2 py-2 text-center text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </Tile>

          {/* 2 · Know the price — 6 cols */}
          <Tile className="sm:col-span-2 lg:col-span-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="sm:w-[42%]">
                <TileHead icon={Banknote} tone="gold" tag="Fair income" />
                <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">Know the price</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Real-time price matrix per kg in Naira.
                </p>
              </div>
              <ul className="flex-1 space-y-3">
                {PRICES.map((p) => (
                  <li key={p.name} className="flex items-center gap-3 text-xs">
                    <span className="w-20 shrink-0 font-semibold text-slate-700 dark:text-slate-200">
                      {p.name}
                    </span>
                    <div className="h-2.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gold-700 dark:bg-gold-300"
                        style={{ width: `${Math.max(6, Math.round((p.price / MAX_PRICE) * 100))}%` }}
                      />
                    </div>
                    <span className="w-[4.5rem] shrink-0 text-right font-bold tabular-nums text-slate-900 dark:text-white">
                      ₦{p.price.toLocaleString("en-NG")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Tile>

          {/* 3 · Know the danger — 3 cols */}
          <Tile className="lg:col-span-3">
            <TileHead icon={ShieldAlert} tone="rose" tag="Safety" />
            <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">Know the danger</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              E-waste &amp; lead batteries flagged hazardous; TTS reads the warnings aloud.
            </p>
            <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-5">
              <Volume2 className="h-4 w-4 text-rose-600 dark:text-rose-300" aria-hidden="true" />
              <Chip tone="rose">Hausa · ha-NG</Chip>
              <Chip tone="rose">Pidgin · en-NG</Chip>
            </div>
          </Tile>

          {/* 4 · Know the truth — 3 cols */}
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

      {/* ── Offline / language layer ── */}
      <motion.div variants={pageItem} id="offline" className="scroll-mt-24">
        <SectionHeading
          eyebrow="The unfair advantage"
          title="Built for where the phone actually is"
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {OFFLINE.map((o) => (
            <Card key={o.title} hover className="h-full">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <o.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{o.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {o.body}
              </p>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* ── Contribution activity chart ── */}
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
                  <span className="font-bold text-slate-700 dark:text-slate-200">173</span>{" "}
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
    </motion.section>
  );
}