'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Branch {
  start: THREE.Vector3;
  end: THREE.Vector3;
  width: number;
  depth: number;
}

function generateBranches(
  start: THREE.Vector3,
  end: THREE.Vector3,
  depth: number,
  maxDepth: number,
  branches: Branch[]
): void {
  branches.push({ start: start.clone(), end: end.clone(), width: Math.max(0.5, 3 - depth), depth });

  if (depth >= maxDepth) return;

  const direction = new THREE.Vector3().subVectors(end, start).normalize();
  const length = start.distanceTo(end) * 0.72;

  const count = 2 + (depth < 2 ? 1 : 0);
  for (let i = 0; i < count; i++) {
    const angleOffset = ((i - (count - 1) / 2) * Math.PI) / (count + 1);
    const upward = new THREE.Vector3(0, 1, 0);
    const axis = new THREE.Vector3().crossVectors(direction, upward).normalize();
    if (axis.lengthSq() < 0.001) axis.set(1, 0, 0);

    const rotation = new THREE.Quaternion().setFromAxisAngle(axis, angleOffset + (Math.random() - 0.5) * 0.35);
    const newDirection = direction.clone().applyQuaternion(rotation);
    newDirection.y += 0.25;
    newDirection.normalize();

    const newEnd = end.clone().add(newDirection.multiplyScalar(length));
    generateBranches(end, newEnd, depth + 1, maxDepth, branches);
  }
}

function createGlowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 230, 128, 1)');
  gradient.addColorStop(0.4, 'rgba(255, 180, 60, 0.5)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export default function TreeOfLife() {
  const groupRef = useRef<THREE.Group>(null);

  const sceneData = useMemo(() => {
    const branches: Branch[] = [];
    const root = new THREE.Vector3(0, -2.6, 0);
    const top = new THREE.Vector3(0, 1.5, 0);
    generateBranches(root, top, 0, 4, branches);

    const fruits = branches
      .filter((b) => b.depth >= 2)
      .map((b) => b.end)
      .filter((_, i, arr) => i % Math.max(1, Math.floor(arr.length / 9)) === 0)
      .slice(0, 9);

    const branchGeometries = branches.map((branch) => {
      const curve = new THREE.CatmullRomCurve3([branch.start, branch.end]);
      const radius = Math.max(0.025, branch.width * 0.06);
      return new THREE.TubeGeometry(curve, 6, radius, 8, false);
    });

    const rootGeometries = Array.from({ length: 8 }).map((_, i) => {
      const angle = (i / 8) * Math.PI * 2;
      const r = 0.9;
      const start = new THREE.Vector3(0, -2.6, 0);
      const end = new THREE.Vector3(Math.cos(angle) * r, -3.6, Math.sin(angle) * r);
      const curve = new THREE.CatmullRomCurve3([start, end]);
      return new THREE.TubeGeometry(curve, 4, 0.04, 6, false);
    });

    const glowTexture = createGlowTexture();

    return { branches, fruits, branchGeometries, rootGeometries, glowTexture };
  }, []);

  const { branches, fruits, branchGeometries, rootGeometries, glowTexture } = sceneData;

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.08) * 0.05;
    }
  });

  return (
    <group ref={groupRef}>
      {branches.map((branch, i) => (
        <mesh key={i} geometry={branchGeometries[i]} castShadow receiveShadow>
          <meshStandardMaterial
            color="#d4af37"
            emissive="#f59e0b"
            emissiveIntensity={0.55}
            roughness={0.5}
            metalness={0.4}
            toneMapped={false}
          />
        </mesh>
      ))}

      {fruits.map((pos, i) => (
        <mesh key={`fruit-${i}`} position={pos}>
          <sphereGeometry args={[0.11, 24, 24]} />
          <meshStandardMaterial
            color="#fff7d6"
            emissive="#f59e0b"
            emissiveIntensity={1.2}
            toneMapped={false}
          />
        </mesh>
      ))}

      <mesh position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.55, 48, 48]} />
        <meshBasicMaterial color="#fff7d6" transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      <sprite position={[0, 0.6, 0]} scale={[2.8, 2.8, 1]}>
        <spriteMaterial map={glowTexture} transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>

      {rootGeometries.map((geom, i) => (
        <mesh key={`root-${i}`} geometry={geom}>
          <meshStandardMaterial
            color="#8b5cf6"
            emissive="#7c3aed"
            emissiveIntensity={0.4}
            roughness={0.6}
            metalness={0.2}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
