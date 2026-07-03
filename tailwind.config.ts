import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // FLIMIX brand palette — premium dark cinematic
        ink: {
          950: "#07060a", // page background (deep black)
          900: "#0d0b12", // section background (dark charcoal)
          800: "#15121d", // card surface
          700: "#1e1a29", // elevated surface
          600: "#2a2438", // borders / dividers
        },
        royal: {
          300: "#c4a8ff",
          400: "#a67cff",
          500: "#8b5cf6", // primary accent — rich cinematic purple
          600: "#7440e0",
          700: "#5d2fc0",
        },
        glow: "#b794f6", // violet glow (use sparingly)
        mist: {
          100: "#f2eefb",
          300: "#c9c2d9",
          400: "#a49bbd",
          500: "#7d7494",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 8px 30px rgba(0,0,0,0.45)",
        accent: "0 4px 24px rgba(139,92,246,0.25)",
      },
      backgroundImage: {
        "hero-fade":
          "linear-gradient(to top, #07060a 5%, rgba(7,6,10,0.6) 45%, rgba(7,6,10,0.15) 100%)",
        "card-fade":
          "linear-gradient(to top, rgba(7,6,10,0.95) 0%, rgba(7,6,10,0) 60%)",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        shimmer: "shimmer 1.8s infinite linear",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
