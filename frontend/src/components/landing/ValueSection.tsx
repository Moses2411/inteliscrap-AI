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

const CATEGORIES = [
  "PET",
  "HDPE",
  "PP",
  "LDPE",
  "PS",
  "Aluminium",
  "Steel",
  "Mixed",
];

const OFFLINE = [
  {
    icon: WifiOff,
    title: "Offline-first",
    body: "AI classification runs on-device. No cloud required.",
  },
  {
    icon: Languages,
    title: "Hausa + Pidgin",
    body: "Full UI & voice guides in local languages.",
  },
  {
    icon: Phone,
    title: "SMS outbox + IVR",
    body: "Offers and pickups reach collectors even with zero data.",
  },
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

      {/* Offline / language layer */}
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
    </motion.section>
  );
}