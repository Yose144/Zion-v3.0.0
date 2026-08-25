'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRandom } from '../domain/ports/random';
import { useGameStore } from '../store/gameStore';

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
  gradient.addColorStop(0, 'rgba(252, 209, 22, 1)');
  gradient.addColorStop(0.3, 'rgba(252, 209, 22, 0.5)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createStreakTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const g = ctx.createLinearGradient(size / 2, 0, size / 2, size);
  g.addColorStop(0, 'rgba(255, 255, 255, 0)');
  g.addColorStop(0.4, 'rgba(252, 209, 22, 0.7)');
  g.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.6, 'rgba(252, 209, 22, 0.7)');
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = g;
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
  const BASE_WIDTH = 2.4;
  const DECAY = 0.4;
  const MIN_WIDTH = 0.18;

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

  // More splits at the base/scaffold levels (depth < 2) for a visibly
  // fuller, richer branch structure — like the reference logo's dense fan
  // of limbs — while keeping deeper twig levels at 2 to avoid an explosion
  // in geometry/leaf count.
  const childCount = depth < 2 ? 5 : 2;
  const childLength = length * (0.78 + rng.next() * 0.22);

  const up = new THREE.Vector3(0, 1, 0);
  const tangentBase = new THREE.Vector3().crossVectors(direction, up).normalize();
  if (tangentBase.lengthSq() < 0.001) tangentBase.set(1, 0, 0);

  for (let i = 0; i < childCount; i++) {
    // Wide spread angle + a much smaller upward bias than before — branches
    // fan outward more than they climb, producing a broad, flat-topped
    // umbrella canopy (like a real oak) rather than a tall narrow spire.
    const spreadAngle = ((i - (childCount - 1) / 2) / (childCount + 0.5)) * Math.PI * 1.15;
    const tangent = tangentBase.clone().applyAxisAngle(direction, rng.next() * Math.PI * 2);
    const rotation = new THREE.Quaternion().setFromAxisAngle(tangent, spreadAngle + (rng.next() - 0.5) * 0.4);
    const newDirection = direction.clone().applyQuaternion(rotation);
    newDirection.y += 0.08 + rng.next() * 0.08;
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

  const childCount = depth === 0 ? 6 : 2;
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

function SporeField({ count = 350, rng }: SporeFieldProps) {
  const pointsRef = useRef<THREE.Points>(null);

  const { geometry, material, speeds, phases } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [
      new THREE.Color('#078930'),
      new THREE.Color('#fcd116'),
      new THREE.Color('#e41e2b'),
      new THREE.Color('#078930'),
      new THREE.Color('#fcd116'),
      new THREE.Color('#e41e2b'),
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
      size: 0.11,
      map: createSporeTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
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

interface LeafAnchor {
  end: THREE.Vector3;
  dir: THREE.Vector3;
}

interface LeafCanopyProps {
  anchors: LeafAnchor[];
  leavesPerAnchor?: number;
  rng: ReturnType<typeof createRandom>;
}

// Rasta canopy: green, gold, red with occasional black/earth base.
const LEAF_PALETTE = ['#078930', '#fcd116', '#e41e2b', '#078930', '#fcd116', '#1a1a1a'];

function LeafCanopy({ anchors, leavesPerAnchor = 3, rng }: LeafCanopyProps) {
  const lineRef = useRef<THREE.LineSegments>(null);
  const vRef = useRef(new THREE.Vector3());

  const leafData = useMemo(() => {
    const palette = LEAF_PALETTE.map((c) => new THREE.Color(c));
    const point = new THREE.Vector3();
    const positions: number[] = [];
    const leaves: {
      baseIndex: number;
      pairs: number;
      color: THREE.Color;
      pos: THREE.Vector3;
      perp: THREE.Vector3;
      dir: THREE.Vector3;
      normal: THREE.Vector3;
      phase: number;
      speed: number;
      amp: number;
      srcX: Float32Array;
      srcY: Float32Array;
      srcW: Float32Array;
      pairMap: number[];
    }[] = [];

    for (const anchor of anchors) {
      for (let i = 0; i < leavesPerAnchor; i++) {
        const spread = 0.25 + rng.next() * 0.5;
        const along = 0.05 + rng.next() * 0.35;
        const jitter = new THREE.Vector3(
          (rng.next() - 0.5) * spread,
          (rng.next() - 0.5) * spread * 0.6,
          (rng.next() - 0.5) * spread
        );
        const pos = anchor.end.clone().addScaledVector(anchor.dir, along).add(jitter);

        const dir = anchor.dir.clone().normalize();
        const spreadQuat = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(
            (rng.next() - 0.5) * 1.0,
            (rng.next() - 0.5) * 1.0,
            rng.next() * Math.PI
          )
        );
        dir.applyQuaternion(spreadQuat);

        // Local X axis (width) is perpendicular to dir.
        const perp = new THREE.Vector3(rng.next() - 0.5, rng.next() - 0.5, rng.next() - 0.5)
          .normalize()
          .cross(dir)
          .normalize();
        if (perp.lengthSq() < 0.001) perp.set(1, 0, 0);
        const normal = new THREE.Vector3().crossVectors(perp, dir).normalize();

        // Leaf outline shape in the local x-y plane; the 4th dimension (w)
        // is extruded along the normal axis, then projected back to 3D.
        const edgeCount = rng.int(3, 6); // 3, 4 or 5 segments
        const length = 0.45 + rng.next() * 0.55;
        const width = length * (0.32 + rng.next() * 0.22);
        const localPoints: { x: number; y: number }[] = [];

        if (edgeCount === 3) {
          // Triangle leaf.
          localPoints.push({ x: 0, y: -length * 0.2 });
          localPoints.push({ x: -width * 0.85, y: length * 0.5 });
          localPoints.push({ x: 0, y: length });
        } else if (edgeCount === 4) {
          // Diamond leaf.
          localPoints.push({ x: 0, y: -length * 0.2 });
          localPoints.push({ x: -width, y: length * 0.45 });
          localPoints.push({ x: 0, y: length });
          localPoints.push({ x: width, y: length * 0.45 });
        } else {
          // Stem + diamond leaf.
          localPoints.push({ x: 0, y: -length * 0.4 });
          localPoints.push({ x: 0, y: 0 });
          localPoints.push({ x: -width, y: length * 0.5 });
          localPoints.push({ x: 0, y: length });
          localPoints.push({ x: width, y: length * 0.5 });
        }

        const depth = 0.12 + rng.next() * 0.12;
        const vertexCount = edgeCount * 2;
        const srcX = new Float32Array(vertexCount);
        const srcY = new Float32Array(vertexCount);
        const srcW = new Float32Array(vertexCount);

        for (let v = 0; v < edgeCount; v++) {
          srcX[v] = localPoints[v].x;
          srcY[v] = localPoints[v].y;
          srcW[v] = -depth;
          srcX[v + edgeCount] = localPoints[v].x;
          srcY[v + edgeCount] = localPoints[v].y;
          srcW[v + edgeCount] = depth;
        }

        const next = (e: number) => (edgeCount === 5 && e === edgeCount - 1 ? 1 : (e + 1) % edgeCount);
        const pairMap: number[] = [];
        for (let e = 0; e < edgeCount; e++) {
          const a = e;
          const b = next(e);
          // front and back outline edges
          pairMap.push(a, b);
          pairMap.push(a + edgeCount, b + edgeCount);
          // extrusion edges connecting the two w-layers
          pairMap.push(a, a + edgeCount);
        }
        const pairs = pairMap.length / 2;

        // Initial 3D projection with zero 4D rotation.
        const baseIndex = positions.length;
        for (let e = 0; e < pairs; e++) {
          const ai = pairMap[e * 2];
          const bi = pairMap[e * 2 + 1];
          point.copy(pos)
            .addScaledVector(perp, srcX[ai])
            .addScaledVector(dir, srcY[ai])
            .addScaledVector(normal, srcW[ai]);
          positions.push(point.x, point.y, point.z);
          point.copy(pos)
            .addScaledVector(perp, srcX[bi])
            .addScaledVector(dir, srcY[bi])
            .addScaledVector(normal, srcW[bi]);
          positions.push(point.x, point.y, point.z);
        }

        leaves.push({
          baseIndex,
          pairs,
          color: palette[rng.int(0, palette.length)],
          pos,
          perp,
          dir,
          normal,
          phase: rng.next() * Math.PI * 2,
          speed: 0.35 + rng.next() * 0.45,
          amp: 0.6 + rng.next() * 0.9,
          srcX,
          srcY,
          srcW,
          pairMap,
        });
      }
    }

    return { leaves, positions: new Float32Array(positions) };
  }, [anchors, leavesPerAnchor, rng]);

  const { geometry, material } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(leafData.positions, 3));

    const colors = new Float32Array(leafData.positions.length);
    for (const leaf of leafData.leaves) {
      const c = leaf.color;
      for (let p = 0; p < leaf.pairs; p++) {
        const i = leaf.baseIndex + p * 6;
        colors[i] = colors[i + 3] = c.r;
        colors[i + 1] = colors[i + 4] = c.g;
        colors[i + 2] = colors[i + 5] = c.b;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    return { geometry: geo, material: mat };
  }, [leafData]);

  useFrame((state) => {
    if (!lineRef.current) return;
    const positions = lineRef.current.geometry.attributes.position.array as Float32Array;
    const v = vRef.current;
    const t = state.clock.elapsedTime;

    for (const leaf of leafData.leaves) {
      // Two 4D rotations (x-w and y-w), then orthographic projection
      // where the 4th coordinate becomes the 3rd spatial axis (normal).
      const ax = Math.sin(t * leaf.speed + leaf.phase) * 0.22 * leaf.amp;
      const ay = Math.cos(t * leaf.speed * 0.7 + leaf.phase) * 0.16 * leaf.amp;
      const cx = Math.cos(ax);
      const sx = Math.sin(ax);
      const cy = Math.cos(ay);
      const sy = Math.sin(ay);

      for (let e = 0; e < leaf.pairs; e++) {
        const ai = leaf.pairMap[e * 2];
        const bi = leaf.pairMap[e * 2 + 1];

        // endpoint a
        let x = leaf.srcX[ai];
        let y = leaf.srcY[ai];
        let w = leaf.srcW[ai];
        let x1 = x * cx - w * sx;
        let w1 = x * sx + w * cx;
        let y2 = y * cy - w1 * sy;
        let w2 = y * sy + w1 * cy;
        v.copy(leaf.pos)
          .addScaledVector(leaf.perp, x1)
          .addScaledVector(leaf.dir, y2)
          .addScaledVector(leaf.normal, w2);
        positions[leaf.baseIndex + e * 6] = v.x;
        positions[leaf.baseIndex + e * 6 + 1] = v.y;
        positions[leaf.baseIndex + e * 6 + 2] = v.z;

        // endpoint b
        x = leaf.srcX[bi];
        y = leaf.srcY[bi];
        w = leaf.srcW[bi];
        x1 = x * cx - w * sx;
        w1 = x * sx + w * cx;
        y2 = y * cy - w1 * sy;
        w2 = y * sy + w1 * cy;
        v.copy(leaf.pos)
          .addScaledVector(leaf.perp, x1)
          .addScaledVector(leaf.dir, y2)
          .addScaledVector(leaf.normal, w2);
        positions[leaf.baseIndex + e * 6 + 3] = v.x;
        positions[leaf.baseIndex + e * 6 + 4] = v.y;
        positions[leaf.baseIndex + e * 6 + 5] = v.z;
      }
    }

    lineRef.current.geometry.attributes.position.needsUpdate = true;
  });

  if (leafData.leaves.length === 0) return null;
  return <lineSegments ref={lineRef} geometry={geometry} material={material} frustumCulled={false} />;
}

/* ── Princess Mononoke kodama spirits perched on branches ── */
interface KodamaFieldProps {
  anchors: LeafAnchor[];
  count?: number;
  rng: ReturnType<typeof createRandom>;
}

function KodamaField({ anchors, count = 6, rng }: KodamaFieldProps) {
  const groupRef = useRef<THREE.Group>(null);
  const figureRefs = useRef<THREE.Group[]>([]);

  const kodamas = useMemo(() => {
    const figures: {
      pos: THREE.Vector3;
      dir: THREE.Vector3;
      rot: THREE.Euler;
      phase: number;
      headSpeed: number;
      scale: number;
    }[] = [];
    for (let i = 0; i < count; i++) {
      const anchor = anchors[rng.int(0, anchors.length)];
      if (!anchor) continue;
      const spread = 0.2 + rng.next() * 0.55;
      const pos = anchor.end
        .clone()
        .addScaledVector(anchor.dir, spread)
        .add(new THREE.Vector3((rng.next() - 0.5) * 0.2, (rng.next() - 0.5) * 0.2, (rng.next() - 0.5) * 0.2));
      const rot = new THREE.Euler(
        (rng.next() - 0.5) * 0.5,
        (rng.next() - 0.5) * 0.5,
        (rng.next() - 0.5) * 0.5
      );
      figures.push({
        pos,
        dir: anchor.dir.clone().normalize(),
        rot,
        phase: rng.next() * Math.PI * 2,
        headSpeed: 7 + rng.next() * 8,
        scale: 0.65 + rng.next() * 0.45,
      });
    }
    return figures;
  }, [anchors, count, rng]);

  const shared = useMemo(() => {
    const bodyGeo = new THREE.SphereGeometry(0.07, 12, 12);
    const headGeo = new THREE.SphereGeometry(0.16, 16, 16);
    const eyeGeo = new THREE.SphereGeometry(0.035, 10, 10);
    const mouthGeo = new THREE.SphereGeometry(0.012, 8, 8);
    const whiteMat = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.9,
      toneMapped: false,
    });
    const blackMat = new THREE.MeshBasicMaterial({ color: '#000000', toneMapped: false });
    return { bodyGeo, headGeo, eyeGeo, mouthGeo, whiteMat, blackMat };
  }, []);

  useEffect(() => {
    if (!groupRef.current) return;
    const parent = groupRef.current;
    parent.clear();
    figureRefs.current = [];

    for (const k of kodamas) {
      const figure = new THREE.Group();

      // Tiny body, oversized bobble head.
      const body = new THREE.Mesh(shared.bodyGeo, shared.whiteMat);
      body.position.y = 0.02;

      const head = new THREE.Mesh(shared.headGeo, shared.whiteMat);
      head.position.y = 0.22;

      const leftEye = new THREE.Mesh(shared.eyeGeo, shared.blackMat);
      leftEye.position.set(-0.055, 0.06, 0.135);
      const rightEye = new THREE.Mesh(shared.eyeGeo, shared.blackMat);
      rightEye.position.set(0.055, 0.06, 0.135);
      const mouth = new THREE.Mesh(shared.mouthGeo, shared.blackMat);
      mouth.position.set(0, -0.06, 0.145);
      head.add(leftEye, rightEye, mouth);

      figure.add(body, head);
      figure.position.copy(k.pos);
      figure.rotation.copy(k.rot);
      figure.scale.setScalar(k.scale);
      parent.add(figure);
      figureRefs.current.push(figure);
    }

    return () => {
      parent.clear();
      figureRefs.current = [];
    };
  }, [kodamas, shared]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    figureRefs.current.forEach((figure, i) => {
      const k = kodamas[i];
      const head = figure.children[1] as THREE.Mesh | undefined;

      // Classic kodama head rattle / bobble.
      if (head) {
        const rattle = Math.sin(t * k.headSpeed + k.phase);
        head.rotation.z = rattle * 0.45 + Math.sin(t * k.headSpeed * 2.2 + k.phase) * 0.15;
        head.rotation.x = Math.cos(t * k.headSpeed * 1.5 + k.phase) * 0.28;
        head.rotation.y = Math.sin(t * k.headSpeed * 0.7 + k.phase) * 0.18;
      }

      // Wiggle / wander on the branch and a gentle body bob.
      const sway = Math.sin(t * 0.6 + k.phase);
      figure.position.copy(k.pos).addScaledVector(k.dir, sway * 0.12);
      figure.position.y += Math.sin(t * 1.8 + k.phase) * 0.015;
      figure.rotation.z = sway * 0.08;

      // Subtle scale pulse (almost appearing/disappearing).
      const pulse = 0.94 + 0.06 * Math.sin(t * 2.5 + k.phase);
      figure.scale.setScalar(k.scale * pulse);
    });
  });

  if (kodamas.length === 0) return null;
  return <group ref={groupRef} />;
}

