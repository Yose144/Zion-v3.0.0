'use client';

import { useMemo, useState, memo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { getAvatars, type AvatarDef } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { getZonePosition } from '@/lib/zones';
import InteractiveObject from '@/components/InteractiveObject';
import GlassPanel from '@/components/GlassPanel';
import Skeleton from '@/components/Skeleton';

const zonePos = getZonePosition('avatars');

export default function AvatarsScene() {
  const { data, loading, error, retry } = useApi(getAvatars, []);
  const avatars = data ?? [];
  const [selected, setSelected] = useState<AvatarDef | null>(null);

  const positions = useMemo(() => {
    return avatars.map((_, i) => {
      const t = i / Math.max(1, avatars.length - 1);
      const a = t * Math.PI * 4;
      const r = 1.4 + t * 1.8;
      const y = Math.sin(t * Math.PI * 3) * 0.5;
      return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    });
  }, [avatars]);

  const selectedPos = useMemo(() => {
    if (!selected) return null;
    const i = avatars.findIndex((a) => a.id === selected.id);
    return i >= 0 ? positions[i] : null;
  }, [selected, avatars, positions]);

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
              <p className="text-sm text-red-300">{error}</p>
              <button onClick={retry} className="mt-2 rounded bg-oasis-cyan/20 px-3 py-1 text-xs text-oasis-cyan hover:bg-oasis-cyan/30">
                Retry
              </button>
            </GlassPanel>
          </Html>
        )}

        {avatars.map((avatar, i) => {
          const pos = positions[i] ?? new THREE.Vector3();
          return (
            <AvatarNode
              key={avatar.id}
              avatar={avatar}
              position={pos}
              onSelect={setSelected}
            />
          );
        })}

        {selected && selectedPos && (
          <Html
            transform
            center
            distanceFactor={8}
            position={[selectedPos.x, selectedPos.y + 0.6, selectedPos.z]}
            className="pointer-events-auto"
            style={{ width: 'min(80vw, 320px)' }}
          >
            <GlassPanel>
              <AvatarDetail avatar={selected} onClose={() => setSelected(null)} />
            </GlassPanel>
          </Html>
        )}
      </group>
  );
}

const AvatarNode = memo(function AvatarNode({
  avatar,
  position,
  onSelect,
}: {
  avatar: AvatarDef;
  position: THREE.Vector3;
  onSelect: (a: AvatarDef) => void;
}) {
  return (
    <InteractiveObject
      label={avatar.name}
      onClick={() => onSelect(avatar)}
      hoverScale={1.25}
      position={[position.x, position.y, position.z]}
    >
      <mesh>
        <sphereGeometry args={[0.22, 32, 32]} />
        <meshStandardMaterial
          color="#a855f7"
          emissive="#a855f7"
          emissiveIntensity={0.25}
          roughness={0.3}
          metalness={0.4}
        />
      </mesh>
    </InteractiveObject>
  );
});

function AvatarDetail({ avatar, onClose }: { avatar: AvatarDef; onClose: () => void }) {
  return (
    <div className="space-y-2 text-sm">
      <h3 className="text-lg font-bold text-oasis-cyan">{avatar.name}</h3>
      <p className="text-oasis-gold">{avatar.subtitle}</p>
      <p className="text-gray-300">{avatar.ability}</p>
      <button
        onClick={onClose}
        className="mt-2 rounded-lg bg-oasis-purple/20 px-3 py-1.5 text-xs text-oasis-purple transition hover:bg-oasis-purple/30"
      >
        Close
      </button>
    </div>
  );
}
