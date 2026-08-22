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
        background: "#ffffff",
        secondary: "#ffffff",
        accent: "#E4FF00",
      },
      boxShadow: {
        "accent-glow": "0 0 20px rgba(230, 240, 0, 0.2)",
      },
    },
  },
  plugins: [],
};
export default config;