/* ── Contact-style light fountain: vertical streaks spiraling upward ── */
function LightFountain({ rng, count = 700 }: { rng: ReturnType<typeof createRandom>; count?: number }) {
  const pointsRef = useRef<THREE.Points>(null);

  const { geometry, material, speeds, angles, radii, phases } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const speeds: number[] = [];
    const angles: number[] = [];
    const radii: number[] = [];
    const phases: number[] = [];

    const palette = [
      new THREE.Color('#078930'),
      new THREE.Color('#e41e2b'),
      new THREE.Color('#fcd116'),
      new THREE.Color('#078930'),
      new THREE.Color('#1a1a1a'),
    ];

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const angle = rng.next() * Math.PI * 2;
      const radius = 0.15 + rng.next() * 1.8;
      const y = -3.2 + rng.next() * 8;

      positions[i3] = Math.cos(angle) * radius;
      positions[i3 + 1] = y;
      positions[i3 + 2] = Math.sin(angle) * radius;

      const color = palette[rng.int(0, palette.length)];
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;

      angles.push(angle);
      radii.push(radius);
      speeds.push(0.015 + rng.next() * 0.04);
      phases.push(rng.next() * Math.PI * 2);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.12,
      map: createStreakTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    return { geometry, material, speeds, angles, radii, phases };
  }, [rng]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const t = state.clock.elapsedTime;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // Spiral upward
      positions[i3 + 1] += speeds[i];
      // Rotate around center
      const spiralSpeed = 0.5 + radii[i] * 0.3;
      const currentAngle = angles[i] + t * spiralSpeed * 0.3;
      positions[i3] = Math.cos(currentAngle) * radii[i];
      positions[i3 + 2] = Math.sin(currentAngle) * radii[i];

      // Reset at top
      if (positions[i3 + 1] > 5.5) {
        positions[i3 + 1] = -3.2;
        angles[i] = rng.next() * Math.PI * 2;
        radii[i] = 0.15 + rng.next() * 1.8;
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

/* ── Pulsing energy rings around the tree (Contact wormhole rings) ── */
function EnergyRings() {
  const groupRef = useRef<THREE.Group>(null);
  const rings = useMemo(() => {
    return Array.from({ length: 10 }).map((_, i) => ({
      radius: 0.8 + i * 0.42,
      tube: 0.015 + (i < 5 ? 0.01 : 0),
      color: i % 3 === 0 ? '#078930' : i % 3 === 1 ? '#fcd116' : '#e41e2b',
      speed: (0.08 + i * 0.02) * (i % 2 === 0 ? 1 : -1),
      yOffset: -3 + i * 0.8,
      phase: i * 0.5,
    }));
  }, []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, i) => {
      child.rotation.z += rings[i].speed * delta;
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.5 + rings[i].phase) * 0.05;
      child.scale.set(pulse, pulse, 1);
    });
  });

  return (
    <group ref={groupRef}>
      {rings.map((ring, i) => (
        <mesh key={i} position={[0, ring.yOffset, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[ring.radius, ring.tube, 8, 32]} />
          <meshBasicMaterial
            color={ring.color}
            transparent
            opacity={0.28 - i * 0.02}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ── Rising energy beams — vertical light shafts ── */
function EnergyBeams({ rng }: { rng: ReturnType<typeof createRandom> }) {
  const groupRef = useRef<THREE.Group>(null);
  const beams = useMemo(() => {
    return Array.from({ length: 8 }).map((_, i) => {
      const angle = (i / 8) * Math.PI * 2 + rng.next() * 0.3;
      const radius = 0.6 + rng.next() * 1.2;
      return {
        position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] as [number, number, number],
        color: ['#078930', '#fcd116', '#e41e2b', '#078930'][i % 4],
        speed: 0.3 + rng.next() * 0.4,
        phase: rng.next() * Math.PI * 2,
        height: 4 + rng.next() * 2,
        width: 0.04 + rng.next() * 0.03,
      };
    });
  }, [rng]);

  const glowTexture = useMemo(() => createGlowTexture(
    'rgba(252, 209, 22, 0.9)',
    'rgba(228, 30, 43, 0.4)',
    'rgba(7, 137, 48, 0.08)'
  ), []);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, i) => {
      const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.opacity = 0.15 + Math.sin(state.clock.elapsedTime * beams[i].speed + beams[i].phase) * 0.1;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {beams.map((beam, i) => (
        <mesh key={i} position={[beam.position[0], 0.5, beam.position[2]]}>
          <cylinderGeometry args={[beam.width, beam.width * 0.5, beam.height, 8, 1, true]} />
          <meshBasicMaterial
            color={beam.color}
            transparent
            opacity={0.2}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function branchCurve(b: Branch): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3([b.start, b.mid, b.end]);
}

export default function TreeOfLife({ isMobile = false }: { isMobile?: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const fruitRef = useRef<THREE.InstancedMesh>(null);
  const heartRef = useRef<THREE.Mesh>(null);
  const auraRef = useRef<THREE.Sprite>(null);
  const rng = useMemo(() => createRandom(777), []);

  /* Fruit collection state — per-fruit collected flag + respawn timer.
     Fruits are clickable: click → collect → +50 XP → scale to 0 →
     respawn after RESPAWN_SECONDS. When the player collects enough
     fruits to reach the threshold, a Tree Blessing fires (+500 XP bonus). */
  const collectFruit = useGameStore((s) => s.collectFruit);
  const collectedFruitIds = useGameStore((s) => s.collectedFruitIds);
  const fruitThreshold = useGameStore((s) => s.fruitThreshold);
  const [hoveredFruit, setHoveredFruit] = useState<number | null>(null);
  const RESPAWN_SECONDS = 30;
  const fruitStateRef = useRef<{ collected: boolean; respawnAt: number }[]>([]);
  const blessingFlashRef = useRef(0);

  const {
    branches,
    branchGeometry,
    rootsGeometry,
    fruitData,
    glowTexture,
    leafAnchors,
  } = useMemo(() => {
    const branches: Branch[] = [];
    const root = new THREE.Vector3(0, -3.2, 0);
    // Shorter trunk before branching starts — like the reference logo, the
    // canopy should read as a wide dome sitting on a modest trunk, not a
    // tall spire.
    const top = new THREE.Vector3(0, 0.5, 0);
    // Reduced maxDepth (4 instead of 5) to keep branch/tube/leaf count sane
    // and avoid per-frame matrix updates exploding.
    generateBranches(root, top, 0, 4, branches, rng);

    const fruits = branches.filter((b) => b.depth >= 4).map((b) => b.end);

    // Leaves anchor along the branches themselves — starting fairly early in
    // the branch structure (depth >= 2) and sampling multiple points along
    // each qualifying branch's length — so foliage fills out the whole
    // canopy densely instead of only sprouting from the outermost twig tips.
    const leafAnchors: LeafAnchor[] = [];
    for (const b of branches) {
      if (b.depth < 2) continue;
      const dir = new THREE.Vector3().subVectors(b.end, b.start).normalize();
      const curve = branchCurve(b);
      // Keep total leaf count (and per-frame sway animation cost) in check.
      const samples = isMobile ? 1 : b.depth >= 4 ? 2 : 1;
      for (let s = 1; s <= samples; s++) {
        leafAnchors.push({ end: curve.getPoint(s / samples), dir });
      }
    }

    const branchGeometries = branches.map((b) => {
      const radius = Math.max(0.008, b.width * 0.045);
      return new THREE.TubeGeometry(branchCurve(b), 6, radius, 6, false);
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
      const radius = Math.max(0.008, b.width * 0.065);
      return new THREE.TubeGeometry(branchCurve(b), 5, radius, 5, false);
    });

    const rootsGeometry = rootGeometries.length > 0 ? mergeGeometries(rootGeometries) : new THREE.BufferGeometry();

    const fruitPalette = [
      '#078930',
      '#fcd116',
      '#e41e2b',
      '#078930',
      '#fcd116',
      '#e41e2b',
    ];

    const fruitData = fruits.map((pos, i) => {
      const color = new THREE.Color(fruitPalette[i % fruitPalette.length]);
      const scale = 0.09 + rng.next() * 0.07;
      const rot = new THREE.Euler(rng.next() * Math.PI, rng.next() * Math.PI, rng.next() * Math.PI);
      return { pos: pos.clone(), color, scale, rot };
    });

    const glowTexture = createGlowTexture(
      'rgba(252, 209, 22, 0.95)',
      'rgba(228, 30, 43, 0.55)',
      'rgba(7, 137, 48, 0.15)'
    );

    return { branches, branchGeometry, rootsGeometry, fruitData, glowTexture, leafAnchors };
  }, [rng, isMobile]);

  const fruitGeometry = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const fruitMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  );

  useEffect(() => {
    if (!fruitRef.current) return;
    // Initialize per-fruit collected state
    fruitStateRef.current = fruitData.map(() => ({ collected: false, respawnAt: 0 }));
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
        color: 0x6b4c2a,
        emissive: 0x3d2410,
        emissiveIntensity: 0.2,
        roughness: 0.6,
        metalness: 0.15,
        toneMapped: false,
      }),
    []
  );

  const rootMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0x3d2410,
        emissive: 0x1a0f0a,
        emissiveIntensity: 0.25,
        roughness: 0.75,
        metalness: 0.15,
        toneMapped: false,
      }),
    []
  );

  const fruitDummy = useRef(new THREE.Object3D());

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.04) * 0.03;
    }
    if (fruitRef.current) {
      const dummy = fruitDummy.current;
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.2) * 0.08;
      const now = state.clock.elapsedTime;
      for (let i = 0; i < fruitData.length; i++) {
        const f = fruitData[i];
        const fs = fruitStateRef.current[i];
        if (!fs) continue;

        // Respawn check: if collected and respawn time has passed, revive
        if (fs.collected && now >= fs.respawnAt) {
          fs.collected = false;
        }

        const beat = 1 + Math.sin(state.clock.elapsedTime * 1.8 + i) * 0.05;
        const hoverBoost = hoveredFruit === i && !fs.collected ? 1.4 : 1;
        const blessingBoost = blessingFlashRef.current > 0 ? 1 + blessingFlashRef.current * 0.3 : 1;
        // Collected fruits scale to 0 (invisible); a tiny pop on respawn
        const baseScale = fs.collected ? 0 : f.scale * pulse * beat * hoverBoost * blessingBoost;
        // Smooth respawn pop: scale up over ~0.5s after respawn
        const scale = baseScale;

        dummy.position.copy(f.pos);
        dummy.rotation.set(f.rot.x + state.clock.elapsedTime * 0.1, f.rot.y + state.clock.elapsedTime * 0.05, f.rot.z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        fruitRef.current.setMatrixAt(i, dummy.matrix);
      }
      fruitRef.current.instanceMatrix.needsUpdate = true;
    }
    // Pulsing heart
    if (heartRef.current) {
      const breath = 1 + Math.sin(state.clock.elapsedTime * 0.8) * 0.06;
      heartRef.current.scale.set(breath, breath, breath);
    }
    // Pulsing aura
    if (auraRef.current) {
      const auraPulse = 1 + Math.sin(state.clock.elapsedTime * 0.5) * 0.08;
      auraRef.current.scale.set(4.2 * auraPulse, 4.2 * auraPulse, 1);
    }
    // Decay blessing flash without triggering React re-renders.
    if (blessingFlashRef.current > 0) {
      blessingFlashRef.current = Math.max(0, blessingFlashRef.current - delta * 1.5);
    }
  });

  /* Click handler for fruit collection.
     R3F provides instanceId in the intersection event. */
  const handleFruitClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      const id = e.instanceId;
      if (id === undefined || !fruitStateRef.current[id]) return;
      const fs = fruitStateRef.current[id];
      if (fs.collected) return;

      fs.collected = true;
      fs.respawnAt = performance.now() / 1000 + RESPAWN_SECONDS;

      const fruitId = `tree-fruit-${id}`;
      const prevCount = useGameStore.getState().collectedFruits.length;
      const ok = collectFruit(fruitId);
      if (ok) {
        const newCount = prevCount + 1;
        if (newCount >= fruitThreshold) {
          // Blessing triggered — flash all fruits
          blessingFlashRef.current = 1;
        }
      }
    },
    [collectFruit, fruitThreshold]
  );

  const handleFruitHover = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const id = e.instanceId;
    if (id === undefined) return;
    setHoveredFruit(id);
    document.body.style.cursor = 'pointer';
  }, []);

  const handleFruitUnhover = useCallback(() => {
    setHoveredFruit(null);
    document.body.style.cursor = 'auto';
  }, []);

  return (
    <group ref={groupRef}>
      <mesh geometry={branchGeometry} material={branchMaterial} castShadow receiveShadow />

      <mesh geometry={rootsGeometry} material={rootMaterial} receiveShadow />

      <instancedMesh
        ref={fruitRef}
        args={[fruitGeometry, fruitMaterial, fruitData.length]}
        castShadow
        receiveShadow
        onClick={handleFruitClick}
        onPointerOver={handleFruitHover}
        onPointerOut={handleFruitUnhover}
      />

      {/* Tree heart — layered luminous core (Contact-style bright center) */}
      <mesh ref={heartRef} position={[0, 0.45, 0]}>
        <sphereGeometry args={[0.55, 32, 32]} />
        <meshBasicMaterial color="#e41e2b" transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.45, 0]}>
        <sphereGeometry args={[0.32, 24, 24]} />
        <meshBasicMaterial color="#fcd116" transparent opacity={0.38} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.45, 0]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshBasicMaterial color="#078930" transparent opacity={0.65} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.45, 0]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={1} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>

      {/* Wide aura at the heart */}
      <sprite ref={auraRef} position={[0, 0.45, 0]} scale={[5.2, 5.2, 1]}>
        <spriteMaterial map={glowTexture} transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>

      {/* Crown glow — widened and lowered to match the broad, flat-topped
          canopy shape instead of a tall narrow one. */}
      <sprite position={[0, 1.3, 0]} scale={[6.2, 3.8, 1]}>
        <spriteMaterial map={glowTexture} transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>

      {/* Ground aura */}
      <sprite position={[0, -3.6, 0]} scale={[6.2, 6.2, 1]} rotation={[Math.PI / 2, 0, 0]}>
        <spriteMaterial map={glowTexture} transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>

      {/* Contact-style light fountain — spiraling vertical streaks */}
      <LightFountain rng={rng} count={isMobile ? 120 : 220} />

      {/* Pulsing energy rings around the tree */}
      <EnergyRings />

      {/* Rising energy beams */}
      <EnergyBeams rng={rng} />

      {/* Extra point light at heart for bloom trigger */}
      <pointLight position={[0, 0.45, 0]} intensity={4.0} distance={14} decay={1.5} color="#fcd116" />
      <pointLight position={[0, 2, 0]} intensity={2.2} distance={12} decay={1.5} color="#e41e2b" />

      <SporeField count={isMobile ? 120 : 200} rng={rng} />
      <LeafCanopy anchors={leafAnchors} leavesPerAnchor={isMobile ? 1 : 2} rng={rng} />
      <KodamaField anchors={leafAnchors} count={isMobile ? 5 : 12} rng={rng} />
    </group>
  );
}
