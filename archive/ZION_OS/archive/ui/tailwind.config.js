/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        zion: {
          bg: '#0a0a0f',
          panel: 'rgba(20, 20, 35, 0.7)',
          border: 'rgba(100, 200, 255, 0.2)',
          glow: 'rgba(0, 255, 200, 0.3)',
          ok: '#00ffaa',
          warn: '#ffcc00',
          critical: '#ff3366',
          info: '#00ccff',
          dim: '#888899',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        'panel': '12px',
      },
      boxShadow: {
        'glow-green': '0 0 20px rgba(0, 255, 170, 0.3)',
        'glow-blue': '0 0 20px rgba(0, 200, 255, 0.3)',
        'glow-red': '0 0 20px rgba(255, 50, 100, 0.3)',
        'glow-yellow': '0 0 20px rgba(255, 200, 0, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0, 255, 200, 0.2)' },
          '100%': { boxShadow: '0 0 25px rgba(0, 255, 200, 0.5)' },
        }
      }
    },
  },
  plugins: [],
}
