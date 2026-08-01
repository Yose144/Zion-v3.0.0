'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRandom } from '../domain/ports/random';

interface Branch {
  start: THREE.Vector3;
  end: THREE.Vector3;
  mid: THREE.Vector3;
  width: number;
  depth: number;
}

function createGlowTexture(color1: string, color2: string, color3: string): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, color1);
  g.addColorStop(0.35, color2);
  g.addColorStop(0.75, color3);
  g.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = g;
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
  gradient.addColorStop(0, 'rgba(255, 250, 230, 1)');
  gradient.addColorStop(0.3, 'rgba(255, 220, 160, 0.5)');
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
  const BASE_WIDTH = 2.6;
  const DECAY = 0.45;
  const MIN_WIDTH = 0.12;

  const width = Math.max(MIN_WIDTH, BASE_WIDTH - depth * DECAY);
  const direction = new THREE.Vector3().subVectors(end, start).normalize();
  const length = start.distanceTo(end);

  const mid = new THREE.Vector3().lerpVectors(start, end, 0.5);
  const bendAxis = new THREE.Vector3(rng.next() - 0.5, rng.next() - 0.5, rng.next() - 0.5).normalize();
  const bend = new THREE.Vector3().crossVectors(direction, bendAxis).normalize().multiplyScalar(length * (rng.next() - 0.5) * 0.22);
  if (bend.lengthSq() < 0.001) bend.set(0, length * 0.1, 0);
  mid.add(bend);
  mid.y += length * 0.06;

  branches.push({ start: start.clone(), end: end.clone(), mid: mid.clone(), width, depth });

  if (depth >= maxDepth) return;

  const childCount = depth < 2 ? 3 : 2;
  const childLength = length * (0.7 + rng.next() * 0.2);

  const up = new THREE.Vector3(0, 1, 0);
  const tangentBase = new THREE.Vector3().crossVectors(direction, up).normalize();
  if (tangentBase.lengthSq() < 0.001) tangentBase.set(1, 0, 0);

  for (let i = 0; i < childCount; i++) {
    const spreadAngle = ((i - (childCount - 1) / 2) / (childCount + 0.5)) * Math.PI * 0.7;
    const tangent = tangentBase.clone().applyAxisAngle(direction, rng.next() * Math.PI * 2);
    const rotation = new THREE.Quaternion().setFromAxisAngle(tangent, spreadAngle + (rng.next() - 0.5) * 0.35);
    const newDirection = direction.clone().applyQuaternion(rotation);
    newDirection.y += 0.22 + rng.next() * 0.12;
    newDirection.normalize();

    const newEnd = end.clone().add(newDirection.multiplyScalar(childLength));
    generateBranches(end, newEnd, depth + 1, maxDepth, branches, rng);
  }
}

function generateRoots(
  start: THREE.Vector3,
  end: THREE.Vector3,
  depth: number,
  maxDepth: number,
  roots: Branch[],
  rng: ReturnType<typeof createRandom>
): void {
  const direction = new THREE.Vector3().subVectors(end, start).normalize();
  const length = start.distanceTo(end);
  const mid = new THREE.Vector3().lerpVectors(start, end, 0.5);
  const bend = new THREE.Vector3((rng.next() - 0.5) * length * 0.4, length * -0.08, (rng.next() - 0.5) * length * 0.4);
  mid.add(bend);

  roots.push({ start: start.clone(), end: end.clone(), mid: mid.clone(), width: Math.max(0.08, 0.7 - depth * 0.2), depth });

  if (depth >= maxDepth) return;

  const childCount = depth === 0 ? 5 : 2;
  const childLength = length * (0.75 + rng.next() * 0.2);

  for (let i = 0; i < childCount; i++) {
    const angle = (i / childCount) * Math.PI * 2 + rng.next() * 0.4;
    const outward = new THREE.Vector3(Math.cos(angle), -0.5 + rng.next() * 0.3, Math.sin(angle)).normalize();
    const newEnd = end.clone().add(outward.multiplyScalar(childLength));
    generateRoots(end, newEnd, depth + 1, maxDepth, roots, rng);
  }
}

interface SporeFieldProps {
  count?: number;
  rng: ReturnType<typeof createRandom>;
}

