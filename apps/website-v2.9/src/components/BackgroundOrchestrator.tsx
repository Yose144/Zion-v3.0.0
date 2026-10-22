'use client';

import StarfieldBackground from './StarfieldBackground';
import { useObservatory } from '@/contexts/ObservatoryContext';

type BackgroundOrchestratorVariant = 'default' | 'home';

const OBSERVATORY_PRESETS: Record<
  string,
  {
    starColor: [number, number, number] | [number, number, number][];
    density: number;
    speed: number;
    trailOpacity: number;
    backgroundGradient: string;
    flowDirection?: 'outward' | 'inward';
    lineTrails?: boolean;
    fpsLimit?: number;
    canvasGradient?: { x: number; y: number; inner: string; outer: string };
    canvasGradientAlpha?: number;
  }
> = {
  maintenance: {
    starColor: [
      [252, 209, 22],
      [228, 30, 43],
      [6, 105, 40],
    ],
    density: 250,
    speed: 2,
    trailOpacity: 0.08,
    backgroundGradient: 'radial-gradient(circle at 30% 20%, rgba(228,30,43,0.08) 0%, transparent 40%), radial-gradient(circle at 70% 80%, rgba(6,105,40,0.06) 0%, transparent 40%), radial-gradient(ellipse at bottom, #0a0a0a 0%, #000 100%)',
    lineTrails: true,
    fpsLimit: 24,
    canvasGradient: { x: 0.5, y: 0.7, inner: 'rgba(15, 10, 10, 1)', outer: 'rgba(2, 2, 2, 1)' },
    canvasGradientAlpha: 0.22,
  },
  'planet-orbit': {
    starColor: [6, 105, 40],
    density: 220,
    speed: 2.4,
    trailOpacity: 0.07,
    backgroundGradient: 'radial-gradient(circle at 60% 10%, rgba(4,30,28,0.92), rgba(2,12,11,0.98))',
    lineTrails: true,
    fpsLimit: 24,
  },
  'desktop-agent': {
    starColor: [228, 30, 43],
    density: 180,
    speed: 2.6,
    trailOpacity: 0.06,
    backgroundGradient:
      'radial-gradient(circle at 50% 20%, rgba(10,12,28,0.45), rgba(0,0,0,0.85)), radial-gradient(ellipse at 20% 30%, rgba(228,30,43,0.12), transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(6,105,40,0.08), transparent 50%), rgb(0,0,0)',
    lineTrails: true,
    fpsLimit: 24,
  },
  'warp-speed': {
    starColor: [6, 105, 40],
    density: 300,
    speed: 12,
    trailOpacity: 0.05,
    backgroundGradient: 'radial-gradient(ellipse at center, #0a2e2a 0%, #020a0a 100%)',
    lineTrails: true,
    fpsLimit: 30,
  },
  'galaxy-core': {
    starColor: [232, 240, 255],
    density: 260,
    speed: 2.8,
    trailOpacity: 0.05,
    backgroundGradient:
      'radial-gradient(circle at 50% 50%, rgba(220,230,255,0.22) 0%, rgba(150,180,240,0.14) 6%, rgba(60,90,160,0.18) 18%, rgba(20,30,70,0.45) 38%, rgba(5,8,24,0.82) 65%, rgba(0,0,0,0.98) 100%)',
    flowDirection: 'inward',
    lineTrails: true,
    fpsLimit: 24,
  },
};

export default function BackgroundOrchestrator({
  variant = 'default',
}: {
  variant?: BackgroundOrchestratorVariant;
}) {
  const { mode } = useObservatory();
  const config = OBSERVATORY_PRESETS[mode] || OBSERVATORY_PRESETS.maintenance;

  // Home variant uses a slightly calmer starfield
  const starfieldConfig =
    variant === 'home' && mode === 'maintenance'
      ? {
          ...config,
          density: Math.max(180, Math.floor(config.density * 0.75)),
          speed: Math.max(1.6, config.speed * 0.85),
          trailOpacity: Math.min(0.08, Math.max(0.05, config.trailOpacity)),
        }
      : config;

  return (
    <StarfieldBackground
      key={mode}
      starColor={starfieldConfig.starColor}
      density={starfieldConfig.density}
      speed={starfieldConfig.speed}
      trailOpacity={starfieldConfig.trailOpacity}
      backgroundGradient={starfieldConfig.backgroundGradient}
      flowDirection={starfieldConfig.flowDirection}
      lineTrails={starfieldConfig.lineTrails}
      fpsLimit={starfieldConfig.fpsLimit}
      canvasGradient={starfieldConfig.canvasGradient}
      canvasGradientAlpha={starfieldConfig.canvasGradientAlpha}
    />
  );
}
