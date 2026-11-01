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

interface MarkersProps {
  markers: SceneMarker[];
  onSelect?: (id: string) => void;
}

export function Markers({ markers, onSelect }: MarkersProps) {
  return (
    <group>
      {markers.map((marker, index) => (
        <Marker key={marker.id} marker={marker} phase={index * 1.7} onSelect={onSelect} />
      ))}
    </group>
  );
}

function Marker({
  marker,
  phase,
  onSelect,
}: {
  marker: SceneMarker;
  phase: number;
  onSelect?: (id: string) => void;
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
    group.current.position.y = marker.y + Math.sin(t * 0.9 + phase) * 0.045;
    scratch.setScalar(hovered ? 1.32 : 1);
    group.current.scale.lerp(scratch, 0.18);
  });

  return (
    <group ref={group} position={[marker.x, marker.y, marker.z]}>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelect?.(marker.id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = '';
        }}
      >
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