function SporeField({ count = 700, rng }: SporeFieldProps) {
  const pointsRef = useRef<THREE.Points>(null);

  const { geometry, material, speeds, phases } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [
      new THREE.Color('#22d3ee'),
      new THREE.Color('#a855f7'),
      new THREE.Color('#f59e0b'),
      new THREE.Color('#10b981'),
      new THREE.Color('#ec4899'),
    ];
    const speeds: number[] = [];
    const phases: number[] = [];

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const angle = rng.next() * Math.PI * 2;
      const radius = 0.3 + rng.next() * 4.5;
      const y = (rng.next() - 0.5) * 7;

      positions[i3] = Math.cos(angle) * radius;
      positions[i3 + 1] = y;
      positions[i3 + 2] = Math.sin(angle) * radius;

      const color = palette[rng.int(0, palette.length)];
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;

      speeds.push(0.002 + rng.next() * 0.012);
      phases.push(rng.next() * Math.PI * 2);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.09,
      map: createSporeTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    return { geometry, material, speeds, phases };
  }, [count, rng]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const t = state.clock.elapsedTime * 0.3 + phases[i];

      positions[i3 + 1] += speeds[i] * (1 + Math.abs(positions[i3 + 1]) * 0.08);
      const r = Math.sqrt(positions[i3] ** 2 + positions[i3 + 2] ** 2);
      const outward = 0.002 + r * 0.0006;
      const spiral = Math.sin(t) * 0.003 * r;

      positions[i3] += Math.cos(t * 0.7) * outward + spiral;
      positions[i3 + 2] += Math.sin(t * 0.7) * outward - spiral;

      if (positions[i3 + 1] > 5 || r > 8) {
        positions[i3 + 1] = -4 + rng.next() * 2;
        const angle = rng.next() * Math.PI * 2;
        const radius = 0.3 + rng.next() * 2.5;
        positions[i3] = Math.cos(angle) * radius;
        positions[i3 + 2] = Math.sin(angle) * radius;
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.rotation.y += delta * 0.015;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

function CanopyField({ count = 220, rng }: SporeFieldProps) {
  const pointsRef = useRef<THREE.Points>(null);

  const { geometry, material, offsets } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [
      new THREE.Color('#f59e0b'),
      new THREE.Color('#fbbf24'),
      new THREE.Color('#22d3ee'),
      new THREE.Color('#a855f7'),
    ];
    const offsets: number[] = [];

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const angle = rng.next() * Math.PI * 2;
      const r = 0.4 + rng.next() * 2.2;
      const y = 1.2 + rng.next() * 2.8;
      positions[i3] = Math.cos(angle) * r;
      positions[i3 + 1] = y;
      positions[i3 + 2] = Math.sin(angle) * r;

      const color = palette[rng.int(0, palette.length)];
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
      offsets.push(rng.next() * Math.PI * 2);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.16,
      map: createSporeTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    return { geometry, material, offsets };
  }, [count, rng]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const t = state.clock.elapsedTime * 0.4 + offsets[i];
      positions[i3 + 1] += Math.sin(t) * 0.002;
      positions[i3] += Math.cos(t * 0.6) * 0.002;
      positions[i3 + 2] += Math.sin(t * 0.6) * 0.002;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

function branchCurve(b: Branch): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3([b.start, b.mid, b.end]);
}

