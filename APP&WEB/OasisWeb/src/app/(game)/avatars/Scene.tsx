'use client';

import { useEffect, useMemo, useState } from 'react';
import { Html } from '@react-three/drei';
import { getAvatars, type AvatarDef } from '@/lib/api';
import InteractiveObject from '@/components/InteractiveObject';
import GlassPanel from '@/components/GlassPanel';
import { getZonePosition } from '@/lib/zones';
import * as THREE from 'three';

const zonePos = getZonePosition('avatars');

export default function AvatarsScene() {
  const [avatars, setAvatars] = useState<AvatarDef[]>([]);
  const [selected, setSelected] = useState<AvatarDef | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getAvatars().then((data) => {
      if (mounted) setAvatars(data ?? []);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

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
        <mesh position={[0, 1, 0]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color="#a855f7" emissive="#a855f7" emissiveIntensity={0.4} />
        </mesh>
      )}
      {avatars.map((avatar, i) => {
        const pos = positions[i] ?? new THREE.Vector3();
        return (
          <InteractiveObject
            key={avatar.id}
            label={avatar.name}
            onClick={() => setSelected(avatar)}
            hoverScale={1.25}
            position={[pos.x, pos.y, pos.z]}
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
            <div className="space-y-2 text-sm">
              <h3 className="text-lg font-bold text-oasis-cyan">{selected.name}</h3>
              <p className="text-oasis-gold">{selected.subtitle}</p>
              <p className="text-gray-300">{selected.ability}</p>
              <button
                onClick={() => setSelected(null)}
                className="mt-2 rounded-lg bg-oasis-purple/20 px-3 py-1.5 text-xs text-oasis-purple transition hover:bg-oasis-purple/30"
              >
                Close
              </button>
            </div>
          </GlassPanel>
        </Html>
      )}
    </group>
  );
}
