/**
 * ZION canonical Tailwind preset — mirrors apps/shared/ui/tokens.css.
 * Consumers (Tailwind 3 apps: IntroPage, MarketPlace, pool-ui):
 *   presets: [require('path/to/shared/ui/tailwind.preset.cjs')]
 * Requires tokens.css to be imported in globals for the CSS vars to resolve.
 * Tailwind 4 apps (website-v2.9, OasisWeb) use tokens.css + @theme instead.
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        'zion-gold': 'rgb(var(--color-zion-gold) / <alpha-value>)',
        'zion-purple': 'rgb(var(--color-zion-purple) / <alpha-value>)',
        'zion-cyan': 'rgb(var(--color-zion-cyan) / <alpha-value>)',
        'zion-blue': 'rgb(var(--color-zion-blue) / <alpha-value>)',
        'rasta-red': '#e41e2b',
        'rasta-gold': '#fcd116',
        'rasta-green': '#066928',
        'rasta-dark': '#1a1a1a',
        'rasta-black': '#0d0d0d',
        'quantum-blue': '#00d4ff',
        'matrix-green': '#00ff41',
      },
      borderRadius: {
        'zion-sm': 'var(--zion-radius-sm)',
        'zion-md': 'var(--zion-radius-md)',
        'zion-lg': 'var(--zion-radius-lg)',
        'zion-xl': 'var(--zion-radius-xl)',
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
};
