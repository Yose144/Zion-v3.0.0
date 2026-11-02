'use client';

/**
 * NavHalo — jednotný hover indikátor pro **všechny** odkazy ve vesmíru.
 *
 * Když uživatel najede na planetu, Slunce, svět L4/L6, L5 misii, Měsíc,
 * flotilu, archu, bránu nebo stanici, objeví se stejný kruh (dvojitý prstenec)
 * v barvě daného cíle. To je jediný signál „tady se dá kliknout / je to
 * hyperlink na další svět“ — žádný název pod ním, jméno ukáže až panel.
 *
 * Komponenta je záměrně bez stavu: `active` řídí rodič (hover), barvu dodá
 * akcent cíle. Prstenec je billboard (otočený ke kameře), aby fungoval
 * z jakéhokoli úhlu; aditivní blend ho drží čitelný na tmavém pozadí.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function NavHalo({
  active,
  color = '#a6c8ff',
  radius = 1,
  thickness = 0.04,
  position,
}: {
  active: boolean;
  color?: string;
  /** Poloměr vnitřního prstence ve světových jednotkách. */
  radius?: number;
  thickness?: number;
  position?: [number, number, number];
}) {
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.MeshBasicMaterial>(null);
  const outer = useRef<THREE.MeshBasicMaterial>(null);
  const scale = useRef(0.001);
  const shown = useRef(0);

  useFrame(({ camera }, delta) => {
    const g = group.current;
    if (!g) return;
    // jemný náběh/zmizení, ať to nebliká
    scale.current += ((active ? 1 : 0) - scale.current) * Math.min(1, delta * 10);
    shown.current = Math.min(1, Math.max(0, scale.current));
    if (shown.current <= 0.001) {
      g.visible = false;
      return;
    }
    g.visible = true;
    g.scale.setScalar(0.9 + shown.current * 0.12);
    // billboard — prstenec vždy čelem ke kameře
    g.quaternion.copy(camera.quaternion);
    if (inner.current) inner.current.opacity = 0.9 * shown.current;
    if (outer.current) outer.current.opacity = 0.42 * shown.current;
  });

  return (
    <group ref={group} position={position} visible={false}>
      <mesh>
        <ringGeometry args={[radius, radius + thickness, 64]} />
        <meshBasicMaterial
          ref={inner}
          color={color}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh>
        <ringGeometry args={[radius * 1.16, radius * 1.16 + thickness * 0.5, 64]} />
        <meshBasicMaterial
          ref={outer}
          color={color}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
