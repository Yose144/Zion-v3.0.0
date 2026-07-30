'use client';

import { useEffect, useMemo, useState } from 'react';
import { Html, RoundedBox } from '@react-three/drei';
import { getQuests, type QuestDef } from '@/lib/api';
import InteractiveObject from '@/components/InteractiveObject';
import GlassPanel from '@/components/GlassPanel';
import { getZonePosition } from '@/lib/zones';
import * as THREE from 'three';

const zonePos = getZonePosition('quests');

export default function QuestsScene() {
  const [quests, setQuests] = useState<QuestDef[]>([]);
  const [selected, setSelected] = useState<QuestDef | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getQuests().then((data) => {
      if (mounted) setQuests(data ?? []);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const positions = useMemo(() => {
    return quests.map((_, i) => {
      const t = i / Math.max(1, quests.length - 1);
      const a = t * Math.PI * 2 + i * 0.4;
      const r = 1.4 + (i % 3) * 0.4;
      return new THREE.Vector3(Math.cos(a) * r, 0.6 + Math.sin(i) * 0.3, Math.sin(a) * r);
    });
  }, [quests]);

  const selectedPos = useMemo(() => {
    if (!selected) return null;
    const i = quests.findIndex((q) => q.quest_id === selected.quest_id);
    return i >= 0 ? positions[i] : null;
  }, [selected, quests, positions]);

  return (
    <group position={zonePos}>
      {loading && (
        <mesh position={[0, 1, 0]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.4} />
        </mesh>
      )}
      {quests.map((quest, i) => {
        const pos = positions[i] ?? new THREE.Vector3();
        return (
          <InteractiveObject
            key={quest.quest_id}
            label={quest.title}
            onClick={() => setSelected(quest)}
            hoverScale={1.18}
            position={[pos.x, pos.y, pos.z]}
          >
            <RoundedBox args={[0.6, 0.12, 0.18]} radius={0.04} smoothness={4}>
              <meshStandardMaterial
                color="#f59e0b"
                emissive="#f59e0b"
                emissiveIntensity={0.25}
                roughness={0.4}
                metalness={0.3}
              />
            </RoundedBox>
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
              <h3 className="text-lg font-bold text-oasis-cyan">{selected.title}</h3>
              <p className="text-gray-300">{selected.description}</p>
              <p className="text-oasis-gold">{selected.xp_reward} XP · {selected.avatar_name}</p>
              <button
                onClick={() => setSelected(null)}
                className="mt-2 rounded-lg bg-oasis-gold/20 px-3 py-1.5 text-xs text-oasis-gold transition hover:bg-oasis-gold/30"
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
