'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createRandom } from '../domain/ports/random';

interface Branch {
  start: THREE.Vector3;
  end: THREE.Vector3;
  width: number;
  depth: number;
}

function createGlowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 240, 180, 1)');
  gradient.addColorStop(0.25, 'rgba(255, 200, 90, 0.6)');
  gradient.addColorStop(0.55, 'rgba(255, 140, 60, 0.2)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createSporeTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 250, 220, 1)');
  gradient.addColorStop(0.35, 'rgba(255, 230, 150, 0.55)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function generateBranches(
  start: THREE.Vector3,
  end: THREE.Vector3,
  depth: number,
  maxDepth: number,
  branches: Branch[],
  rng: ReturnType<typeof createRandom>
): void {
  branches.push({ start: start.clone(), end: end.clone(), width: Math.max(0.35, 3.2 - depth * 0.55), depth });

  if (depth >= maxDepth) return;

  const direction = new THREE.Vector3().subVectors(end, start).normalize();
  const length = start.distanceTo(end) * 0.72;

  const count = 2 + (depth < 2 ? 1 : 0);
  for (let i = 0; i < count; i++) {
    const angleOffset = ((i - (count - 1) / 2) * Math.PI) / (count + 1);
    const upward = new THREE.Vector3(0, 1, 0);
    const axis = new THREE.Vector3().crossVectors(direction, upward).normalize();
    if (axis.lengthSq() < 0.001) axis.set(1, 0, 0);

    const rotation = new THREE.Quaternion().setFromAxisAngle(
      axis,
      angleOffset + (rng.next() - 0.5) * 0.35
    );
    const newDirection = direction.clone().applyQuaternion(rotation);
    newDirection.y += 0.28;
    newDirection.normalize();

    const newEnd = end.clone().add(newDirection.multiplyScalar(length));
    generateBranches(end, newEnd, depth + 1, maxDepth, branches, rng);
  }
}

interface SporeFieldProps {
  count?: number;
  rng: ReturnType<typeof createRandom>;
}

