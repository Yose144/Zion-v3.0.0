'use client';

import { useMemo, useState, memo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { chapters } from '@/lib/onboarding';
import { getZonePosition } from '@/lib/zones';
import InteractiveObject from '@/components/InteractiveObject';
import GlassPanel from '@/components/GlassPanel';

const zonePos = getZonePosition('onboarding');

export default function OnboardingScene() {
  const [idx, setIdx] = useState(0);

  const positions = useMemo(() => {
    return chapters.map((_, i) => {
      const t = i / Math.max(1, chapters.length - 1);
      const a = t * Math.PI;
      const r = 1.2 + t * 2;
      return new THREE.Vector3(Math.cos(a) * r, 0.1 + t * 0.6, Math.sin(a) * r);
    });
  }, []);

  return (
      <group position={zonePos}>
        {chapters.map((chapter, i) => {
          const pos = positions[i] ?? new THREE.Vector3();
          return (
            <OnboardingNode
              key={i}
              index={i}
              title={chapter.title}
              active={idx === i}
              position={pos}
              onSelect={setIdx}
            />
          );
        })}

        <Html
          transform
          center
          distanceFactor={8}
          position={[
            (positions[idx]?.x ?? 0),
            (positions[idx]?.y ?? 0) + 0.6,
            (positions[idx]?.z ?? 0),
          ]}
          className="pointer-events-auto"
          style={{ width: 'min(80vw, 320px)' }}
        >
          <GlassPanel>
            <div className="space-y-2 text-sm">
              <h3 className="text-lg font-bold text-oasis-cyan">{chapters[idx].title}</h3>
              {chapters[idx].quote && <p className="italic text-oasis-gold">{chapters[idx].quote}</p>}
              <p className="line-clamp-4 text-gray-300">{chapters[idx].paragraphs[0]}</p>
            </div>
          </GlassPanel>
        </Html>
      </group>
  );
}

const OnboardingNode = memo(function OnboardingNode({
  index,
  title,
  active,
  position,
  onSelect,
}: {
  index: number;
  title: string;
  active: boolean;
  position: THREE.Vector3;
  onSelect: (i: number) => void;
}) {
  return (
    <InteractiveObject
      label={title}
      onClick={() => onSelect(index)}
      hoverScale={1.2}
      position={[position.x, position.y, position.z]}
    >
      <mesh>
        <sphereGeometry args={[0.15, 24, 24]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={active ? '#a855f7' : '#ffffff'}
          emissiveIntensity={active ? 0.45 : 0.2}
          roughness={0.3}
        />
      </mesh>
    </InteractiveObject>
  );
});
