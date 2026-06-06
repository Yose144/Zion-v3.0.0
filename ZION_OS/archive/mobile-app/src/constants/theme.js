/**
 * ZION TerraNova v3.0.0 — Unified Design System
 * Synchronized with: website-v2.9, desktop-agent
 *
 * Color tokens match:
 *   - desktop-agent/src/styles/main.css  (CSS vars)
 *   - website-v2.9/src/components/BackgroundOrchestrator (galactic-core)
 *
 * v3.0.0: CHv4 aktivní od genesis (CHV4_NPU_FORK_HEIGHT=0), revenue 89/5/5/1
 */

export const colors = {
  primary: {
    gold: '#FFD700',       // Primary accent — matching desktop/web
    goldWarm: '#f9d976',   // Warm gold variant
    cyan: '#06B6D4',       // Tertiary accent
    cyanBright: '#32e6ff', // Bright cyan variant
    purple: '#9333EA',     // Secondary accent — matching desktop/web
    purpleBright: '#9b5cff',
  },
  background: {
    dark: '#04020c',       // Galactic-core base (deepest)
    space: '#0a0118',      // Deep space black-purple
    card: 'rgba(12, 14, 30, 0.82)', // --card-bg from desktop
    elevated: 'rgba(0, 0, 0, 0.55)', // --view-shell from desktop
  },
  text: {
    primary: 'rgba(255,255,255,0.92)',
    secondary: 'rgba(255,255,255,0.68)',
    muted: 'rgba(255,255,255,0.45)',
  },
  glass: {
    bg: 'rgba(10, 12, 28, 0.72)',     // --glass-bg
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
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
  overlay: {
    light: 'rgba(255,255,255,0.08)',
    medium: 'rgba(255,255,255,0.15)',
    strong: 'rgba(255,255,255,0.25)',
  },
  glow: {
    gold: 'rgba(255, 215, 0, 0.3)',
    purple: 'rgba(147, 51, 234, 0.25)',
    cyan: 'rgba(6, 182, 212, 0.2)',
  },
};

export const gradients = {
  gold: ['#FFD700', '#f9a825'],
  cyan: ['#32e6ff', '#06B6D4'],
  purple: ['#9b5cff', '#9333EA'],
  glow: ['rgba(249,217,118,0.25)', 'rgba(147,51,234,0.15)', 'rgba(6,182,212,0.15)'],
  consciousness: ['#8b5cf6', '#ec4899', '#f59e0b'],
  dark: ['#04020c', '#0a0118'],
  galacticCore: ['rgba(22,8,32,0.9)', 'rgba(4,2,12,0.98)'],
  logoText: ['#FFD700', '#9333EA', '#06B6D4'],
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
