import type { Config } from 'tailwindcss';

// Colours resolve to the CSS variables in globals.css, so the palette lives in
// one place and Tailwind classes (text-ink, bg-leaf, border-rule …) follow it.
const token = (name: string) => `var(--${name})`;

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: token('brand'), deep: token('brand-deep') },
        ink: { DEFAULT: token('ink'), soft: token('ink-soft') },
        muted: token('muted'),
        paper: token('paper'),
        leaf: token('leaf'),
        rule: { DEFAULT: token('rule'), strong: token('rule-strong') },
        margin: token('margin'),
        debit: { DEFAULT: token('debit'), wash: token('debit-wash') },
        credit: { DEFAULT: token('credit'), wash: token('credit-wash') },
      },
      fontFamily: {
        sans: ['var(--font-anek)', 'system-ui', '-apple-system', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
