import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Rasta brand palette
        'rasta-red': '#e41e2b',
        'rasta-gold': '#fcd116',
        'rasta-green': '#078930',
        'rasta-black': '#0d0d0d',
        'rasta-dark': '#1a1a1a',
        // CSS-variable based brand colors (now mapped to Rasta)
        'zion-gold': 'rgb(var(--color-zion-gold) / <alpha-value>)',
        'zion-purple': 'rgb(var(--color-zion-purple) / <alpha-value>)',
        'zion-cyan': 'rgb(var(--color-zion-cyan) / <alpha-value>)',
        'zion-blue': 'rgb(var(--color-zion-blue) / <alpha-value>)',
        // Legacy OASIS/ZION aliases remapped to Rasta
        oasis: {
          black: '#090A0F',
          cyan: '#078930',
          purple: '#e41e2b',
          emerald: '#078930',
          gold: '#fcd116',
          rose: '#e41e2b',
          blue: '#0f172a',
        },
        zion: {
          dark: '#090A0F',
          card: '#0a0c14',
          border: '#1a1d2e',
          gold: '#fcd116',
          purple: '#e41e2b',
          cyan: '#078930',
          blue: '#0f172a',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 4s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'shimmer': 'shimmer 3s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'float 10s ease-in-out infinite',
        'spin-slow': 'spin 20s linear infinite',
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'scale-in': 'scaleIn 0.4s ease-out forwards',
        'gradient-x': 'gradientX 8s ease infinite',
        'twinkle': 'twinkle 3s ease-in-out infinite',
        'orbit': 'orbit 20s linear infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(252, 209, 22, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(7, 137, 48, 0.5)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        gradientX: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        twinkle: {
          '0%, 100%': { opacity: '0.2' },
          '50%': { opacity: '1' },
        },
        orbit: {
          '0%': { transform: 'rotate(0deg) translateX(40px) rotate(0deg)' },
          '100%': { transform: 'rotate(360deg) translateX(40px) rotate(-360deg)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
