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
        paper: {
          50: "#FAF8F5", // Warm off-white page background
          100: "#F4F0EA",
          200: "#EAE3D9",
          300: "#DCD3C5",
        },
        ink: {
          900: "#1C1917", // Primary near-black body text
          700: "#44403C",
          600: "#57534E", // Secondary text
          500: "#78716C", // Muted text
          300: "#A8A29E",
          200: "#D6CEBE", // Default border
          100: "#E7E2DA", // Subtle border
        },
        accent: {
          DEFAULT: "#1E3A5F", // Deep ink blue primary accent
          hover: "#152A45",
          subtle: "#EEF2F6",
          border: "#CBD5E1",
        },
        damage: {
          DEFAULT: "#991B1B", // Muted red text
          bg: "#FEF2F2",
          border: "#FECACA",
        },
        wear: {
          DEFAULT: "#B45309", // Ochre/amber text
          bg: "#FFFBEB",
          border: "#FDE68A",
        },
        unclear: {
          DEFAULT: "#4B5563", // Neutral slate grey text
          bg: "#F3F4F6",
          border: "#E5E7EB",
        },
        accepted: {
          DEFAULT: "#166534", // Muted forest green text
          bg: "#F0FDF4",
          border: "#BBF7D0",
        },
        disputed: {
          DEFAULT: "#9F1239", // Muted rose/crimson text
          bg: "#FFF1F2",
          border: "#FECDD3",
        },
      },
      borderRadius: {
        xs: "2px",
        sm: "4px",
        DEFAULT: "6px",
        md: "6px",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          '"Liberation Mono"',
          '"Courier New"',
          "monospace",
        ],
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgba(0, 0, 0, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
