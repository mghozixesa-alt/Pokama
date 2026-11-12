import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#2A7DC1",
          dark: "#1F5F9E",
          light: "#E8F1FB",
          navy: "#10365C",
        },
        teal: { DEFAULT: "#20B4A9", light: "#D2EFEC", dark: "#0B6B63" },
        ink: "#141A26",
        muted: "#5B6475",
        line: "#E6E9F0",
        page: "#F3F5F9",
      },
      fontFamily: { sans: ["var(--font-poppins)", "system-ui", "sans-serif"] },
      borderRadius: { xl2: "18px" },
    },
  },
  plugins: [],
} satisfies Config;
