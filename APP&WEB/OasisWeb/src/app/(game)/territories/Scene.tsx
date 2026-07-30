'use client';

import { useMemo, useState } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { getTerritories, type Territory, type TerritoryMap } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { getZonePosition } from '@/lib/zones';
import InteractiveObject from '@/components/InteractiveObject';
import GlassPanel from '@/components/GlassPanel';
import Skeleton from '@/components/Skeleton';
import ErrorBoundary from '@/components/ErrorBoundary';

const zonePos = getZonePosition('territories');

const REGION_STYLE: Record<string, { color: string; shape: 'crystal' | 'sphere' | 'plateau' | 'torus' }> = {
  Mountains: { color: '#94a3b8', shape: 'crystal' },
  Forest: { color: '#22c55e', shape: 'plateau' },
  Desert: { color: '#facc15', shape: 'sphere' },
  Ocean: { color: '#0ea5e9', shape: 'torus' },
  Volcano: { color: '#ef4444', shape: 'crystal' },
  CrystalCaves: { color: '#a855f7', shape: 'crystal' },
  Temple: { color: '#f59e0b', shape: 'plateau' },
  Nexus: { color: '#22d3ee', shape: 'torus' },
};

function Artifact({ region }: { region: string }) {
  const style = REGION_STYLE[region] ?? REGION_STYLE.Mountains;
  const { color, shape } = style;
  if (shape === 'crystal') {
    return (
      <mesh>
        <octahedronGeometry args={[0.32, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} roughness={0.2} metalness={0.5} />
      </mesh>
    );
  }
  if (shape === 'plateau') {
    return (
      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.4, 0.5, 0.06, 6]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.4} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.25, 0]}>
          <coneGeometry args={[0.2, 0.5, 6]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
        </mesh>
      </group>
    );
  }
  if (shape === 'torus') {
    return (
      <mesh>
        <torusGeometry args={[0.28, 0.1, 16, 48]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} roughness={0.2} metalness={0.5} />
      </mesh>
    );
  }
  return (
    <mesh>
      <sphereGeometry args={[0.32, 24, 24]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.3} metalness={0.4} />
    </mesh>
  );
}

export default function TerritoriesScene() {
  const { data, loading, error, retry } = useApi<TerritoryMap>(getTerritories, [], { enableRefetch: true });
  const [selected, setSelected] = useState<Territory | null>(null);

  const territories = useMemo(() => {
    if (!data) return [];
    return Object.values(data.territories);
  }, [data]);

  const positions = useMemo(() => {
    return territories.map((_, i) => {
      const a = (i / 8) * Math.PI * 2;
      const r = 2.4 + (i % 2) * 0.6;
      return new THREE.Vector3(Math.cos(a) * r, 0.2 + Math.sin(i) * 0.2, Math.sin(a) * r);
    });
  }, [territories]);

  const selectedPos = useMemo(() => {
    if (!selected) return null;
    const i = territories.findIndex((t) => t.id === selected.id);
    return i >= 0 ? positions[i] : null;
  }, [selected, territories, positions]);

  return (
    <ErrorBoundary>
      <group position={zonePos}>
        {loading && (
          <Html transform center distanceFactor={8} position={[0, 1, 0]}>
            <Skeleton lines={3} />
          </Html>
        )}

        {error && (
          <Html transform center distanceFactor={8} position={[0, 1, 0]} className="pointer-events-auto">
            <GlassPanel>
              <p className="text-sm text-red-300">{error}</p>
              <button
                onClick={retry}
                className="mt-2 rounded bg-oasis-cyan/20 px-3 py-1 text-xs text-oasis-cyan hover:bg-oasis-cyan/30"
              >
                Retry
              </button>
            </GlassPanel>
          </Html>
        )}

        {territories.map((t, i) => {
          const pos = positions[i] ?? new THREE.Vector3();
          return (
            <InteractiveObject
              key={t.id}
              label={t.name}
              onClick={() => setSelected(t)}
              hoverScale={1.2}
              position={[pos.x, pos.y, pos.z]}
            >
              <Artifact region={t.region} />
            </InteractiveObject>
          );
        })}

        {selected && selectedPos && (
          <Html
            transform
            center
            distanceFactor={8}
            position={[selectedPos.x, selectedPos.y + 0.8, selectedPos.z]}
            className="pointer-events-auto"
            style={{ width: 'min(85vw, 340px)' }}
          >
            <GlassPanel>
              <TerritoryDetail territory={selected} onClose={() => setSelected(null)} />
            </GlassPanel>
          </Html>
        )}
      </group>
    </ErrorBoundary>
  );
}

function TerritoryDetail({ territory, onClose }: { territory: Territory; onClose: () => void }) {
  const style = REGION_STYLE[territory.region] ?? REGION_STYLE.Mountains;
  return (
    <div className="space-y-2 text-sm">
      <h3 className="text-lg font-bold" style={{ color: style.color }}>
        {territory.name}
      </h3>
      <p className="text-xs text-oasis-gold">{territory.region}</p>
      <p className="text-gray-300">{territory.description || 'No description available.'}</p>
      <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
        <span>Controller:</span>
        <span className="text-white">{territory.controller ?? 'Unclaimed'}</span>
        <span>Mining bonus:</span>
        <span className="text-white">{territory.mining_bonus.toFixed(2)}x</span>
        <span>XP bonus:</span>
        <span className="text-white">{territory.xp_bonus.toFixed(2)}x</span>
        <span>Defense:</span>
        <span className="text-white">{territory.defense_power}</span>
      </div>
      <button
        onClick={onClose}
        className="mt-2 rounded-lg bg-oasis-cyan/20 px-3 py-1.5 text-xs text-oasis-cyan transition hover:bg-oasis-cyan/30"
      >
        Close
      </button>
    </div>
  );
}
