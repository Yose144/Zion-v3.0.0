/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'zion-gold': 'rgb(var(--color-zion-gold) / <alpha-value>)',
        'zion-purple': 'rgb(var(--color-zion-purple) / <alpha-value>)',
        'zion-cyan': 'rgb(var(--color-zion-cyan) / <alpha-value>)',
        'zion-blue': 'rgb(var(--color-zion-blue) / <alpha-value>)',
        zion: {
          900: 'rgb(var(--color-bg) / 1)',
          950: '#05070f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        'zion': '1.2rem',
        'zion-lg': '1.65rem',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
    },
  },
  plugins: [],
};
