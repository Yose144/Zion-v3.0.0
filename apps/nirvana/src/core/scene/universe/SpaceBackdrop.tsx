'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* ═══ Vzdálené hvězdy — points-based náhrada za drei Stars
   (ShaderMaterial nefunguje pod WebGPU rendererem). Dvě vrstvy
   pro variaci velikostí: prach + jasnější body. ═══ */
function starShell(count: number, rMin: number, rMax: number) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // rovnoměrné rozmístění na sféře
    const u = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = rMin + Math.random() * (rMax - rMin);
    positions[i * 3] = s * Math.cos(theta) * r;
    positions[i * 3 + 1] = u * r;
    positions[i * 3 + 2] = s * Math.sin(theta) * r;
    // většina chladnobílá, část teplá
    const warm = Math.random() < 0.18;
    const b = 0.75 + Math.random() * 0.25;
    colors[i * 3] = warm ? b : b * (0.82 + Math.random() * 0.18);
    colors[i * 3 + 1] = b * (0.9 + Math.random() * 0.1);
    colors[i * 3 + 2] = warm ? b * (0.7 + Math.random() * 0.15) : b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function FarStars() {
  const faint = useMemo(() => starShell(2400, 70, 105), []);
  const bright = useMemo(() => starShell(380, 65, 100), []);
  return (
    <>
      <points geometry={faint}>
        <pointsMaterial size={0.09} transparent opacity={0.55} sizeAttenuation depthWrite={false} vertexColors blending={THREE.AdditiveBlending} />
      </points>
      <points geometry={bright}>
        <pointsMaterial size={0.22} transparent opacity={0.85} sizeAttenuation depthWrite={false} vertexColors blending={THREE.AdditiveBlending} />
      </points>
    </>
  );
}

/* ═══ Mléčná dráha — galaktický disk s náznakem spirálních ramen.
   Port z website-v2.9 HolographicEarth, navržen pro náš vesmír. ═══ */
