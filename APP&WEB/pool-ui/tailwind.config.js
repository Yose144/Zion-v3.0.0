/** @type {import('tailwindcss').Config} */
const config = {
  corePlugins: {
    preflight: false,
  },
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'zion-gold': '#fcd116',
        'zion-purple': '#e41e2b',
        'zion-cyan': '#078930',
        'zion-blue': '#0d0d0d',
        'zion-dark': '#0a0a0f',
        'zion-black': '#050508',
        'rasta-red': '#e41e2b',
        'rasta-gold': '#fcd116',
        'rasta-green': '#078930',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
