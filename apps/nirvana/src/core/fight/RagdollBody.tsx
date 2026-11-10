'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type { AvatarLook } from '../avatars/kit';
import { P, POINT_RADIUS, RENDER_SEGMENTS, bodyCenterOf, type RagdollFighter } from './ragdoll';

/**
 * Loutka z primitiv — čte pózu přímo z `RagdollFighter` (sólo i online),
 * takže nevzniká žádný druhý herní stav. Segmenty jsou válce mezi body
 * (`RENDER_SEGMENTS`), hlava a klouby koule. Dohromady ~15 draw callů.
 */
export function RagdollBody({
  state,
  look,
}: {
  state: MutableRefObject<RagdollFighter>;
  look: AvatarLook;
}) {
  const segments = useRef<(THREE.Mesh | null)[]>([]);
  const head = useRef<THREE.Mesh>(null);
  const joints = useRef<(THREE.Mesh | null)[]>([]);
  const shield = useRef<THREE.Mesh>(null);
  const flash = useRef<THREE.Mesh>(null);
  const flashMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const shadowMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const previousHp = useRef<number | null>(null);
  const flashLeft = useRef(0);

  const colors = useMemo(
    () => ({
      robe: new THREE.Color(look.palette.robe),
      trim: new THREE.Color(look.palette.trim),
      glow: new THREE.Color(look.palette.glow),
    }),
    [look.palette],
  );

  const geometry = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 10), []);
  const sphere = useMemo(() => new THREE.SphereGeometry(1, 12, 10), []);

  useFrame((_, delta) => {
    const f = state.current;

    if (previousHp.current !== null && f.hp < previousHp.current) flashLeft.current = 0.2;
    previousHp.current = f.hp;
    flashLeft.current = Math.max(0, flashLeft.current - delta);

    for (let i = 0; i < RENDER_SEGMENTS.length; i++) {
      const segment = RENDER_SEGMENTS[i]!;
      const mesh = segments.current[i];
      if (!mesh) continue;
      const ax = f.x[segment.a]!;
      const ay = f.y[segment.a]!;
      const bx = f.x[segment.b]!;
      const by = f.y[segment.b]!;
      const dx = bx - ax;
      const dy = by - ay;
      const length = Math.hypot(dx, dy) || 1e-6;
      mesh.position.set((ax + bx) / 2, (ay + by) / 2, 0);
      mesh.rotation.z = Math.atan2(-dx, dy);
      mesh.scale.set(segment.radius, length + segment.radius * 0.4, segment.radius);
    }

    if (head.current) {
      head.current.position.set(f.x[P.HEAD]!, f.y[P.HEAD]!, 0);
      head.current.scale.setScalar(POINT_RADIUS[P.HEAD]!);
    }

    const jointIndexes = [P.ELBOW_L, P.ELBOW_R, P.KNEE_L, P.KNEE_R, P.HAND_L, P.HAND_R, P.FOOT_L, P.FOOT_R];
    for (let i = 0; i < jointIndexes.length; i++) {
      const mesh = joints.current[i];
      if (!mesh) continue;
      const index = jointIndexes[i]!;
      mesh.position.set(f.x[index]!, f.y[index]!, 0);
      mesh.scale.setScalar(POINT_RADIUS[index]! * 0.95);
    }

    if (shield.current) {
      shield.current.visible = f.guard && !f.ko;
      shield.current.position.set(f.x[P.CHEST]!, f.y[P.CHEST]! + 0.05, 0.13);
      shield.current.rotation.z = Math.sin(performance.now() / 260) * 0.06;
    }

    if (flash.current && flashMaterial.current) {
      const active = flashLeft.current > 0 && !f.ko;
      flash.current.visible = active;
      flashMaterial.current.opacity = active ? (flashLeft.current / 0.2) * 0.7 : 0;
      flash.current.position.set(f.x[P.CHEST]!, f.y[P.CHEST]!, 0.2);
      const scale = active ? 1 + (0.2 - flashLeft.current) * 2.2 : 1;
      flash.current.scale.setScalar(scale);
    }

    // kontaktní stín — drží loutku na zemi (bez shadow mapy)
    if (shadow.current && shadowMaterial.current) {
      const center = bodyCenterOf(f);
      const airborne = Math.min(1, Math.max(0, (center.y - 1.1) / 1.8));
      shadow.current.position.set(center.x, 0.016, 0);
      shadow.current.scale.setScalar(1 - airborne * 0.45);
      shadowMaterial.current.opacity = 0.3 * (1 - airborne * 0.6);
    }
  });

  return (
    <group>
      {/* kontaktní stín */}
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.016, 0]}>
        <circleGeometry args={[0.62, 20]} />
        <meshBasicMaterial ref={shadowMaterial} color="#1a0d08" transparent opacity={0.3} depthWrite={false} />
      </mesh>

      {RENDER_SEGMENTS.map((segment, index) => (
        <mesh
          key={`${segment.a}-${segment.b}`}
          ref={(node) => {
            segments.current[index] = node;
          }}
          geometry={geometry}
        >
          <meshStandardMaterial
            color={segment.kind === 'torso' ? colors.robe : colors.trim}
            roughness={segment.kind === 'torso' ? 0.82 : 0.9}
            emissive={segment.kind === 'torso' ? colors.glow : '#000000'}
            emissiveIntensity={segment.kind === 'torso' ? 0.08 : 0}
          />
        </mesh>
      ))}

      <mesh ref={head} geometry={sphere}>
        <meshStandardMaterial color={colors.trim} roughness={0.7} emissive={colors.glow} emissiveIntensity={0.06} />
      </mesh>

      {[P.ELBOW_L, P.ELBOW_R, P.KNEE_L, P.KNEE_R, P.HAND_L, P.HAND_R, P.FOOT_L, P.FOOT_R].map((index, slot) => (
        <mesh
          key={index}
          ref={(node) => {
            joints.current[slot] = node;
          }}
          geometry={sphere}
        >
          <meshStandardMaterial color={colors.trim} roughness={0.75} metalness={0.1} />
        </mesh>
      ))}

      {/* kryt — světelná deska před hrudníkem */}
      <mesh ref={shield} visible={false}>
        <ringGeometry args={[0.28, 0.52, 22, 1, 0, Math.PI * 2]} />
        <meshBasicMaterial
          color={colors.glow}
          transparent
          opacity={0.26}
          side={THREE.DoubleSide}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      {/* záblesk zásahu */}
      <mesh ref={flash} visible={false}>
        <ringGeometry args={[0.18, 0.46, 18]} />
        <meshBasicMaterial
          ref={flashMaterial}
          color={colors.glow}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
