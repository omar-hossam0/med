import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#007F74",
          dark: "#00645F",
          light: "#16B8AA",
          50: "#EAF8F8",
          100: "#D5F1EE",
          200: "#A6E3DC",
        },
        navy: {
          DEFAULT: "#0F172A",
          900: "#0F172A",
          800: "#1E293B",
        },
        ink: {
          primary: "#0F172A",
          secondary: "#475569",
          muted: "#94A3B8",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          subtle: "#F8FAFC",
          cyan: "#EAF8F8",
          cyanDeep: "#F0FBFA",
          cyanDark: "#E5F5F8",
        },
        line: {
          DEFAULT: "#E2E8F0",
          soft: "#EEF2F7",
        },
        success: "#10B981",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      maxWidth: {
        container: "1200px",
        prose: "65ch",
      },
      borderRadius: {
        xs: "6px",
        sm: "10px",
        DEFAULT: "12px",
        md: "14px",
        lg: "18px",
        xl: "24px",
        "2xl": "32px",
        "3xl": "40px",
      },
      boxShadow: {
        soft: "0 6px 24px -8px rgba(15, 23, 42, 0.08)",
        card: "0 8px 32px -10px rgba(15, 23, 42, 0.10)",
        cardHover: "0 16px 48px -12px rgba(15, 23, 42, 0.16)",
        pop: "0 20px 60px -18px rgba(0, 127, 116, 0.22)",
        insetCyan: "inset 0 0 0 1px rgba(15, 118, 110, 0.06)",
        tealGlow: "0 14px 30px -10px rgba(0, 127, 116, 0.45)",
      },
      keyframes: {
        floatY: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        floatYSlow: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        pulseRing: {
          "0%": { transform: "scale(0.95)", opacity: "0.7" },
          "70%": { transform: "scale(1.4)", opacity: "0" },
          "100%": { transform: "scale(1.4)", opacity: "0" },
        },
        fadeUp: {
          "0%": { transform: "translateY(12px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        blobDrift: {
          "0%, 100%": { transform: "translate(0,0) scale(1)" },
          "33%": { transform: "translate(20px,-15px) scale(1.04)" },
          "66%": { transform: "translate(-10px,12px) scale(0.97)" },
        },
      },
      animation: {
        floatY: "floatY 6s ease-in-out infinite",
        floatYSlow: "floatYSlow 8s ease-in-out infinite",
        pulseRing: "pulseRing 2.4s ease-out infinite",
        fadeUp: "fadeUp 0.6s ease-out both",
        blob: "blobDrift 18s ease-in-out infinite",
      },
      backgroundImage: {
        "hero-fade":
          "linear-gradient(135deg, #ffffff 0%, #f0fbfa 55%, #e5f5f8 100%)",
        "teal-grad":
          "linear-gradient(135deg, #00645F 0%, #007F74 55%, #16B8AA 100%)",
        "teal-grad-soft":
          "linear-gradient(135deg, #007F74 0%, #16B8AA 100%)",
        "card-soft":
          "linear-gradient(180deg, #ffffff 0%, #f5fbfa 100%)",
        "dot-grid":
          "radial-gradient(rgba(15,118,110,0.18) 1px, transparent 1px)",
      },
      fontSize: {
        hero: ["clamp(2.4rem, 4.6vw, 4.2rem)", { lineHeight: "1.06", letterSpacing: "-0.02em" }],
        h1: ["clamp(2rem, 3vw, 2.75rem)", { lineHeight: "1.12", letterSpacing: "-0.02em" }],
        h2: ["clamp(1.6rem, 2.2vw, 2.25rem)", { lineHeight: "1.15", letterSpacing: "-0.015em" }],
      },
    },
  },
  plugins: [],
};

export default config;
