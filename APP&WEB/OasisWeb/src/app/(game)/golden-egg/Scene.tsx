'use client';

import { useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getPrizeTiers, type PrizeConfig } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { getZonePosition } from '@/lib/zones';
import InteractiveObject from '@/components/InteractiveObject';
import GlassPanel from '@/components/GlassPanel';
import Skeleton from '@/components/Skeleton';
import ErrorBoundary from '@/components/ErrorBoundary';
import { CLUES, CATEGORIES, type Clue } from './clues';

const zonePos = getZonePosition('golden-egg');
const CAT_COLORS: Record<string, string> = {
  library: '#22d3ee',
  avatar: '#a855f7',
  world: '#10b981',
  source: '#f59e0b',
  community: '#ec4899',
};

function GoldenEgg() {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (mesh.current) {
      mesh.current.rotation.y = state.clock.elapsedTime * 0.08;
      mesh.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.4) * 0.08;
    }
  });

  return (
    <group>
      <mesh ref={mesh}>
        <sphereGeometry args={[1.1, 64, 64]} />
        <meshStandardMaterial
          color="#facc15"
          emissive="#f59e0b"
          emissiveIntensity={0.8}
          roughness={0.15}
          metalness={0.9}
        />
      </mesh>
      <mesh scale={[1.15, 1.15, 1.15]}>
        <sphereGeometry args={[1.1, 64, 64]} />
        <meshStandardMaterial color="#facc15" emissive="#f59e0b" emissiveIntensity={0.2} transparent opacity={0.35} />
      </mesh>
      <pointLight position={[0, 0, 0]} intensity={2} color="#facc15" distance={18} />
    </group>
  );
}

export default function GoldenEggScene() {
  const { data: prizes, loading, error, retry } = useApi<PrizeConfig>(getPrizeTiers, []);
  const [selected, setSelected] = useState<Clue | null>(null);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.02;
    }
  });

  const discovered = 0;
  const progress = {
    Ramayana: { total: 36, found: 0 },
    Mahabharata: { total: 36, found: 0 },
    Unity: { total: 36, found: 0 },
  };

  const cluePositions = useMemo(() => {
    return CLUES.map((_, i) => {
      const t = i / CLUES.length;
      const a = t * Math.PI * 12;
      const r = 3.2 + (i % 3) * 0.3;
      const y = Math.sin(t * Math.PI * 6) * 0.8;
      return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    });
  }, []);

  const selectedPos = useMemo(() => {
    if (!selected) return null;
    const i = CLUES.findIndex((c) => c.id === selected.id);
    return i >= 0 ? cluePositions[i] : null;
  }, [selected, cluePositions]);

  return (
    <ErrorBoundary>
      <group position={zonePos} ref={groupRef}>
        <GoldenEgg />

        {loading && (
          <Html transform center distanceFactor={8} position={[0, 2, 0]}>
            <Skeleton lines={3} />
          </Html>
        )}

        {error && (
          <Html transform center distanceFactor={8} position={[0, 2.5, 0]} className="pointer-events-auto">
            <GlassPanel>
              <p className="text-sm text-red-300">{error}</p>
              <button onClick={retry} className="mt-2 rounded bg-oasis-cyan/20 px-3 py-1 text-xs text-oasis-cyan hover:bg-oasis-cyan/30">
                Retry
              </button>
            </GlassPanel>
          </Html>
        )}

        {CLUES.map((clue, i) => {
          const pos = cluePositions[i] ?? new THREE.Vector3();
          const color = CAT_COLORS[clue.category] ?? '#ffffff';
          return (
            <InteractiveObject
              key={clue.id}
              label={`Clue ${clue.id}`}
              onClick={() => setSelected(clue)}
              hoverScale={1.5}
              position={[pos.x, pos.y, pos.z]}
            >
              <mesh>
                <sphereGeometry args={[0.08, 16, 16]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} roughness={0.2} />
              </mesh>
            </InteractiveObject>
          );
        })}

        {selected && selectedPos && (
          <Html
            transform
            center
            distanceFactor={8}
            position={[selectedPos.x, selectedPos.y + 0.5, selectedPos.z]}
            className="pointer-events-auto"
            style={{ width: 'min(85vw, 360px)' }}
          >
            <GlassPanel>
              <ClueDetail clue={selected} onClose={() => setSelected(null)} />
            </GlassPanel>
          </Html>
        )}

        {prizes && (
          <Html transform center distanceFactor={10} position={[0, -1.8, 2.2]} className="pointer-events-none select-none">
            <GlassPanel className="px-3 py-1.5 text-center text-xs text-oasis-gold">
              Pool: {prizes.total_pool_zion.toLocaleString()} ZION
            </GlassPanel>
          </Html>
        )}
      </group>

      <Html transform center distanceFactor={10} position={[-3.5, 2.5, 0]} className="pointer-events-none hidden sm:block">
        <GlassPanel className="px-3 py-2 text-xs">
          <h4 className="mb-1 font-bold text-oasis-gold">Master Keys</h4>
          <div className="space-y-1 text-gray-300">
            {Object.entries(progress).map(([key, p]) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <span>{key}</span>
                <div className="h-1.5 w-16 rounded bg-white/10">
                  <div
                    className="h-1.5 rounded bg-oasis-gold"
                    style={{ width: `${(p.found / p.total) * 100}%` }}
                  />
                </div>
                <span className="text-[10px]">{p.found}/{p.total}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-gray-400">Discovered: {discovered}/108</p>
        </GlassPanel>
      </Html>
    </ErrorBoundary>
  );
}

function ClueDetail({ clue, onClose }: { clue: Clue; onClose: () => void }) {
  const color = CAT_COLORS[clue.category] ?? '#ffffff';
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <p className="text-xs text-oasis-gold uppercase">{CATEGORIES[clue.category]}</p>
      </div>
      <h3 className="text-lg font-bold text-oasis-cyan">Clue {clue.id}</h3>
      <p className="text-gray-300">{clue.hint}</p>
      <button onClick={onClose} className="mt-2 rounded-lg bg-oasis-gold/20 px-3 py-1.5 text-xs text-oasis-gold transition hover:bg-oasis-gold/30">
        Close
      </button>
    </div>
  );
}
