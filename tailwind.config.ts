import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        accent: {
          DEFAULT: "var(--accent)",
          soft: "var(--accent-soft)",
          strong: "var(--accent-strong)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          soft: "var(--danger-soft)",
        },
      },
      borderColor: {
        DEFAULT: "var(--line)",
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 2px)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-space-grotesk)", "var(--font-inter)", "sans-serif"],
      },
      letterSpacing: {
        tightest: "-0.02em",
      },
      boxShadow: {
        // Soft diffuse shadow only — no harsh drop shadows.
        card: "0 1px 2px rgba(20,21,26,0.04), 0 8px 24px -12px rgba(20,21,26,0.12)",
        lift: "0 2px 4px rgba(20,21,26,0.05), 0 16px 40px -16px rgba(20,21,26,0.18)",
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
