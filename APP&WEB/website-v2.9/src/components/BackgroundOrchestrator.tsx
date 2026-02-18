'use client';

import StarfieldBackground from './StarfieldBackground';
import MatrixRain from './MatrixRain';
import CyberGrid from './CyberGrid';
import QuantumBubbles from './QuantumBubbles';
import { useTheme } from '@/contexts/ThemeContext';
import { useObservatory } from '@/contexts/ObservatoryContext';

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
};

export default function BackgroundOrchestrator() {
  const { currentTheme } = useTheme();
  const { mode } = useObservatory();
  const themeName = currentTheme.name;
  const observatory = OBSERVATORY_PRESETS[mode];

  return (
    <>
      {(themeName === 'cosmic' || themeName === 'sacred') && (
        <StarfieldBackground {...observatory.starfield} />
      )}
      {themeName === 'matrix' && <MatrixRain />}
      {themeName === 'cyberpunk' && <CyberGrid />}

      <QuantumBubbles mode={mode} density={observatory.bubbleDensity} />
      <div className="pointer-events-none fixed inset-0 -z-40 bg-[radial-gradient(circle_at_50%_20%,rgba(10,12,28,0.65),rgba(0,0,0,0.95))]" />
    </>
  );
}
