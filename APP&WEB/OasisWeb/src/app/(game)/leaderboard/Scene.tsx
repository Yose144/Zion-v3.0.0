'use client';

import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { getLeaderboard, type LeaderboardEntry } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { RoundedBox } from '@react-three/drei';
import InteractiveObject from '@/components/InteractiveObject';
import GlassPanel from '@/components/GlassPanel';
import Skeleton from '@/components/Skeleton';
import { getZonePosition } from '@/lib/zones';

const zonePos = getZonePosition('leaderboard');

export default function LeaderboardScene() {
  const { data, loading, error, retry } = useApi(getLeaderboard, []);
  const entries = data ?? [];

  const top3 = useMemo(() => entries.slice(0, 3), [entries]);

  return (
      <group position={zonePos}>
        {loading && (
          <Html transform center distanceFactor={8} position={[0, 1, 0]}>
            <Skeleton lines={3} />
          </Html>
        )}

        {error && (
          <Html transform center distanceFactor={8} position={[0, 1.5, 0]} className="pointer-events-auto">
            <GlassPanel>
              <p className="text-sm text-rasta-red/80">{error}</p>
              <button onClick={retry} className="mt-2 rounded bg-oasis-cyan/20 px-3 py-1 text-xs text-oasis-cyan hover:bg-oasis-cyan/30">
                Retry
              </button>
            </GlassPanel>
          </Html>
        )}

        {top3.map((entry, i) => {
          const x = (i - 1) * 1.2;
          const h = 0.5 + (3 - i) * 0.35;
          const colors = ['#fcd116', '#a3a3a3', '#e41e2b'];
          const pos = new THREE.Vector3(x, h / 2, 0);
          return (
            <InteractiveObject
              key={entry.address}
              label={`#${entry.rank} ${entry.display_name || shorten(entry.address)} · ${(entry.total_xp ?? entry.value ?? 0).toLocaleString()} XP`}
              hoverScale={1.08}
              position={[pos.x, pos.y, pos.z]}
            >
              <RoundedBox args={[0.7, h, 0.7]} radius={0.06} smoothness={4}>
                <meshStandardMaterial
                  color={colors[i]}
                  emissive={colors[i]}
                  emissiveIntensity={0.3}
                  roughness={0.2}
                  metalness={0.4}
                  transparent
                  opacity={0.9}
                />
              </RoundedBox>
              <Html distanceFactor={10} center position={[0, h / 2 + 0.35, 0]} className="pointer-events-none">
                <GlassPanel className="px-2 py-1 text-center text-xs text-white">
                  <span className="font-bold">#{entry.rank}</span>
                  <br />
                  {shorten(entry.display_name || entry.address)}
                </GlassPanel>
              </Html>
            </InteractiveObject>
          );
        })}
      </group>
  );
}

function shorten(addr: string) {
  if (addr.length > 20) return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  return addr;
}
