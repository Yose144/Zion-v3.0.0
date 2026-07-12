'use client';

import StarfieldBackground from './StarfieldBackground';
import MatrixRain from './MatrixRain';
import CyberGrid from './CyberGrid';
import QuantumBubbles from './QuantumBubbles';
import WarpSpeedBackground from './WarpSpeedBackground';
import { useTheme } from '@/contexts/ThemeContext';
import { useObservatory } from '@/contexts/ObservatoryContext';

type BackgroundOrchestratorVariant = 'default' | 'home';

const OBSERVATORY_PRESETS = {
  'planet-orbit': {
    starfield: {
      starColor: [45, 212, 191] as [number, number, number],
      density: 300,
      speed: 3,
      trailOpacity: 0.06,
      backgroundGradient:
        'radial-gradient(circle at 60% 10%, rgba(4,30,28,0.92), rgba(2,12,11,0.98))',
    },
    bubbleDensity: 'high' as const,
  },
  'desktop-agent': {
    starfield: {
      // Exact match to APP&WEB/desktop-agent/src/ui/renderer.js
      starColor: [200, 118, 255] as [number, number, number], // galactic-core purple
      density: 100,
      speed: 3.2,
      trailOpacity: 0.045,
      lineTrails: true,
      fpsLimit: 24,
      // Purple radial gradient drawn ON canvas (matches desktop-agent cachedGradient)
      canvasGradient: { x: 0.4, y: 0.6, inner: 'rgba(22, 8, 32, 0.90)', outer: 'rgba(4, 2, 12, 0.98)' },
      canvasGradientAlpha: 0.22,
      // CSS background matches desktop-agent body gradient
      backgroundGradient:
        'radial-gradient(circle at 50% 20%, rgba(10,12,28,0.45), rgba(0,0,0,0.85)), radial-gradient(ellipse at 20% 30%, rgba(147,51,234,0.12), transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(6,182,212,0.08), transparent 50%), rgb(0,0,0)',
    },
    bubbleDensity: 'low' as const,
  },
  'warp-speed': {
    starfield: {
      starColor: [111, 255, 240] as [number, number, number],
      density: 520,
      speed: 14,
      trailOpacity: 0.03,
      backgroundGradient:
        'radial-gradient(ellipse at center, #083832 0%, #010807 100%)',
    },
    bubbleDensity: 'low' as const,
  },
  'galaxy-core': {
    starfield: {
      starColor: [232, 240, 255] as [number, number, number],
      density: 520,
      speed: 3.5,
      trailOpacity: 0.028,
      flowDirection: 'inward' as const,
      clearPerFrame: true,
      backgroundGradient:
        'radial-gradient(circle at 50% 50%, rgba(220,230,255,0.22) 0%, rgba(150,180,240,0.14) 6%, rgba(60,90,160,0.18) 18%, rgba(20,30,70,0.45) 38%, rgba(5,8,24,0.82) 65%, rgba(0,0,0,0.98) 100%)',
    },
    bubbleDensity: 'medium' as const,
  },
};

export default function BackgroundOrchestrator({ variant = 'default' }: { variant?: BackgroundOrchestratorVariant }) {
  const { currentTheme } = useTheme();
  const { mode } = useObservatory();
  const themeName = currentTheme.name;
  const observatory = OBSERVATORY_PRESETS[mode];
  const isHomeVariant = variant === 'home';
  const isGalaxyCoreMode = mode === 'galaxy-core';
  const isDesktopAgentMode = mode === 'desktop-agent';
  const shouldRenderWarpStarfield = isDesktopAgentMode || isGalaxyCoreMode || isHomeVariant || themeName === 'cosmic' || themeName === 'sacred';
  const shouldRenderMatrixRain = !isHomeVariant && !isGalaxyCoreMode && !isDesktopAgentMode && themeName === 'matrix';
  const shouldRenderCyberGrid = !isHomeVariant && !isGalaxyCoreMode && !isDesktopAgentMode && themeName === 'cyberpunk';

  if (mode === 'warp-speed') {
    return (
      <WarpSpeedBackground
        key={mode}
        starColor={[111, 255, 240]}
        speed={24}
        density={520}
        backgroundGradient="radial-gradient(ellipse at center, #0a2e2a 0%, #020a0a 100%)"
      />
    );
  }

  const starfieldConfig = isHomeVariant && !isGalaxyCoreMode && !isDesktopAgentMode
    ? {
        ...observatory.starfield,
        starColor: [80, 230, 210] as [number, number, number],
        density: Math.max(220, Math.floor(observatory.starfield.density * 0.84)),
        speed: Math.max(2.4, observatory.starfield.speed * 0.92),
        trailOpacity: Math.min(0.08, Math.max(0.05, observatory.starfield.trailOpacity)),
        backgroundGradient:
          'radial-gradient(circle at 50% 12%, rgba(80,230,210,0.24), rgba(10,80,70,0.18) 18%, rgba(8,22,30,0.78) 40%, rgba(2,8,10,0.95) 68%, rgba(0,0,0,0.995) 100%)',
      }
    : observatory.starfield;

  const bubbleDensity = isHomeVariant ? 'medium' : observatory.bubbleDensity;
  const overlayClass = isGalaxyCoreMode
    ? '' /* galaxy-core: CSS gradient on canvas is the look, no overlay */
    : isDesktopAgentMode
    ? '' /* desktop-agent: canvas gradient + CSS gradient is the look, no overlay */
    : isHomeVariant
    ? 'pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_12%,rgba(80,230,210,0.16),rgba(45,212,191,0.08)_18%,rgba(10,20,30,0.34)_34%,rgba(4,10,14,0.76)_58%,rgba(0,0,0,0.95)_100%)]'
    : 'pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_20%,rgba(10,12,28,0.65),rgba(0,0,0,0.95))]';

  return (
    <>
      {shouldRenderWarpStarfield && (
        <StarfieldBackground key={`starfield-${mode}`} {...starfieldConfig} />
      )}
      {shouldRenderMatrixRain && <MatrixRain key={`matrix-${mode}`} />}
      {shouldRenderCyberGrid && <CyberGrid key={`cyber-${mode}`} />}

      <QuantumBubbles key={`bubbles-${mode}`} mode={mode} density={bubbleDensity} />
      {overlayClass && <div key={`overlay-${mode}`} className={overlayClass} />}
    </>
  );
}
