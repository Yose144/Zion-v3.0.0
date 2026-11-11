import type { Config } from 'tailwindcss';

/**
 * Lumi — vizuální základ podle **ZION Design Engine v1.0** (schválený směr B).
 * Kanonické barvy enginu: inkoust #101C2B, les #344A36, pergamen #F0E1BE,
 * jantar #E7AA4B, rez #9D493D. Lumi zůstává samostatná značka — přebírá
 * paletu a princip „jeden světelný akcent, čitelná silueta, malované okolí“,
 * ne ZION symboly.
 *
 * Historické názvy (`paper`, `cream`, `wood`) zůstávají jako aliasy, aby
 * se nemusely přepisovat všechny komponenty; hodnoty jsou nové.
 */
const config: Config = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        parchment: '#F0E1BE',
        'parchment-deep': '#E6D3A8',
        paper: '#F0E1BE',
        cream: '#E6D3A8',
        card: '#F8EFD9',
        line: '#D8C5A0',
        muted: '#6E6650',
        ink: '#101C2B',
        'ink-soft': '#33424B',
        forest: '#344A36',
        rust: '#9D493D',
        amber: {
          50: '#FBF2DE',
          100: '#F6E6C4',
          200: '#EFD3A0',
          300: '#E7BE78',
          400: '#E7AA4B',
          500: '#E7AA4B',
          600: '#C98A2E',
          700: '#9D6A1F',
          800: '#7A4F17',
        },
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
