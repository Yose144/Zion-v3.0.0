'use client';

import { useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGuilds, type Guild } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { getZonePosition } from '@/lib/zones';
import InteractiveObject from '@/components/InteractiveObject';
import GlassPanel from '@/components/GlassPanel';
import Skeleton from '@/components/Skeleton';
import ErrorBoundary from '@/components/ErrorBoundary';

const zonePos = getZonePosition('guilds');
const GUILD_COLORS = ['#ec4899', '#a855f7', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e'];

interface GuildsSceneProps {
  onRefetch?: () => void;
}

export default function GuildsScene({ onRefetch }: GuildsSceneProps) {
  const { data, loading, error, retry, refetch } = useApi<Guild[]>(getGuilds, []);
  const [selected, setSelected] = useState<Guild | null>(null);
  const platformRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (platformRef.current) {
      platformRef.current.rotation.y = state.clock.elapsedTime * 0.05;
    }
  });

  const guilds = useMemo(() => data ?? [], [data]);

  const positions = useMemo(() => {
    return guilds.map((_, i) => {
      const a = (i / Math.max(1, guilds.length)) * Math.PI * 2;
      const r = 2.2;
      return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    });
  }, [guilds]);

  const selectedPos = useMemo(() => {
    if (!selected) return null;
    const i = guilds.findIndex((g) => g.id === selected.id);
    return i >= 0 ? positions[i] : null;
  }, [selected, guilds, positions]);

  const handleRefetch = () => {
    refetch();
    onRefetch?.();
  };

  return (
    <ErrorBoundary>
      <group position={zonePos}>
        <group ref={platformRef}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
            <cylinderGeometry args={[3, 3, 0.1, 48]} />
            <meshStandardMaterial color="#1a1a2e" emissive="#ec4899" emissiveIntensity={0.15} roughness={0.4} metalness={0.6} />
          </mesh>
          <mesh position={[0, -0.15, 0]}>
            <torusGeometry args={[2.2, 0.04, 16, 64]} rotation={[Math.PI / 2, 0, 0]} />
            <meshStandardMaterial color="#ec4899" emissive="#ec4899" emissiveIntensity={0.3} transparent opacity={0.8} />
          </mesh>
        </group>

        {loading && (
          <Html transform center distanceFactor={8} position={[0, 1, 0]}>
            <Skeleton lines={3} />
          </Html>
        )}

        {error && (
          <Html transform center distanceFactor={8} position={[0, 1.5, 0]} className="pointer-events-auto">
            <GlassPanel>
              <p className="text-sm text-red-300">{error}</p>
              <button onClick={retry} className="mt-2 rounded bg-oasis-cyan/20 px-3 py-1 text-xs text-oasis-cyan hover:bg-oasis-cyan/30">
                Retry
              </button>
            </GlassPanel>
          </Html>
        )}

        {guilds.map((g, i) => {
          const pos = positions[i] ?? new THREE.Vector3();
          const color = GUILD_COLORS[i % GUILD_COLORS.length];
          return (
            <InteractiveObject
              key={g.id}
              label={g.name}
              onClick={() => setSelected(g)}
              hoverScale={1.18}
              position={[pos.x, 0, pos.z]}
            >
              <mesh position={[0, 0.35, 0]}>
                <cylinderGeometry args={[0.18, 0.22, 0.7, 12]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} roughness={0.2} metalness={0.5} />
              </mesh>
              <mesh position={[0, 0.8, 0]}>
                <octahedronGeometry args={[0.18, 0]} />
                <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={0.6} />
              </mesh>
            </InteractiveObject>
          );
        })}

        {selected && selectedPos && (
          <Html
            transform
            center
            distanceFactor={8}
            position={[selectedPos.x, 1.4, selectedPos.z]}
            className="pointer-events-auto"
            style={{ width: 'min(85vw, 360px)' }}
          >
            <GlassPanel>
              <GuildDetail guild={selected} onClose={() => setSelected(null)} onRefetch={handleRefetch} />
            </GlassPanel>
          </Html>
        )}
      </group>
    </ErrorBoundary>
  );
}

function GuildDetail({
  guild,
  onClose,
  onRefetch,
}: {
  guild: Guild;
  onClose: () => void;
  onRefetch: () => void;
}) {
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const join = async () => {
    const res = await import('@/lib/api').then((m) => m.joinGuild(guild.id, address || 'pilgrim-0001'));
    setStatus(res ? `Joined ${guild.name}` : 'Join failed');
    onRefetch();
  };

  const treasury = guild.treasury ?? guild.guild_xp * 0.1;

  return (
    <div className="space-y-2 text-sm">
      <h3 className="text-lg font-bold text-oasis-cyan">{guild.name}</h3>
      <p className="text-oasis-gold">Level {guild.guild_level} · {guild.members.length} members</p>
      <p className="text-gray-300">{guild.description || 'No description.'}</p>
      <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
        <span>Territories:</span>
        <span className="text-white">{guild.territories.length}</span>
        <span>Treasury:</span>
        <span className="text-white">{Math.floor(treasury).toLocaleString()} ZION</span>
        <span>Quests completed:</span>
        <span className="text-white">{guild.quests_completed}</span>
      </div>
      <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Your pilgrim address"
          className="w-full rounded-xl bg-black/30 px-3 py-2 text-xs text-white outline-none placeholder:text-gray-500"
        />
        <button
          onClick={join}
          className="w-full rounded-xl bg-oasis-cyan/20 py-2 text-xs font-semibold text-oasis-cyan transition hover:bg-oasis-cyan/30"
        >
          Join Guild
        </button>
        {status && <p className="text-xs text-oasis-gold">{status}</p>}
      </div>
      <button onClick={onClose} className="mt-1 text-xs text-gray-400 hover:text-white">Close</button>
    </div>
  );
}
