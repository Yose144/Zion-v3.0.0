'use client';

import { useEffect, useState } from 'react';
import { Html } from '@react-three/drei';
import { getLeaderboard, type LeaderboardEntry } from '@/lib/api';
import { RoundedBox } from '@react-three/drei';
import InteractiveObject from '@/components/InteractiveObject';
import GlassPanel from '@/components/GlassPanel';
import { getZonePosition } from '@/lib/zones';
import * as THREE from 'three';

const zonePos = getZonePosition('leaderboard');

export default function LeaderboardScene() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getLeaderboard().then((data) => {
      if (mounted) setEntries(data ?? []);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const top3 = entries.slice(0, 3);

  return (
    <group position={zonePos}>
      {loading && (
        <mesh position={[0, 1, 0]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.4} />
        </mesh>
      )}
      {top3.map((entry, i) => {
        const x = (i - 1) * 1.2;
        const h = 0.5 + (3 - i) * 0.35;
        const colors = ['#f59e0b', '#a1a1aa', '#b45309'];
        const pos = new THREE.Vector3(x, h / 2, 0);
        return (
          <InteractiveObject
            key={entry.address}
            label={`#${entry.rank} ${entry.display_name || shorten(entry.address)} · ${(
              entry.total_xp ?? entry.value ?? 0
            ).toLocaleString()} XP`}
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
