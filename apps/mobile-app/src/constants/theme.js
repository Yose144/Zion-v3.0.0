/**
 * ZION TerraNova v3.2.0 — Unified Rasta Design System
 * Synchronized with: website-v2.9 (rasta palette), desktop-agent
 *
 * Rasta colors: Red / Gold / Green / Black
 *   - web2.9: globals.css --color-zion-gold/purple/cyan/blue
 *   - desktop-agent: index.html :root --zion-gold/purple/cyan/blue
 *
 * v3.2.0: One Love — rasta palette synced across all surfaces.
 */

export const colors = {
  primary: {
    gold: '#fcd116',         // Rasta Gold — primary accent
    goldWarm: '#f9d976',     // Warm gold variant
    red: '#e41e2b',          // Rasta Red — secondary accent (replaces purple)
    redBright: '#ff4d5a',    // Bright red variant
    green: '#078930',        // Rasta Green — tertiary accent (replaces cyan)
    greenBright: '#34d399',  // Bright green variant
  },
  rasta: {
    red: '#e41e2b',
    gold: '#fcd116',
    green: '#078930',
    dark: '#1a1a1a',
    black: '#0d0d0d',
  },
  supplementary: {
    quantumBlue: '#00d4ff',  // Tech/data accent
    matrixGreen: '#00ff41',  // Live pulse, online status
    amber: '#f59e0b',        // Warning, attention
    rose: '#f43f5e',         // Terra Nova story
    teal: '#14b8a6',         // Genesis, docs
    indigo: '#6366f1',       // Roadmap, API
  },
  background: {
    dark: '#0d0d0d',         // Rasta black base (deepest)
    space: '#0a0a0a',        // Deep space black
    card: 'rgba(13, 13, 13, 0.82)', // --card-bg (rasta black)
    elevated: 'rgba(0, 0, 0, 0.55)', // --view-shell
  },
  text: {
    primary: 'rgba(255,255,255,0.92)',
    secondary: 'rgba(255,255,255,0.68)',
    muted: 'rgba(255,255,255,0.45)',
  },
  glass: {
    bg: 'rgba(13, 13, 13, 0.72)',     // --glass-bg (rasta black)
    border: 'rgba(255,255,255,0.12)',  // --glass-border
    borderLight: 'rgba(255,255,255,0.06)',
  },
  consciousness: {
    physical: '#3b82f6',
    mental: '#8b5cf6',
    spiritual: '#ec4899',
    cosmic: '#f59e0b',
    onTheStar: '#eab308',
  },
  status: {
    success: '#078930',      // Rasta green
    warning: '#fcd116',      // Rasta gold
    error: '#e41e2b',        // Rasta red
    info: '#00d4ff',         // Quantum blue
  },
  overlay: {
    light: 'rgba(255,255,255,0.08)',
    medium: 'rgba(255,255,255,0.15)',
    strong: 'rgba(255,255,255,0.25)',
  },
  glow: {
    gold: 'rgba(252, 209, 22, 0.3)',
    red: 'rgba(228, 30, 43, 0.25)',
    green: 'rgba(7, 137, 48, 0.2)',
  },
};

export const gradients = {
  // Rasta tri-color: red → gold → green
  rasta: ['#e41e2b', '#fcd116', '#078930'],
  gold: ['#fcd116', '#f9a825'],
  red: ['#ff4d5a', '#e41e2b'],
  green: ['#34d399', '#078930'],
  // Background glow — rasta radial
  glow: ['rgba(252,209,22,0.25)', 'rgba(228,30,43,0.15)', 'rgba(7,137,48,0.15)'],
  consciousness: ['#8b5cf6', '#ec4899', '#f59e0b'],
  dark: ['#0d0d0d', '#0a0a0a'],
  galacticCore: ['rgba(13,13,13,0.9)', 'rgba(0,0,0,0.98)'],
  // Logo text — rasta tri-color
  logoText: ['#e41e2b', '#fcd116', '#078930'],
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  full: 9999,
};

export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 40,
    color: colors.text.primary,
  },
  h2: {
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 32,
    color: colors.text.primary,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
    color: colors.text.primary,
  },
  body: {
    fontSize: 16,
    fontWeight: 'normal',
    lineHeight: 24,
    color: colors.text.secondary,
  },
  caption: {
    fontSize: 14,
    fontWeight: 'normal',
    lineHeight: 20,
    color: colors.text.muted,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: {
    shadowColor: colors.primary.gold,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  glowRed: {
    shadowColor: colors.primary.red,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  glowGreen: {
    shadowColor: colors.primary.green,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
};

export const animations = {
  duration: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
  easing: {
    default: 'ease-in-out',
    spring: 'spring',
  },
};

export default {
  colors,
  gradients,
  spacing,
  borderRadius,
  typography,
  shadows,
  animations,
};
