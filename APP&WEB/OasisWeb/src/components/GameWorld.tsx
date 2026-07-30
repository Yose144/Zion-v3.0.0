'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import Zone from './Zone';
import CameraFlight from './CameraFlight';
import OasisHub from './OasisHub';
import { ZONES, getZonePosition } from '@/lib/zones';

interface GameWorldProps {
  mode: 'dashboard' | 'avatars' | 'quests' | 'leaderboard' | 'onboarding';
  panel?: ReactNode;
  children?: ReactNode;
}

export default function GameWorld({ mode, panel, children }: GameWorldProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex h-full w-full items-center justify-center text-gray-400">
        <div className="text-center">
          <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-oasis-cyan border-t-transparent" />
          <p className="text-sm">Loading OASIS world…</p>
        </div>
      </div>
    );
  }

  const target = useMemo(() => {
    const pos = getZonePosition(mode);
    return new THREE.Vector3(...pos);
  }, [mode]);

  return (
    <div className="absolute inset-0 bg-oasis-black">
      <Canvas camera={{ position: [0, 9, 20], fov: 55 }} dpr={[1, 2]}>
        <color attach="background" args={['#02030a']} />
        <fog attach="fog" args={['#02030a', 14, 48]} />
        <ambientLight intensity={0.18} />
        <pointLight position={[10, 8, 10]} intensity={0.9} color="#ffffff" />
        <pointLight position={[-12, -6, -12]} intensity={0.6} color="#a855f7" />
        <pointLight position={[0, 10, 0]} intensity={0.5} color="#22d3ee" />

        <Stars radius={160} depth={120} count={8000} factor={4} saturation={0} fade speed={0.3} />

        <OasisHub />

        {ZONES.map((zone) => (
          <Zone
            key={zone.id}
            zone={zone}
            active={zone.id === mode}
            position={getZonePosition(zone.id)}
            panel={zone.id === mode ? panel : undefined}
          />
        ))}

        {children}

        <CameraFlight target={target} />

        <EffectComposer>
          <Bloom
            intensity={0.6}
            luminanceThreshold={0.2}
            luminanceSmoothing={0.5}
            mipmapBlur
            radius={0.5}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
