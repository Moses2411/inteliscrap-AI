import { useEffect } from "react";
import { MotionConfig } from "framer-motion";
import LandingNav from "../components/landing/LandingNav";
import HeroSection from "../components/landing/HeroSection";
import ValueSection from "../components/landing/ValueSection";
import CtaBand from "../components/landing/CtaBand";
import LandingFooter from "../components/landing/LandingFooter";

export default function LandingPage() {
  // Deep links (#promises, #proof, …) render after mount — bring them into view.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ block: "start" });
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div id="top" className="min-h-screen scroll-smooth bg-slate-50 dark:bg-slate-950">
        <LandingNav />
        <main className="flex flex-col gap-12 pb-16 pt-6 sm:gap-16 sm:pt-8">
          <HeroSection />
          <ValueSection />
          <CtaBand />
        </main>
        <LandingFooter />
      </div>
    </MotionConfig>
  );
}