function SporeField({ count = 800, rng }: SporeFieldProps) {
  const pointsRef = useRef<THREE.Points>(null);

  const { geometry, material, speeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [
      new THREE.Color('#fbbf24'),
      new THREE.Color('#f59e0b'),
      new THREE.Color('#fcd34d'),
      new THREE.Color('#f472b6'),
      new THREE.Color('#22d3ee'),
    ];
    const speeds: number[] = [];

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const angle = rng.next() * Math.PI * 2;
      const radius = rng.next() * 4.5 + 0.3;
      const y = (rng.next() - 0.5) * 8;

      positions[i3] = Math.cos(angle) * radius;
      positions[i3 + 1] = y;
      positions[i3 + 2] = Math.sin(angle) * radius;

      const color = palette[rng.int(0, palette.length)];
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;

      speeds.push(0.005 + rng.next() * 0.02);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.12,
      map: createSporeTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    return { geometry, material, speeds };
  }, [count, rng]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // drift upward and slowly outward like golden spores from The Fountain
      positions[i3 + 1] += speeds[i] * (1 + Math.abs(positions[i3 + 1]) * 0.1);
      const r = Math.sqrt(positions[i3] ** 2 + positions[i3 + 2] ** 2);
      const outward = 0.004 + r * 0.001;
      positions[i3] *= 1 + outward;
      positions[i3 + 2] *= 1 + outward;

      // reset if too high or too far
      if (positions[i3 + 1] > 5 || r > 8) {
        positions[i3 + 1] = -4 + rng.next() * 2;
        const angle = rng.next() * Math.PI * 2;
        const radius = 0.3 + rng.next() * 2.5;
        positions[i3] = Math.cos(angle) * radius;
        positions[i3 + 2] = Math.sin(angle) * radius;
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.rotation.y += delta * 0.03;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

export default function TreeOfLife() {
  const groupRef = useRef<THREE.Group>(null);
  const rng = useMemo(() => createRandom(777), []);

  const sceneData = useMemo(() => {
    const branches: Branch[] = [];
    const root = new THREE.Vector3(0, -3, 0);
    const top = new THREE.Vector3(0, 1.8, 0);
    generateBranches(root, top, 0, 5, branches, rng);

    const fruits = branches
      .filter((b) => b.depth >= 3)
      .map((b) => b.end)
      .filter((_, i, arr) => i % Math.max(1, Math.floor(arr.length / 12)) === 0)
      .slice(0, 12);

    const branchGeometries = branches.map((branch) => {
      const curve = new THREE.CatmullRomCurve3([branch.start, branch.end]);
      const radius = Math.max(0.02, branch.width * 0.05);
      return new THREE.TubeGeometry(curve, 8, radius, 8, false);
    });

    const rootGeometries = Array.from({ length: 12 }).map((_, i) => {
      const angle = (i / 12) * Math.PI * 2 + rng.next() * 0.2;
      const r = 0.7 + rng.next() * 0.6;
      const start = new THREE.Vector3(0, -3, 0);
      const end = new THREE.Vector3(Math.cos(angle) * r, -4.6 - rng.next() * 0.8, Math.sin(angle) * r);
      const mid = new THREE.Vector3(
        start.x * 0.4 + end.x * 0.6,
        (start.y + end.y) / 2 + rng.next() * 0.5,
        start.z * 0.4 + end.z * 0.6
      );
      const curve = new THREE.CatmullRomCurve3([start, mid, end]);
      return new THREE.TubeGeometry(curve, 6, 0.04, 6, false);
    });

    const glowTexture = createGlowTexture();

    const leafPalette = ['#10b981', '#22d3ee', '#a855f7', '#ec4899', '#f59e0b', '#fbbf24'];
    const leaves = fruits.flatMap((pos, fruitIdx) => {
      return Array.from({ length: 6 }).map((_, i) => {
        const dir = new THREE.Vector3(rng.next() - 0.5, rng.next() - 0.5, rng.next() - 0.5).normalize();
        const position = pos.clone().add(dir.multiplyScalar(0.25 + rng.next() * 0.15));
        const rotation = new THREE.Euler(rng.next() * Math.PI, rng.next() * Math.PI, rng.next() * Math.PI);
        const color = leafPalette[(fruitIdx + i) % leafPalette.length];
        const scale = 0.08 + rng.next() * 0.07;
        return { position, rotation, color, scale };
      });
    });

    return { branches, fruits, branchGeometries, rootGeometries, glowTexture, leaves };
  }, [rng]);

  const { branches, fruits, branchGeometries, rootGeometries, glowTexture, leaves } = sceneData;

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.06) * 0.04;
    }
  });

  return (
    <group ref={groupRef}>
      {branches.map((branch, i) => (
        <mesh key={i} geometry={branchGeometries[i]} castShadow receiveShadow>
          <meshStandardMaterial
            color="#d4af37"
            emissive="#fbbf24"
            emissiveIntensity={0.9}
            roughness={0.35}
            metalness={0.55}
            toneMapped={false}
          />
        </mesh>
      ))}

      {fruits.map((pos, i) => (
        <mesh key={`fruit-${i}`} position={pos}>
          <sphereGeometry args={[0.13, 24, 24]} />
          <meshStandardMaterial
            color="#fff7d6"
            emissive="#f59e0b"
            emissiveIntensity={1.6}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Tree heart — the luminous core of life */}
      <mesh position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.6, 64, 64]} />
        <meshBasicMaterial color="#fff7d6" transparent opacity={0.15} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Wide golden aura at the heart */}
      <sprite position={[0, 0.6, 0]} scale={[3.6, 3.6, 1]}>
        <spriteMaterial map={glowTexture} transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>

      {/* Top crown glow — where the tree reaches toward the stars */}
      <sprite position={[0, 2.2, 0]} scale={[2.2, 2.2, 1]}>
        <spriteMaterial map={glowTexture} transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>

      {rootGeometries.map((geom, i) => (
        <mesh key={`root-${i}`} geometry={geom}>
          <meshStandardMaterial
            color="#8b5cf6"
            emissive="#7c3aed"
            emissiveIntensity={0.35}
            roughness={0.6}
            metalness={0.2}
            toneMapped={false}
          />
        </mesh>
      ))}

      {leaves.map((leaf, i) => (
        <mesh key={`leaf-${i}`} position={leaf.position} rotation={leaf.rotation} scale={leaf.scale}>
          <planeGeometry args={[1, 1]} />
          <meshStandardMaterial
            color={leaf.color}
            emissive={leaf.color}
            emissiveIntensity={0.5}
            side={THREE.DoubleSide}
            transparent
            opacity={0.9}
          />
        </mesh>
      ))}

      {/* Floating spores — the Fountain / Xibalba seed-light effect */}
      <SporeField count={900} rng={rng} />
    </group>
  );
}
