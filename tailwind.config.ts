import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        surface: {
          DEFAULT: "var(--surface)",
          low: "var(--surface-low)",
        },
        container: "var(--surface-container)",
        ink: {
          DEFAULT: "var(--ink)",
          muted: "var(--ink-muted)",
        },
        muted: "var(--ink-muted)",
        line: "var(--line)",
        accent: {
          DEFAULT: "var(--accent)",
          soft: "var(--accent-soft)",
          mid: "var(--accent-mid)",
          strong: "var(--accent-strong)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          soft: "var(--danger-soft)",
        },
      },
      borderColor: {
        DEFAULT: "var(--line)",
        line: "var(--line)",
      },
      borderRadius: {
        DEFAULT: "var(--radius-card)",
        card: "var(--radius-card)",
        input: "var(--radius-input)",
        chip: "var(--radius-chip)",
        lg: "var(--radius-card)",
        xl: "calc(var(--radius-card) + 2px)",
      },
      fontFamily: {
        sans: ["var(--font-space)", "system-ui", "sans-serif"],
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-space)", "var(--font-inter)", "sans-serif"],
        playfair: ["var(--font-playfair)", "Georgia", "serif"],
      },
      letterSpacing: {
        tightest: "-0.02em",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        float: "var(--shadow-float)",
        lift: "var(--shadow-float)",
      },
      keyframes: {
        "mesh-drift": {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(2%, -2%, 0) scale(1.05)" },
        },
      },
      animation: {
        "mesh-drift": "mesh-drift 18s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
