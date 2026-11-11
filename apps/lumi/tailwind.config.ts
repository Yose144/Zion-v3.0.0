import type { Config } from 'tailwindcss';

/**
 * Lumi — vizuální základ podle **ZION Design Engine v1.0** (schválený směr B).
 * Kanonické barvy enginu: inkoust #101C2B, les #344A36, pergamen #F0E1BE,
 * jantar #E7AA4B, rez #9D493D.
 *
 * Semantické barvy jsou CSS proměnné, takže light/dark motiv mění jediný
 * atribut `data-theme` na <html>. Nemíchat sem statické hex hodnoty pro
 * paper/ink/card/line — rozbilo by to přepínání motivu.
 */
const config: Config = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Statické značkové barvy
        parchment: '#F0E1BE',
        forest: 'rgb(var(--color-forest) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        amber: {
          50: '#FBF2DE',
          100: '#F6E6C4',
          200: '#EFD3A0',
          300: '#E7BE78',
          400: '#E7AA4B',
          500: '#E7AA4B',
          600: 'rgb(var(--color-amber-600) / <alpha-value>)',
          700: 'rgb(var(--color-amber-700) / <alpha-value>)',
          800: 'rgb(var(--color-amber-800) / <alpha-value>)',
          900: 'rgb(var(--color-amber-900) / <alpha-value>)',
        },
        // Semantické plochy a text (light/dark)
        'parchment-deep': 'rgb(var(--color-paper-deep) / <alpha-value>)',
        paper: 'rgb(var(--color-paper) / <alpha-value>)',
        cream: 'rgb(var(--color-paper-deep) / <alpha-value>)',
        card: 'rgb(var(--color-card) / <alpha-value>)',
        line: 'rgb(var(--color-line) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        'ink-soft': 'rgb(var(--color-ink-soft) / <alpha-value>)',
        rust: 'rgb(var(--color-rust) / <alpha-value>)',
        wood: {
          100: '#E9D7B6',
          200: '#D8BE93',
          300: '#BE9A6A',
          400: '#8A5A33',
          500: '#6B4226',
          600: '#4C2F1C',
        },
        moss: '#5B6B4A',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      maxWidth: {
        content: '76rem',
      },
      boxShadow: {
        warm: '0 24px 70px -30px rgba(16, 28, 43, 0.35)',
        glow: '0 0 80px -20px rgba(231, 170, 75, 0.5)',
      },
      animation: {
        'fade-up': 'fadeUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
        flicker: 'flicker 4s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        flicker: {
          '0%, 100%': { opacity: '0.85' },
          '45%': { opacity: '1' },
          '60%': { opacity: '0.78' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
