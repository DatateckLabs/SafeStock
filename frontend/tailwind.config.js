/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0f1117",
          card: "#1a1d27",
          hover: "#22263a",
        },
        border: {
          DEFAULT: "#2e3250",
          focus: "#0ea5e9",
        },
        accent: {
          DEFAULT: "#0ea5e9",
          hover: "#38bdf8",
        },
        status: {
          ok: "#22c55e",
          alerta: "#eab308",
          critico: "#ef4444",
        },
        text: {
          primary: "#e2e8f0",
          secondary: "#94a3b8",
          muted: "#64748b",
        },
      },
    },
  },
  plugins: [],
};
