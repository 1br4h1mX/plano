/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Semantic tokens mapped to CSS variables so themes switch cleanly.
        base: 'rgb(var(--color-base) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        elevated: 'rgb(var(--color-elevated) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        sub: 'rgb(var(--color-sub) / <alpha-value>)',
        faint: 'rgb(var(--color-faint) / <alpha-value>)',
        line: 'rgb(var(--color-line) / <alpha-value>)',
        brand: 'rgb(var(--color-brand) / <alpha-value>)',
        'brand-soft': 'rgb(var(--color-brand-soft) / <alpha-value>)',
        ok: 'rgb(var(--color-ok) / <alpha-value>)',
        warn: 'rgb(var(--color-warn) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.04), 0 1px 3px rgb(0 0 0 / 0.06)',
        pop: '0 8px 30px rgb(0 0 0 / 0.12)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'pop-in': 'popIn 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        popIn: { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
};