import { motion } from "framer-motion";
import {
  Banknote,
  Camera,
  Languages,
  MessageSquare,
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
import type { ReactNode } from "react";

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

const PROMISES = [
  {
    icon: Camera,
    title: "Know the material",
    tag: "Fairness",
    tone: "bg-brand-50 text-brand-600 dark:bg-brand-950/80 dark:text-brand-300",
    body: "Photo → on-device ONNX classifier (or server vision) identifies the material from 8 categories with a confidence score.",
  },
  {
    icon: Banknote,
    title: "Know the price",
    tag: "Fair income",
    tone: "bg-gold-50 text-gold-700 dark:bg-gold-950/80 dark:text-gold-300",
    body: "Real-time price matrix per kg in Naira — copper ₦3,200/kg, aluminum ₦700/kg, lead battery ₦950/kg, PET ₦180/kg.",
  },
  {
    icon: ShieldAlert,
    title: "Know the danger",
    tag: "Safety",
    tone: "bg-rose-50 text-rose-600 dark:bg-rose-950/80 dark:text-rose-300",
    body: "E-waste & lead batteries flagged hazardous; TTS reads the warnings aloud in Hausa and Pidgin (ha-NG, en-NG).",
  },
  {
    icon: ShieldCheck,
    title: "Know the truth",
    tag: "Trust",
    tone: "bg-sky-50 text-sky-600 dark:bg-sky-950/80 dark:text-sky-300",
    body: "The app never fabricates a result — offline manual selection with source \"manual\" and zero AI confidence, kept honest.",
  },
];

const OFFLINE: Array<{ icon: typeof WifiOff; title: string; body: ReactNode }> = [
  {
    icon: WifiOff,
    title: "Offline-first PWA",
    body: "Installs to the home screen; camera, classifier and IndexedDB sync all work with no internet.",
  },
  {
    icon: Languages,
    title: "Local-language TTS",
    body: "Hazards & prices read aloud in Hausa (Wurin da nake aiki) and Nigerian Pidgin — not just English.",
  },
  {
    icon: Phone,
    title: "USSD registration",
    body: (
      <>
        A collector on a feature phone registers by dialing{" "}
        <code className="kbd font-bold">*347*101#</code> — no smartphone, no app store, no data
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

      {/* ── Four promises ── */}
      <motion.div variants={pageItem} id="promises" className="scroll-mt-24">
        <SectionHeading
          eyebrow="Value proposition"
          title="One app, four promises — each tied to a real problem"
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROMISES.map((p) => (
            <Card key={p.title} hover className="h-full">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${p.tone}`}
              >
                <p.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">
                {p.tag}
              </p>
              <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {p.body}
              </p>
            </Card>
          ))}
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
    </motion.section>
  );
}
