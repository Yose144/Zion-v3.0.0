'use client';

import StarfieldBackground from './StarfieldBackground';
import MatrixRain from './MatrixRain';
import CyberGrid from './CyberGrid';
import QuantumBubbles from './QuantumBubbles';
import { useTheme } from '@/contexts/ThemeContext';
import { useObservatory } from '@/contexts/ObservatoryContext';

type BackgroundOrchestratorVariant = 'default' | 'home';

const OBSERVATORY_PRESETS = {
  'deep-space': {
    starfield: {
      starColor: [255, 217, 118] as [number, number, number],
      density: 260,
      speed: 2.4,
      trailOpacity: 0.08,
      backgroundGradient:
        'radial-gradient(circle at 20% 20%, rgba(13,17,35,0.95), rgba(2,3,8,0.98))',
    },
    bubbleDensity: 'medium' as const,
  },
  'planet-orbit': {
    starfield: {
      starColor: [90, 200, 255] as [number, number, number],
      density: 300,
      speed: 3,
      trailOpacity: 0.06,
      backgroundGradient:
        'radial-gradient(circle at 60% 10%, rgba(6,14,32,0.92), rgba(2,4,18,0.98))',
    },
    bubbleDensity: 'high' as const,
  },
  'galactic-core': {
    starfield: {
      starColor: [200, 118, 255] as [number, number, number],
      density: 320,
      speed: 3.2,
      trailOpacity: 0.05,
      backgroundGradient:
        'radial-gradient(circle at 40% 60%, rgba(22,8,32,0.9), rgba(4,2,12,0.98))',
    },
    bubbleDensity: 'medium' as const,
  },
  'nebula-drift': {
    starfield: {
      starColor: [180, 140, 255] as [number, number, number],
      density: 180,
      speed: 1.6,
      trailOpacity: 0.12,
      backgroundGradient:
        'radial-gradient(ellipse at 30% 40%, rgba(30,12,50,0.92), rgba(8,4,20,0.97))',
    },
    bubbleDensity: 'high' as const,
  },
  'galaxy-core': {
    starfield: {
      starColor: [200, 230, 255] as [number, number, number],
      density: 420,
      speed: 7,
      trailOpacity: 0.03,
      backgroundGradient:
        'radial-gradient(circle at 50% 50%, rgba(20,40,80,0.85), rgba(4,6,16,0.97))',
    },
    bubbleDensity: 'low' as const,
  },
};

export default function BackgroundOrchestrator({ variant = 'default' }: { variant?: BackgroundOrchestratorVariant }) {
  const { currentTheme } = useTheme();
  const { mode } = useObservatory();
  const themeName = currentTheme.name;
  const observatory = OBSERVATORY_PRESETS[mode];
  const isHomeVariant = variant === 'home';
  const shouldRenderWarpStarfield = isHomeVariant || themeName === 'cosmic' || themeName === 'sacred';
  const shouldRenderMatrixRain = !isHomeVariant && themeName === 'matrix';
  const shouldRenderCyberGrid = !isHomeVariant && themeName === 'cyberpunk';

  const starfieldConfig = isHomeVariant
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
  const overlayClass = isHomeVariant
    ? 'pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_12%,rgba(80,230,210,0.16),rgba(45,212,191,0.08)_18%,rgba(10,20,30,0.34)_34%,rgba(4,10,14,0.76)_58%,rgba(0,0,0,0.95)_100%)]'
    : 'pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_20%,rgba(10,12,28,0.65),rgba(0,0,0,0.95))]';

  return (
    <>
      {shouldRenderWarpStarfield && (
        <StarfieldBackground {...starfieldConfig} />
      )}
      {shouldRenderMatrixRain && <MatrixRain />}
      {shouldRenderCyberGrid && <CyberGrid />}

      <QuantumBubbles mode={mode} density={bubbleDensity} />
      <div className={overlayClass} />
    </>
  );
}
