import { motion } from "framer-motion";
import { ArrowRight, GitFork } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { pageItem } from "../ui/PageMotion";

const GITHUB_URL = "https://github.com/Moses2411/inteliscrap-AI";

export default function CtaBand() {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.3 }}
      variants={pageItem}
      className="mx-auto w-full max-w-5xl px-4 sm:px-6"
    >
      <Card gradient className="relative overflow-hidden px-6 py-12 text-center sm:px-10 sm:py-14">
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold-400/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-white/10 blur-3xl"
        />

        <div className="relative">
          <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            InteliScrap AI — Every bottle has a second life.
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-sm leading-relaxed text-brand-100/90 sm:text-base">
            We built an offline-first, Hausa-first recyclable intelligence platform with the proof
            to match a price matrix, an honest AI fallback, USSD reach, and a
            compliance/impact engine the market is legally obliged to buy.
          </p>
          <p className="mt-6 text-lg font-extrabold text-gold-300 sm:text-xl">
            Back us. Partner with us. Pilot with us.
          </p>
          <p className="mt-1.5 text-xs font-semibold text-brand-200">Team Nexus, ABU Zaria</p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button href="/login" variant="white" size="lg">
              Get started
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="btn h-12 bg-white/10 px-6 text-base text-white ring-1 ring-inset ring-white/30 hover:bg-white/20"
            >
              <GitFork className="h-4 w-4" aria-hidden="true" />
              View on GitHub
            </a>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
