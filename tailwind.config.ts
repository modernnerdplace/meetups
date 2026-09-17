import type { Config } from "tailwindcss";

// Kleuren komen uit het logo: diepe navy badge, oranje raket, amber vonken,
// cyaan printbaansporen en een mintgroen accent.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#05090f",
          900: "#070d1c",
          850: "#0a1224",
          800: "#0e1930",
          700: "#16223f",
          600: "#1e2e52",
          500: "#2b3f69",
        },
        rocket: {
          DEFAULT: "#f2440f",
          400: "#ff6a3d",
          300: "#ff8f66",
        },
        spark: {
          DEFAULT: "#ffb400",
          300: "#ffcc4d",
        },
        trace: {
          DEFAULT: "#22c1e8",
          300: "#6fd9f2",
        },
        mint: {
          DEFAULT: "#6cd8a8",
        },
        paper: {
          DEFAULT: "#e9eef8",
          muted: "#93a2bf",
          faint: "#64748f",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      maxWidth: {
        page: "68rem",
      },
    },
  },
  plugins: [],
};

export default config;
