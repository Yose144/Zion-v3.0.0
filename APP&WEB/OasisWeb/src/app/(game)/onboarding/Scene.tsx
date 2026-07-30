'use client';

import { useMemo, useState } from 'react';
import { Html } from '@react-three/drei';
import { chapters } from '@/lib/onboarding';
import { getZonePosition } from '@/lib/zones';
import InteractiveObject from '@/components/InteractiveObject';
import GlassPanel from '@/components/GlassPanel';
import * as THREE from 'three';

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
          <InteractiveObject
            key={i}
            label={chapter.title}
            onClick={() => setIdx(i)}
            hoverScale={1.2}
            position={[pos.x, pos.y, pos.z]}
          >
            <mesh>
              <sphereGeometry args={[0.15, 24, 24]} />
              <meshStandardMaterial
                color="#ffffff"
                emissive={idx === i ? '#a855f7' : '#ffffff'}
                emissiveIntensity={idx === i ? 0.45 : 0.2}
                roughness={0.3}
              />
            </mesh>
          </InteractiveObject>
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
