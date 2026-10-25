/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: { DEFAULT: token('obsidian'), soft: token('charcoal'), line: token('obsidian-line') },
        canvas: token('canvas'),
        paper: token('paper'),
        sunk: token('sunk'),
        line: { DEFAULT: token('line'), strong: token('line-strong') },
        ink: { DEFAULT: token('ink'), soft: token('ink-soft'), faint: token('ink-faint'), inverse: token('ink-inverse'), 'inverse-soft': token('ink-inverse-soft') },
        accent: { DEFAULT: token('accent'), hover: token('accent-hover'), text: token('accent-text'), wash: token('accent-wash') },
        met: { DEFAULT: token('met'), wash: token('met-wash') },
        partial: { DEFAULT: token('partial'), wash: token('partial-wash') },
        missing: { DEFAULT: token('missing'), wash: token('missing-wash') },
        unknown: { DEFAULT: token('unknown'), wash: token('unknown-wash') },
      },
      fontFamily: {
        sans: ['"Instrument Sans"', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        // Modular scale (1.2) anchored at 15px body text.
        xs: ['0.75rem', { lineHeight: '1.1rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.9375rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.65rem' }],
        xl: ['1.35rem', { lineHeight: '1.8rem' }],
        '2xl': ['1.62rem', { lineHeight: '2rem' }],
        '3xl': ['1.95rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.6rem', { lineHeight: '2.85rem' }],
        '5xl': ['3.5rem', { lineHeight: '3.6rem' }],
        '6xl': ['4.75rem', { lineHeight: '4.6rem' }],
      },
      borderRadius: { none: '0', sm: '3px', DEFAULT: '4px', md: '6px', lg: '8px', full: '9999px' },
      maxWidth: { prose: '68ch', page: '76rem' },
      boxShadow: {
        pop: '0 12px 32px -12px rgb(22 23 27 / 0.35), 0 2px 6px rgb(22 23 27 / 0.08)',
      },
      keyframes: {
        enter: { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        sweep: { from: { strokeDashoffset: 'var(--dash-from)' }, to: { strokeDashoffset: 'var(--dash-to)' } },
        shimmer: { '0%': { opacity: '0.55' }, '50%': { opacity: '1' }, '100%': { opacity: '0.55' } },
      },
      animation: {
        enter: 'enter 160ms ease-out',
        shimmer: 'shimmer 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