export default function TreeOfLife() {
  const groupRef = useRef<THREE.Group>(null);
  const fruitRef = useRef<THREE.InstancedMesh>(null);
  const rng = useMemo(() => createRandom(777), []);

  const {
    branches,
    branchGeometry,
    rootsGeometry,
    fruitData,
    glowTexture,
  } = useMemo(() => {
    const branches: Branch[] = [];
    const root = new THREE.Vector3(0, -3.2, 0);
    const top = new THREE.Vector3(0, 1.6, 0);
    generateBranches(root, top, 0, 5, branches, rng);

    const fruits = branches.filter((b) => b.depth >= 4).map((b) => b.end);

    const branchGeometries = branches.map((b) => {
      const radius = Math.max(0.006, b.width * 0.028);
      return new THREE.TubeGeometry(branchCurve(b), 10, radius, 9, false);
    });

    const branchGeometry = mergeGeometries(branchGeometries);

    const roots: Branch[] = [];
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2 + rng.next() * 0.3;
      const r = 0.8 + rng.next() * 0.5;
      const start = new THREE.Vector3(0, -3.2, 0);
      const end = new THREE.Vector3(Math.cos(angle) * r, -4.8 - rng.next() * 0.8, Math.sin(angle) * r);
      generateRoots(start, end, 0, 2, roots, rng);
    }

    const rootGeometries = roots.map((b) => {
      const radius = Math.max(0.006, b.width * 0.04);
      return new THREE.TubeGeometry(branchCurve(b), 8, radius, 8, false);
    });

    const rootsGeometry = rootGeometries.length > 0 ? mergeGeometries(rootGeometries) : new THREE.BufferGeometry();

    const fruitPalette = [
      '#22d3ee',
      '#10b981',
      '#f59e0b',
      '#ec4899',
      '#a855f7',
      '#fbbf24',
    ];

    const fruitData = fruits.map((pos, i) => {
      const color = new THREE.Color(fruitPalette[i % fruitPalette.length]);
      const scale = 0.06 + rng.next() * 0.05;
      const rot = new THREE.Euler(rng.next() * Math.PI, rng.next() * Math.PI, rng.next() * Math.PI);
      return { pos: pos.clone(), color, scale, rot };
    });

    const glowTexture = createGlowTexture(
      'rgba(255, 250, 220, 0.95)',
      'rgba(168, 85, 247, 0.45)',
      'rgba(34, 211, 238, 0.1)'
    );

    return { branches, branchGeometry, rootsGeometry, fruitData, glowTexture };
  }, [rng]);

  const fruitGeometry = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const fruitMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  );

  useEffect(() => {
    if (!fruitRef.current) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < fruitData.length; i++) {
      const f = fruitData[i];
      dummy.position.copy(f.pos);
      dummy.rotation.copy(f.rot);
      dummy.scale.set(f.scale, f.scale, f.scale);
      dummy.updateMatrix();
      fruitRef.current.setMatrixAt(i, dummy.matrix);
      fruitRef.current.setColorAt(i, f.color);
    }
    fruitRef.current.instanceMatrix.needsUpdate = true;
    if (fruitRef.current.instanceColor) fruitRef.current.instanceColor.needsUpdate = true;
  }, [fruitData]);

  const branchMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0x1a1028,
        emissive: 0x7c3aed,
        emissiveIntensity: 0.55,
        roughness: 0.35,
        metalness: 0.75,
        toneMapped: false,
      }),
    []
  );

  const rootMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0x241535,
        emissive: 0x4c1d95,
        emissiveIntensity: 0.25,
        roughness: 0.7,
        metalness: 0.4,
        toneMapped: false,
      }),
    []
  );

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.04) * 0.03;
    }
    if (fruitRef.current) {
      const dummy = new THREE.Object3D();
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.2) * 0.08;
      for (let i = 0; i < fruitData.length; i++) {
        const f = fruitData[i];
        const beat = 1 + Math.sin(state.clock.elapsedTime * 1.8 + i) * 0.05;
        dummy.position.copy(f.pos);
        dummy.rotation.set(f.rot.x + state.clock.elapsedTime * 0.1, f.rot.y + state.clock.elapsedTime * 0.05, f.rot.z);
        const s = f.scale * pulse * beat;
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        fruitRef.current.setMatrixAt(i, dummy.matrix);
      }
      fruitRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={branchGeometry} material={branchMaterial} castShadow receiveShadow />

      <mesh geometry={rootsGeometry} material={rootMaterial} receiveShadow />

      <instancedMesh ref={fruitRef} args={[fruitGeometry, fruitMaterial, fruitData.length]} castShadow receiveShadow />

      {/* Tree heart — layered luminous core */}
      <mesh position={[0, 0.45, 0]}>
        <sphereGeometry args={[0.55, 64, 64]} />
        <meshBasicMaterial color="#fff7d6" transparent opacity={0.12} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.45, 0]}>
        <sphereGeometry args={[0.28, 64, 64]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.45, 0]}>
        <sphereGeometry args={[0.1, 32, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Wide aura at the heart */}
      <sprite position={[0, 0.45, 0]} scale={[4.2, 4.2, 1]}>
        <spriteMaterial map={glowTexture} transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>

      {/* Crown glow */}
      <sprite position={[0, 2.2, 0]} scale={[2.6, 2.6, 1]}>
        <spriteMaterial map={glowTexture} transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>

      {/* Ground aura */}
      <sprite position={[0, -3.6, 0]} scale={[5, 5, 1]} rotation={[Math.PI / 2, 0, 0]}>
        <spriteMaterial map={glowTexture} transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>

      <SporeField count={900} rng={rng} />
      <CanopyField count={260} rng={rng} />
    </group>
  );
}
