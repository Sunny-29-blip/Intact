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
        page: "#F4F5F7", // Archival cool grey-white page background
        surface: "#FFFFFF",
        ink: {
          900: "#1C1E21", // Primary text
          700: "#373B40",
          600: "#4A4E54", // Secondary text
          500: "#6B7078", // Muted metadata
          400: "#9CA3AF", // Strong border
          200: "#D1D5DB", // Default border
          100: "#E5E7EB", // Subtle divider
          50: "#F4F5F7",
        },
        accent: {
          DEFAULT: "#0B3D4A", // Deep teal primary accent
          hover: "#072E38",
          tint: "#E0F0F3",
          border: "#B2D7DF",
        },
        damage: {
          DEFAULT: "#A63D3D", // Damage solid
          bg: "#FDF2F2",
          border: "#F8D7D7",
        },
        wear: {
          DEFAULT: "#8A6A1A", // Normal wear solid
          bg: "#FEF9EC",
          border: "#F6E3B4",
        },
        unclear: {
          DEFAULT: "#5A5F66", // Unclear neutral grey
          bg: "#F4F5F7",
          border: "#D1D5DB",
        },
        accepted: {
          DEFAULT: "#2A5C4A", // Tenant accepted green
          bg: "#EDF7F3",
          border: "#C3E6D9",
        },
        disputed: {
          DEFAULT: "#5C3D6B", // Tenant disputed purple/slate
          bg: "#F7F0F9",
          border: "#E4CEE9",
        },
      },
      borderRadius: {
        none: "0",
        xs: "2px",
        sm: "2px",
        DEFAULT: "3px",
        md: "4px",
        lg: "4px",
      },
      fontFamily: {
        sans: ["var(--font-plex-sans)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        none: "none",
        subtle: "0 1px 1px 0 rgba(0, 0, 0, 0.04)",
      },
      transitionTimingFunction: {
        soft: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      transitionDuration: {
        "light-in": "380ms",
        "light-out": "560ms",
        ui: "200ms",
        reveal: "560ms",
      },
      keyframes: {
        revealUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "reveal-up": "revealUp 560ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fadeIn 400ms cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
