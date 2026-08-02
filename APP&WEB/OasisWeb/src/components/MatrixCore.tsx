'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createRandom } from '../domain/ports/random';

/**
 * MatrixCore — a geometric 3D structure at the heart of the OASIS galaxy.
 * Represents the ZION blockchain / digital substrate underlying all worlds.
 * A rotating icosahedron with glowing wireframe edges, orbiting data nodes,
 * and vertical light pillars.
 */
export default function MatrixCore() {
  const groupRef = useRef<THREE.Group>(null);
  const icoRef = useRef<THREE.Mesh>(null);
  const wireRef = useRef<THREE.LineSegments>(null);
  const dataRef = useRef<THREE.Points>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  const rng = useMemo(() => createRandom(7777), []);

  // Icosahedron geometry for the core
  const icoGeometry = useMemo(() => new THREE.IcosahedronGeometry(1.6, 1), []);
  const wireGeometry = useMemo(() => new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.65, 1)), []);

  // Inner solid — dark with subtle glow
  const icoMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#0a0a1a',
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  );

  // Wireframe edges — gold glow
  const wireMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: '#ffd700',
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  );

  // Orbiting data nodes — small particles circling the core
  const { dataGeometry, dataMaterial, dataOrbits } = useMemo(() => {
    const count = 200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const orbits: { radius: number; speed: number; phase: number; yOffset: number; tilt: number }[] = [];

    const goldColor = new THREE.Color('#ffd700');
    const cyanColor = new THREE.Color('#06b6d4');
    const purpleColor = new THREE.Color('#a855f7');
    const temp = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const radius = 2.2 + rng.next() * 2.8;
      const phase = rng.next() * Math.PI * 2;
      const speed = (0.15 + rng.next() * 0.35) * (rng.next() > 0.5 ? 1 : -1);
      const yOffset = (rng.next() - 0.5) * 3.5;
      const tilt = (rng.next() - 0.5) * 0.6;

      orbits.push({ radius, speed, phase, yOffset, tilt });

      positions[i3] = Math.cos(phase) * radius;
      positions[i3 + 1] = yOffset;
      positions[i3 + 2] = Math.sin(phase) * radius;

      const mix = rng.next();
      if (mix < 0.4) temp.copy(goldColor);
      else if (mix < 0.7) temp.copy(cyanColor);
      else temp.copy(purpleColor);

      colors[i3] = temp.r;
      colors[i3 + 1] = temp.g;
      colors[i3 + 2] = temp.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Create a small circular sprite texture for data nodes
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.PointsMaterial({
      size: 0.12,
      map: texture,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
      toneMapped: false,
    });

    return { dataGeometry: geometry, dataMaterial: material, dataOrbits: orbits };
  }, [rng]);

  // Vertical light pillars — 6 beams radiating from the core
  const pillars = useMemo(() => {
    return Array.from({ length: 6 }).map((_, i) => {
      const angle = (i / 6) * Math.PI * 2;
      const radius = 1.8;
      return {
        position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] as [number, number, number],
        color: i % 3 === 0 ? '#ffd700' : i % 3 === 1 ? '#06b6d4' : '#a855f7',
        height: 4 + rng.next() * 2,
      };
    });
  }, [rng]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    // Rotate the entire group slowly
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.08;
    }

    // Counter-rotate the icosahedron
    if (icoRef.current) {
      icoRef.current.rotation.y -= delta * 0.15;
      icoRef.current.rotation.x = Math.sin(t * 0.3) * 0.15;
    }

    // Counter-rotate wireframe
    if (wireRef.current) {
      wireRef.current.rotation.y -= delta * 0.15;
      wireRef.current.rotation.x = Math.sin(t * 0.3) * 0.15;
    }

    // Pulse the wireframe opacity
    if (wireMaterial) {
      wireMaterial.opacity = 0.5 + Math.sin(t * 1.5) * 0.2;
    }

    // Animate data nodes along their orbits
    if (dataRef.current) {
      const positions = dataRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < dataOrbits.length; i++) {
        const i3 = i * 3;
        const orbit = dataOrbits[i];
        const angle = orbit.phase + t * orbit.speed;
        positions[i3] = Math.cos(angle) * orbit.radius;
        positions[i3 + 1] = orbit.yOffset + Math.sin(t * orbit.speed * 2 + orbit.phase) * 0.3;
        positions[i3 + 2] = Math.sin(angle) * orbit.radius * Math.cos(orbit.tilt);
      }
      dataRef.current.geometry.attributes.position.needsUpdate = true;
    }

    // Pulse the central light
    if (lightRef.current) {
      lightRef.current.intensity = 2.5 + Math.sin(t * 2) * 0.8;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.4, 0]}>
      {/* Inner solid icosahedron */}
      <mesh ref={icoRef} geometry={icoGeometry} material={icoMaterial} />

      {/* Glowing wireframe edges */}
      <lineSegments ref={wireRef} geometry={wireGeometry} material={wireMaterial} />

      {/* Orbiting data nodes */}
      <points ref={dataRef} geometry={dataGeometry} material={dataMaterial} />

      {/* Vertical light pillars */}
      {pillars.map((p, i) => (
        <mesh key={i} position={p.position}>
          <cylinderGeometry args={[0.03, 0.03, p.height, 8]} />
          <meshBasicMaterial
            color={p.color}
            transparent
            opacity={0.4}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Central point light */}
      <pointLight ref={lightRef} color="#ffd700" intensity={3} distance={25} decay={1.2} position={[0, 0, 0]} />
      <pointLight color="#06b6d4" intensity={1.5} distance={15} decay={1.5} position={[0, 0, 0]} />
    </group>
  );
}