function MilkyWay() {
  const ref = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const count = 5200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const armOffset = (i % 3) * 2.1;
      const angle = Math.random() * Math.PI * 2 + armOffset;
      const radius = 30 + Math.random() * 42;
      const thickness = (Math.random() - 0.5) * (2.2 + radius * 0.05);
      const tiltX = 0.45;
      const tiltZ = 0.25;
      const px = Math.cos(angle) * radius;
      const py = thickness;
      const pz = Math.sin(angle) * radius;
      const cy = Math.cos(tiltX);
      const sy = Math.sin(tiltX);
      const cz = Math.cos(tiltZ);
      const sz = Math.sin(tiltZ);
      const nx = px * cz - py * sz;
      const ny = px * sz + py * cz;
      const ny2 = ny * cy - pz * sy;
      const nz = ny * sy + pz * cy;
      positions[i * 3] = nx;
      positions[i * 3 + 1] = ny2;
      positions[i * 3 + 2] = nz;
      const distFromCore = radius / 72;
      // jádro teplejší (staré hvězdy), okraje chladnější (mladé/modré)
      colors[i * 3] = 0.8 + Math.random() * 0.2;
      colors[i * 3 + 1] = Math.max(0.55, 0.82 + Math.random() * 0.18 - distFromCore * 0.2);
      colors[i * 3 + 2] = Math.max(0.7, 0.85 + Math.random() * 0.15);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, []);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.0016;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        size={0.14}
        transparent
        opacity={0.7}
        sizeAttenuation
        depthWrite={false}
        vertexColors
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ═══ Galaktický prach — tmavé mračno přes jádro disku (milky way lane). ═══ */
function GalacticDust() {
  const geometry = useMemo(() => {
    const count = 1400;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 34 + Math.random() * 26;
      const px = Math.cos(angle) * radius;
      const py = (Math.random() - 0.5) * 3.2;
      const pz = Math.sin(angle) * radius;
      const tiltX = 0.45;
      const tiltZ = 0.25;
      const cy = Math.cos(tiltX);
      const sy = Math.sin(tiltX);
      const cz = Math.cos(tiltZ);
      const sz = Math.sin(tiltZ);
      const nx = px * cz - py * sz;
      const ny = px * sz + py * cz;
      const ny2 = ny * cy - pz * sy;
      const nz = ny * sy + pz * cy;
      positions[i * 3] = nx;
      positions[i * 3 + 1] = ny2;
      positions[i * 3 + 2] = nz;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);
  return (
    <points geometry={geometry}>
      <pointsMaterial
        size={0.5}
        color="#0a0714"
        transparent
        opacity={0.55}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/* ═══ Jasné hvězdy — Sirius, Rigel, Betelgeuse... reálné barvy, puls. ═══ */
type BrightStar = {
  name: string;
  color: string;
  radius: number;
  distance: number;
  theta: number;
  phi: number;
  pulseSpeed: number;
};

const BRIGHT_STARS: BrightStar[] = [
  { name: 'Sirius',     color: '#cddaff', radius: 0.09,  distance: 42, theta: 0.9,  phi: 1.35, pulseSpeed: 2.1 },
  { name: 'Rigel',      color: '#b9d4ff', radius: 0.11,  distance: 48, theta: 2.4,  phi: 1.15, pulseSpeed: 1.7 },
  { name: 'Arcturus',   color: '#ffb35c', radius: 0.12,  distance: 38, theta: 4.2,  phi: 1.05, pulseSpeed: 1.3 },
  { name: 'Vega',       color: '#d5e6ff', radius: 0.1,   distance: 44, theta: 5.8,  phi: 0.95, pulseSpeed: 1.9 },
  { name: 'Betelgeuse', color: '#ff9c5a', radius: 0.15,  distance: 36, theta: 1.6,  phi: 0.85, pulseSpeed: 0.8 },
  { name: 'Antares',    color: '#ff6b4a', radius: 0.11,  distance: 50, theta: 3.3,  phi: 1.45, pulseSpeed: 1.1 },
  { name: 'Altair',     color: '#e8f1ff', radius: 0.085, distance: 40, theta: 0.3,  phi: 1.2,  pulseSpeed: 2.4 },
  { name: 'Spica',      color: '#b9c9ff', radius: 0.095, distance: 46, theta: 4.9,  phi: 0.75, pulseSpeed: 1.5 },
  { name: 'Deneb',      color: '#e6edff', radius: 0.1,   distance: 52, theta: 5.1,  phi: 0.65, pulseSpeed: 1.2 },
  { name: 'Pollux',     color: '#ffc98a', radius: 0.11,  distance: 35, theta: 2.9,  phi: 1.55, pulseSpeed: 1.0 },
  { name: 'Canopus',    color: '#f4e8c9', radius: 0.105, distance: 47, theta: 3.9,  phi: 1.25, pulseSpeed: 0.9 },
  { name: 'Aldebaran',  color: '#ffa06e', radius: 0.11,  distance: 39, theta: 1.9,  phi: 1.4,  pulseSpeed: 1.4 },
];

function BrightStars() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.children.forEach((child, i) => {
      const star = BRIGHT_STARS[i];
      if (!star) return;
      const pulse = Math.sin(t * star.pulseSpeed) * 0.25 + 0.8;
      (child as THREE.Group).scale.setScalar(pulse);
    });
  });
  return (
    <group ref={groupRef}>
      {BRIGHT_STARS.map((s) => {
        const x = s.distance * Math.sin(s.phi) * Math.cos(s.theta);
        const y = s.distance * Math.cos(s.phi);
        const z = s.distance * Math.sin(s.phi) * Math.sin(s.theta);
        return (
          <group key={s.name} position={[x, y, z]}>
            <mesh>
              <sphereGeometry args={[s.radius, 16, 16]} />
              <meshBasicMaterial color={s.color} />
            </mesh>
            <mesh scale={3}>
              <sphereGeometry args={[s.radius, 10, 10]} />
              <meshBasicMaterial color={s.color} transparent opacity={0.12} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
            <mesh scale={7}>
              <sphereGeometry args={[s.radius, 8, 8]} />
              <meshBasicMaterial color={s.color} transparent opacity={0.035} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* ═══ Mlhovina — difúzní plynná mraňa (Orion-styl), pomalá drift rotace. ═══ */
function Nebula() {
  const groupRef = useRef<THREE.Group>(null);
  const clouds = useMemo(
    () => [
      { pos: [22, 7, 26] as [number, number, number], scale: [7, 4, 5] as [number, number, number], color: '#7a3cff', opacity: 0.04 },
      { pos: [20, 6, 24] as [number, number, number], scale: [5, 3, 4] as [number, number, number], color: '#e41e7f', opacity: 0.032 },
      { pos: [25, 9, 29] as [number, number, number], scale: [4.5, 2.6, 3.6] as [number, number, number], color: '#4a7fff', opacity: 0.028 },
      { pos: [-28, -8, -24] as [number, number, number], scale: [6, 3.4, 4.4] as [number, number, number], color: '#2a9d8f', opacity: 0.026 },
      { pos: [-26, -6, -27] as [number, number, number], scale: [4.5, 2.4, 3.4] as [number, number, number], color: '#c084fc', opacity: 0.03 },
    ],
    [],
  );
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, i) => {
      const dir = i % 2 === 0 ? 1 : -1;
      child.rotation.y += delta * 0.006 * dir;
      child.rotation.x += delta * 0.003 * dir;
    });
  });
  return (
    <group ref={groupRef}>
      {clouds.map((c, i) => (
        <mesh key={i} position={c.pos} scale={c.scale}>
          <sphereGeometry args={[1, 18, 18]} />
          <meshBasicMaterial color={c.color} transparent opacity={c.opacity} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.BackSide} />
        </mesh>
      ))}
    </group>
  );
}

/** Pozadí vesmíru — naše galaxie: Mléčná dráha, prachový pás, jasné hvězdy, mlhoviny. */
export function SpaceBackdrop() {
  return (
    <>
      <FarStars />
      <MilkyWay />
      <GalacticDust />
      <BrightStars />
      <Nebula />
    </>
  );
}
