'use client';

/**
 * Markery portálů ve scéně.
 *
 * Data přicházejí z Portal Contractu (`manifest.ring` → `SceneMarker`).
 * Svět je tak doslova generovaný registry portálů: nový portál s `ring`
 * souřadnicemi se objeví ve scéně bez zásahu do rendereru.
 */
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { SceneMarker } from '@zion/world';
import type { SceneHover } from './OrbitScene';

/** Jak daleko může pointer ujet mezi down a up, aby to pořád byl klik (ne orbit drag). */
const CLICK_TOLERANCE = 6;

interface MarkersProps {
  markers: SceneMarker[];
  onSelect?: (id: string) => void;
  onHover?: (target: SceneHover | null) => void;
  idle?: boolean;
}

export function Markers({ markers, onSelect, onHover, idle = true }: MarkersProps) {
  return (
    <group>
      {markers.map((marker, index) => (
        <Marker
          key={marker.id}
          marker={marker}
          phase={index * 1.7}
          onSelect={onSelect}
          onHover={onHover}
          idle={idle}
        />
      ))}
    </group>
  );
}

function Marker({
  marker,
  phase,
  onSelect,
  onHover,
  idle,
}: {
  marker: SceneMarker;
  phase: number;
  onSelect?: (id: string) => void;
  onHover?: (target: SceneHover | null) => void;
  idle: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const scratch = useMemo(() => new THREE.Vector3(), []);

  const color = useMemo(
    () => new THREE.Color().setHSL((marker.hue % 360) / 360, 0.72, 0.66),
    [marker.hue],
  );

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.position.y = marker.y + (idle ? Math.sin(t * 0.9 + phase) * 0.045 : 0);
    scratch.setScalar(hovered ? 1.32 : 1);
    group.current.scale.lerp(scratch, 0.18);
  });

  return (
    <group ref={group} position={[marker.x, marker.y, marker.z]}>
      {/* neviditelná hit sféra — torus samotný je na ťuk malý */}
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          if (event.delta <= CLICK_TOLERANCE) onSelect?.(marker.id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
          onHover?.(marker);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          onHover?.(null);
          document.body.style.cursor = '';
        }}
      >
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <mesh>
        <torusGeometry args={[0.11, 0.012, 8, 48]} />
        <meshBasicMaterial color={color} transparent opacity={marker.live ? 0.95 : 0.4} />
      </mesh>

      <mesh>
        <sphereGeometry args={[0.032, 12, 12]} />
        <meshBasicMaterial color={color} transparent opacity={marker.live ? 1 : 0.5} />
      </mesh>

      <pointLight color={color} intensity={hovered ? 1.1 : 0.55} distance={1.5} />
    </group>
  );
}
