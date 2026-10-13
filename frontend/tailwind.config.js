/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
          950: "#022c22",
        },
        gold: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
          950: "#451a03",
        },
        hazard: {
          low: "#fbbf24",
          medium: "#f97316",
          high: "#ef4444",
          critical: "#dc2626",
        },
        // ── Eco-Tech Bento Grid (additive) ──────────────────────────
        // Deep obsidian surfaces used by the Bento dashboard.
        obsidian: {
          50: "#f0f4f8",
          100: "#d9e2ec",
          200: "#bcccdc",
          300: "#9fb3c8",
          400: "#829ab1",
          500: "#627d98",
          600: "#486581",
          700: "#334e68",
          800: "#1f293d",
          900: "#111827",
          950: "#0b0f17",
        },
        // Vibrant eco-accent scale (Electric Emerald / Cyber Lime / Cyber Cyan).
        eco: {
          emerald: "#10b981",
          "emerald-glow": "#34d399",
          lime: "#84cc16",
          "lime-glow": "#a3e635",
          cyan: "#06b6d4",
          "cyan-glow": "#22d3ee",
          amber: "#f59e0b",
          "amber-glow": "#fbbf24",
          red: "#ef4444",
          "red-glow": "#f87171",
        },
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(16 24 40 / 0.04), 0 1px 3px 0 rgb(16 24 40 / 0.06)",
        "card-lg":
          "0 8px 30px -6px rgb(2 44 34 / 0.14), 0 2px 8px -2px rgb(2 44 34 / 0.08)",
        glow: "0 0 0 3px rgb(16 185 129 / 0.18)",
        "glow-gold": "0 0 0 3px rgb(245 158 11 / 0.18)",
        "glow-emerald": "0 0 0 3px rgb(16 185 129 / 0.25)",
        "glow-lime": "0 0 0 3px rgb(132 204 22 / 0.25)",
        "glow-cyan": "0 0 0 3px rgb(6 182 212 / 0.25)",
        bento: "0 18px 40px -24px rgb(0 0 0 / 0.75)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(24px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        "bar-grow": {
          "0%": { transform: "scaleY(0)" },
          "100%": { transform: "scaleY(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "chart-draw": {
          "0%": { clipPath: "inset(0 100% 0 0)" },
          "100%": { clipPath: "inset(0 0 0 0)" },
        },
        // ── Bento additions ─────────────────────────────────────────
        "wave-form": {
          "0%, 100%": { transform: "scaleY(0.28)" },
          "50%": { transform: "scaleY(1)" },
        },
        scanline: {
          "0%": { transform: "translateY(-110%)" },
          "100%": { transform: "translateY(110%)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.55" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.45s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fade-in 0.35s ease-out both",
        "scale-in": "scale-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-in-right": "slide-in-right 0.35s cubic-bezier(0.16, 1, 0.3, 1) both",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "bar-grow": "bar-grow 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        shimmer: "shimmer 1.6s infinite",
        "chart-draw": "chart-draw 1.05s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both",
        "wave-form": "wave-form 0.7s ease-in-out infinite",
        scanline: "scanline 2.4s linear infinite",
        "pulse-ring": "pulse-ring 1.6s cubic-bezier(0.16, 1, 0.3, 1) infinite",
        float: "float 4s ease-in-out infinite",
      },
      backgroundImage: {
        "radial-obsidian": "radial-gradient(ellipse at 50% 0%, #111827 0%, #0b0f17 65%)",
        "radial-slate": "radial-gradient(ellipse at 50% 0%, #1e293b 0%, #0f172a 65%)",
        "gradient-mesh":
          "radial-gradient(ellipse at 15% 10%, rgb(16 185 129 / 0.10) 0%, transparent 45%), radial-gradient(ellipse at 85% 12%, rgb(132 204 22 / 0.08) 0%, transparent 40%), radial-gradient(ellipse at 50% 100%, rgb(6 182 212 / 0.08) 0%, transparent 45%)",
      },
    },
  },
  plugins: [],
};
