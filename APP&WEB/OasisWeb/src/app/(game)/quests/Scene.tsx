'use client';

import { useMemo, useState, memo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { getQuests, type QuestDef } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { getZonePosition } from '@/lib/zones';
import InteractiveObject from '@/components/InteractiveObject';
import GlassPanel from '@/components/GlassPanel';
import Skeleton from '@/components/Skeleton';

const zonePos = getZonePosition('quests');

export default function QuestsScene() {
  const { data, loading, error, retry } = useApi(getQuests, []);
  const quests = data ?? [];
  const [selected, setSelected] = useState<QuestDef | null>(null);

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

        {quests.map((quest, i) => {
          const pos = positions[i] ?? new THREE.Vector3();
          return (
            <QuestNode key={quest.quest_id} quest={quest} position={pos} onSelect={setSelected} />
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
              <QuestDetail quest={selected} onClose={() => setSelected(null)} />
            </GlassPanel>
          </Html>
        )}
      </group>
  );
}

const QuestNode = memo(function QuestNode({
  quest,
  position,
  onSelect,
}: {
  quest: QuestDef;
  position: THREE.Vector3;
  onSelect: (q: QuestDef) => void;
}) {
  return (
    <InteractiveObject
      label={quest.title}
      onClick={() => onSelect(quest)}
      hoverScale={1.18}
      position={[position.x, position.y, position.z]}
    >
      <mesh>
        <boxGeometry args={[0.6, 0.12, 0.18]} />
        <meshStandardMaterial
          color="#fcd116"
          emissive="#fcd116"
          emissiveIntensity={0.25}
          roughness={0.4}
          metalness={0.3}
        />
      </mesh>
    </InteractiveObject>
  );
});

function QuestDetail({ quest, onClose }: { quest: QuestDef; onClose: () => void }) {
  return (
    <div className="space-y-2 text-sm">
      <h3 className="text-lg font-bold text-oasis-cyan">{quest.title}</h3>
      <p className="text-white/80">{quest.description}</p>
      <p className="text-oasis-gold">{quest.xp_reward} XP · {quest.avatar_name}</p>
      <button
        onClick={onClose}
        className="mt-2 rounded-lg bg-oasis-gold/20 px-3 py-1.5 text-xs text-oasis-gold transition hover:bg-oasis-gold/30"
      >
        Close
      </button>
    </div>
  );
}
