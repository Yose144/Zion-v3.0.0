'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as THREE from 'three';
import clsx from 'clsx';

function isWebGLAvailable() {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

/* Real Earth texture + Moon orbit + Sun glow + starfield */

const HOLO_VERT = /* glsl */ `
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const HOLO_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uCore;
uniform vec3 uRim;
uniform vec3 uAccent;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float ndv = clamp(dot(vWorldNormal, viewDir), 0.0, 1.0);
  float fresnel = pow(1.0 - ndv, 2.35);

  float scan = sin(vWorldPosition.y * 48.0 + uTime * 1.9) * 0.5 + 0.5;
  float meridians = pow(abs(sin(vWorldPosition.x * 36.0 + uTime * 0.12)), 10.0);
  float latBands = pow(abs(sin(vWorldPosition.z * 22.0)), 8.0) * 0.35;
  float noise = sin(uTime * 0.55 + vWorldPosition.z * 10.0) * 0.025;

  vec3 core = uCore * (0.35 + scan * 0.18 + meridians * 0.35 + latBands * 0.12);
  vec3 rimCyan = uRim * fresnel * (1.6 + noise);
  vec3 rimGold = uAccent * fresnel * fresnel * 1.0;

  float alpha = 0.08 + fresnel * 0.32 + meridians * 0.08;
  gl_FragColor = vec4(core + rimCyan + rimGold, alpha);
}
`;

function EarthGlobe() {
  const [maps, setMaps] = useState<{
    color?: THREE.Texture;
    bump?: THREE.Texture;
    night?: THREE.Texture;
  }>({});

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load('/textures/earth-blue-marble.jpg', (color) => {
      color.colorSpace = THREE.SRGBColorSpace;
      loader.load('/textures/earth-topology.png', (bump) => {
        loader.load('/textures/earth-dark.jpg', (night) => {
          night.colorSpace = THREE.SRGBColorSpace;
          setMaps({ color, bump, night });
        });
      });
    });
  }, []);

  if (!maps.color || !maps.bump) return null;

  return (
    <group>
      <mesh castShadow={false} receiveShadow={false}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial
          map={maps.color}
          bumpMap={maps.bump}
          bumpScale={0.04}
          roughness={0.35}
          metalness={0}
          color={new THREE.Color('#1a1a1a')}
          emissiveMap={maps.night ?? undefined}
          emissive={maps.night ? new THREE.Color('#fcd116') : new THREE.Color('#078930')}
          emissiveIntensity={maps.night ? 2.2 : 0.35}
        />
      </mesh>
      {/* Atmosphere glow — day side */}
      <mesh scale={1.018}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color="#078930"
          transparent
          opacity={0.08}
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Atmosphere rim — fresnel-like bright ring */}
      <mesh scale={1.045}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color="#fcd116"
          transparent
          opacity={0.06}
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function Moon() {
  const groupRef = useRef<THREE.Group>(null);
  const angleRef = useRef(Math.PI * 0.3);

  useFrame((_state, delta) => {
    if (!groupRef.current) return;
    angleRef.current += delta * 0.15;
    const r = 4.2;
    groupRef.current.position.set(
      Math.cos(angleRef.current) * r,
      Math.sin(angleRef.current * 0.6) * 0.4,
      Math.sin(angleRef.current) * r,
    );
    groupRef.current.rotation.y += delta * 0.08;
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[0.27, 32, 32]} />
        <meshStandardMaterial color="#d4d4d4" roughness={0.92} metalness={0.05} />
      </mesh>
      {/* faint moon glow */}
      <mesh scale={1.35}>
        <sphereGeometry args={[0.27, 16, 16]} />
        <meshBasicMaterial color="#fcd116" transparent opacity={0.06} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function Sun() {
  const sunRef = useRef<THREE.Mesh>(null);

  useFrame((_state, delta) => {
    if (sunRef.current) {
      sunRef.current.rotation.y += delta * 0.02;
    }
  });

  return (
    <group position={[18, 6, -14]}>
      {/* core sun */}
      <mesh ref={sunRef}>
        <sphereGeometry args={[2.8, 32, 32]} />
        <meshBasicMaterial color="#fcd116" />
      </mesh>
      {/* inner corona */}
      <mesh scale={1.4}>
        <sphereGeometry args={[2.8, 24, 24]} />
        <meshBasicMaterial color="#e41e2b" transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* outer corona */}
      <mesh scale={2.2}>
        <sphereGeometry args={[2.8, 16, 16]} />
        <meshBasicMaterial color="#fcd116" transparent opacity={0.06} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

type PlanetData = {
  name: string;
  color: string;
  emissive: string;
  radius: number;
  orbitRadius: number;
  orbitSpeed: number;
  orbitTilt: number;
  startAngle: number;
  hasRing?: boolean;
  ringColor?: string;
};

const PLANETS: PlanetData[] = [
  { name: 'Mercury', color: '#1a1a1a', emissive: '#0d0d0d', radius: 0.035, orbitRadius: 6.5, orbitSpeed: 0.55, orbitTilt: 0.1, startAngle: 0.0 },
  { name: 'Venus',   color: '#fcd116', emissive: '#e41e2b', radius: 0.06,  orbitRadius: 8.0, orbitSpeed: 0.40, orbitTilt: 0.15, startAngle: 1.2 },
  { name: 'Mars',    color: '#e41e2b', emissive: '#e41e2b', radius: 0.045, orbitRadius: 10.0, orbitSpeed: 0.28, orbitTilt: 0.08, startAngle: 2.5 },
  { name: 'Jupiter', color: '#fcd116', emissive: '#e41e2b', radius: 0.14,  orbitRadius: 14.0, orbitSpeed: 0.12, orbitTilt: 0.2,  startAngle: 0.8 },
  { name: 'Saturn',  color: '#fcd116', emissive: '#fcd116', radius: 0.11,  orbitRadius: 17.0, orbitSpeed: 0.09, orbitTilt: 0.25, startAngle: 3.1, hasRing: true, ringColor: '#fcd116' },
  { name: 'Uranus',  color: '#078930', emissive: '#078930', radius: 0.07,  orbitRadius: 20.0, orbitSpeed: 0.06, orbitTilt: 0.35, startAngle: 4.4 },
  { name: 'Neptune', color: '#e41e2b', emissive: '#e41e2b', radius: 0.065, orbitRadius: 23.0, orbitSpeed: 0.05, orbitTilt: 0.18, startAngle: 5.7 },
];

function Planet({ data }: { data: PlanetData }) {
  const groupRef = useRef<THREE.Group>(null);
  const angleRef = useRef(data.startAngle);

  useFrame((_state, delta) => {
    if (!groupRef.current) return;
    angleRef.current += delta * data.orbitSpeed;
    const r = data.orbitRadius;
    const tilt = data.orbitTilt;
    groupRef.current.position.set(
      Math.cos(angleRef.current) * r,
      Math.sin(angleRef.current * 0.7 + tilt) * r * 0.15,
      Math.sin(angleRef.current) * r,
    );
    groupRef.current.rotation.y += delta * 0.3;
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[data.radius, 16, 16]} />
        <meshStandardMaterial
          color={data.color}
          emissive={data.emissive}
          emissiveIntensity={0.6}
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>
      {/* faint glow */}
      <mesh scale={1.6}>
        <sphereGeometry args={[data.radius, 12, 12]} />
        <meshBasicMaterial
          color={data.emissive}
          transparent
          opacity={0.04}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {data.hasRing && (
        <mesh rotation={[Math.PI / 2.5, 0, 0]}>
          <ringGeometry args={[data.radius * 1.6, data.radius * 2.4, 32]} />
          <meshBasicMaterial
            color={data.ringColor}
            transparent
            opacity={0.25}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
    </group>
  );
}

function Planets() {
  return (
    <>
      {PLANETS.map((p) => (
        <Planet key={p.name} data={p} />
      ))}
    </>
  );
}

function IssobellaStation() {
  const groupRef = useRef<THREE.Group>(null);
  const angleRef = useRef(Math.PI * 0.85);

  useFrame((_state, delta) => {
    if (!groupRef.current) return;
    angleRef.current += delta * 0.35;
    const r = 2.6;
    groupRef.current.position.set(
      Math.cos(angleRef.current) * r,
      Math.sin(angleRef.current * 0.25) * 0.25,
      Math.sin(angleRef.current) * r,
    );
    groupRef.current.rotation.y += delta * 0.6;
    groupRef.current.rotation.z += delta * 0.2;
  });

  return (
    <group ref={groupRef}>
      {/* Main torus — ring habitat */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.14, 0.035, 12, 24]} />
        <meshStandardMaterial color="#fcd116" emissive="#078930" emissiveIntensity={0.8} roughness={0.3} metalness={0.7} />
      </mesh>
      {/* Central core */}
      <mesh>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color="#078930" emissive="#078930" emissiveIntensity={1.2} roughness={0.2} metalness={0.5} />
      </mesh>

      {/* Issobella glow */}
      <mesh scale={2.5}>
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshBasicMaterial color="#fcd116" transparent opacity={0.08} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function HologramShell() {
  const matRef = useRef<THREE.ShaderMaterial | null>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCore: { value: new THREE.Color('#1a1a1a') },
      uRim: { value: new THREE.Color('#078930') },
      uAccent: { value: new THREE.Color('#fcd116') },
    }),
    [],
  );

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <group>
      {/* Wireframe shell — ultra subtle */}
      <mesh scale={1.028}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial
          color="#078930"
          wireframe
          transparent
          opacity={0.08}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Atmosphere glow */}
      <mesh scale={1.06}>
        <sphereGeometry args={[1, 16, 16]} />
        <shaderMaterial
          ref={matRef}
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          uniforms={uniforms}
          vertexShader={HOLO_VERT}
          fragmentShader={HOLO_FRAG}
        />
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════
   BRIGHT STARS — Sirius, Rigel, Arcturus, Vega, Betelgeuse...
   ═══════════════════════════════════════════════════════════ */
type BrightStar = {
  name: string;
  color: string;
  emissive: string;
  radius: number;
  distance: number;
  theta: number;
  phi: number;
  pulseSpeed: number;
};

const BRIGHT_STARS: BrightStar[] = [
  { name: 'Sirius',     color: '#078930', emissive: '#078930', radius: 0.055, distance: 42, theta: 0.9,  phi: 1.35, pulseSpeed: 2.1 },
  { name: 'Rigel',      color: '#078930', emissive: '#078930', radius: 0.065, distance: 48, theta: 2.4,  phi: 1.15, pulseSpeed: 1.7 },
  { name: 'Arcturus',   color: '#e41e2b', emissive: '#e41e2b', radius: 0.075, distance: 38, theta: 4.2,  phi: 1.05, pulseSpeed: 1.3 },
  { name: 'Vega',       color: '#fcd116', emissive: '#fcd116', radius: 0.06,  distance: 44, theta: 5.8,  phi: 0.95, pulseSpeed: 1.9 },
  { name: 'Betelgeuse', color: '#e41e2b', emissive: '#e41e2b', radius: 0.09,  distance: 36, theta: 1.6,  phi: 0.85, pulseSpeed: 0.8 },
  { name: 'Antares',    color: '#e41e2b', emissive: '#e41e2b', radius: 0.07,  distance: 50, theta: 3.3,  phi: 1.45, pulseSpeed: 1.1 },
  { name: 'Altair',     color: '#078930', emissive: '#078930', radius: 0.05,  distance: 40, theta: 0.3,  phi: 1.2,  pulseSpeed: 2.4 },
  { name: 'Spica',      color: '#078930', emissive: '#078930', radius: 0.058, distance: 46, theta: 4.9,  phi: 0.75, pulseSpeed: 1.5 },
  { name: 'Deneb',      color: '#fcd116', emissive: '#fcd116', radius: 0.062, distance: 52, theta: 5.1,  phi: 0.65, pulseSpeed: 1.2 },
  { name: 'Pollux',     color: '#fcd116', emissive: '#fcd116', radius: 0.068, distance: 35, theta: 2.9,  phi: 1.55, pulseSpeed: 1.0 },
];

function BrightStars() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.children.forEach((child, i) => {
      const star = BRIGHT_STARS[i];
      if (!star) return;
      const pulse = Math.sin(t * star.pulseSpeed) * 0.3 + 0.7;
      const mesh = child as THREE.Mesh;
      mesh.scale.setScalar(pulse);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat && mat.emissiveIntensity !== undefined) {
        mat.emissiveIntensity = 1.2 + pulse * 1.5;
      }
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
              <meshStandardMaterial
                color={s.color}
                emissive={s.emissive}
                emissiveIntensity={2.5}
                roughness={1}
                metalness={0}
              />
            </mesh>
            {/* star glow */}
            <mesh scale={3}>
              <sphereGeometry args={[s.radius, 12, 12]} />
              <meshBasicMaterial
                color={s.emissive}
                transparent
                opacity={0.08}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
            {/* distant halo */}
            <mesh scale={6}>
              <sphereGeometry args={[s.radius, 8, 8]} />
              <meshBasicMaterial
                color={s.color}
                transparent
                opacity={0.025}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════
   MILKY WAY — galactic disk in the background
   ═══════════════════════════════════════════════════════════ */
function MilkyWay() {
  const geometry = useMemo(() => {
    const count = 4000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Flattened disk shape with spiral arms hint
      const armOffset = (i % 3) * 2.1; // 3 spiral arms
      const angle = Math.random() * Math.PI * 2 + armOffset;
      const radius = 28 + Math.random() * 35;
      const thickness = (Math.random() - 0.5) * 3.5;

      // Tilt the disk (Milky Way angle)
      const tiltX = 0.45;
      const tiltZ = 0.25;

      let px = Math.cos(angle) * radius;
      let py = thickness;
      let pz = Math.sin(angle) * radius;

      // Apply tilt
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

      // Color: core is warmer, edges cooler
      const distFromCore = radius / 60;
      const r = 0.75 + Math.random() * 0.25;
      const g = 0.8 + Math.random() * 0.2 - distFromCore * 0.15;
      const b = 0.9 + Math.random() * 0.1;
      colors[i * 3] = r;
      colors[i * 3 + 1] = Math.max(0.6, g);
      colors[i * 3 + 2] = Math.max(0.7, b);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, []);

  return (
    <points geometry={geometry}>
      <pointsMaterial
        size={0.055}
        transparent
        opacity={0.65}
        sizeAttenuation
        depthWrite={false}
        vertexColors
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ═══════════════════════════════════════════════════════════
   ORION NEBULA — diffuse pink/violet gas clouds
   ═══════════════════════════════════════════════════════════ */
function OrionNebula() {
  const groupRef = useRef<THREE.Group>(null);

  const clouds = useMemo(() => [
    { pos: [18, 6, 22] as [number, number, number], scale: [5.5, 3.2, 4.0] as [number, number, number], color: '#e41e2b', opacity: 0.035 },
    { pos: [16, 5, 20] as [number, number, number], scale: [4.0, 2.5, 3.5] as [number, number, number], color: '#fcd116', opacity: 0.028 },
    { pos: [20, 7, 24] as [number, number, number], scale: [3.5, 2.0, 3.0] as [number, number, number], color: '#e41e2b', opacity: 0.022 },
    { pos: [14, 4, 21] as [number, number, number], scale: [3.0, 1.8, 2.5] as [number, number, number], color: '#078930', opacity: 0.018 },
  ], []);

  useFrame((_state, delta) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, i) => {
      const dir = i % 2 === 0 ? 1 : -1;
      child.rotation.y += delta * 0.008 * dir;
      child.rotation.x += delta * 0.004 * dir;
    });
  });

  return (
    <group ref={groupRef}>
      {clouds.map((c, i) => (
        <mesh key={i} position={c.pos} scale={c.scale}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial
            color={c.color}
            transparent
            opacity={c.opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.BackSide}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════
   AURORA BOREALIS — lite particle curtain above north pole
   ═══════════════════════════════════════════════════════════ */
function AuroraBorealis() {
  const ref = useRef<THREE.Points>(null);

  const { positions, colors } = useMemo(() => {
    const count = 300;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.55;
      const height = 0.04 + Math.random() * 0.18;

      pos[i * 3] = Math.cos(angle) * r;
      pos[i * 3 + 1] = height;
      pos[i * 3 + 2] = Math.sin(angle) * r;

      // Green and cyan mix
      const isGreen = Math.random() > 0.5;
      col[i * 3] = isGreen ? 0.3 + Math.random() * 0.3 : 0.2 + Math.random() * 0.2;
      col[i * 3 + 1] = 0.8 + Math.random() * 0.2;
      col[i * 3 + 2] = isGreen ? 0.3 + Math.random() * 0.2 : 0.7 + Math.random() * 0.3;
    }

    return { positions: pos, colors: col };
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const posAttr = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    for (let i = 0; i < arr.length / 3; i++) {
      const baseX = arr[i * 3];
      const baseZ = arr[i * 3 + 2];
      // gentle wave motion
      const wave = Math.sin(t * 0.6 + baseX * 4 + baseZ * 3) * 0.012;
      arr[i * 3 + 1] = 0.06 + wave + Math.abs(Math.sin(i * 0.7 + t * 0.3)) * 0.15;
    }
    posAttr.needsUpdate = true;
  });

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [positions, colors]);

  return (
    <points ref={ref} position={[0, 1.02, 0]} geometry={geometry}>
      <pointsMaterial
        size={0.028}
        transparent
        opacity={0.65}
        sizeAttenuation
        depthWrite={false}
        vertexColors
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function latLonToVector3(lat: number, lon: number, radius: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return [x, y, z];
}

const TERRA_NOVA_MARKERS = [
  { lat: 37.0, lon: -8.0, color: '#078930', glow: '#078930', nameCs: 'Zahrada Genesis', nameEn: 'Garden of Genesis', href: '/terranova/genesis' },
  { lat: 28.7, lon: -17.9, color: '#fcd116', glow: '#fcd116', nameCs: 'Dharma Temple', nameEn: 'Dharma Temple', href: '/terranova/dharma-temple' },
  { lat: -17.0, lon: -150.0, color: '#e41e2b', glow: '#e41e2b', nameCs: 'Te Piko Ora', nameEn: 'Te Piko Ora', href: '/terranova/te-piko-ora' },
];

function TerraNovaMarkers() {
  const router = useRouter();
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <>
      {TERRA_NOVA_MARKERS.map((m) => {
        const pos = latLonToVector3(m.lat, m.lon, 1.022);
        const isHovered = hovered === m.href;
        return (
          <group key={m.href} position={pos}>
            {/* Pulse ring */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.022, 0.038, 32]} />
              <meshBasicMaterial
                color={m.glow}
                transparent
                opacity={isHovered ? 0.95 : 0.65}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
            {/* Core dot */}
            <mesh scale={isHovered ? 1.5 : 1}>
              <sphereGeometry args={[0.016, 16, 16]} />
              <meshStandardMaterial
                color={m.color}
                emissive={m.color}
                emissiveIntensity={isHovered ? 2.5 : 1.5}
              />
            </mesh>
            {/* Invisible click/hover target */}
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                router.push(m.href);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHovered(m.href);
                if (typeof document !== 'undefined') {
                  document.body.style.cursor = 'pointer';
                }
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                setHovered(null);
                if (typeof document !== 'undefined') {
                  document.body.style.cursor = 'default';
                }
              }}
            >
              <sphereGeometry args={[0.05, 16, 16]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function StarField() {
  const geometry = useMemo(() => {
    const count = 1200;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 18 + Math.random() * 22;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  return (
    <points geometry={geometry}>
      <pointsMaterial
        size={0.035}
        color="#fcd116"
        transparent
        opacity={0.75}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={1.4} />
      <directionalLight position={[8, 4, 8]} intensity={3.5} color="#fcd116" />
      <pointLight position={[-6, -2, 4]} intensity={1.2} color="#078930" />
      <pointLight position={[0, 6, 2]} intensity={0.8} color="#fcd116" />
      <pointLight position={[0, -4, 0]} intensity={0.6} color="#078930" />
      <hemisphereLight color="#fcd116" groundColor="#0d0d0d" intensity={1.0} />
      <MilkyWay />
      <OrionNebula />
      <StarField />
      <BrightStars />
      <Sun />
      <Planets />
      <group rotation={[0, -Math.PI / 2, 0]}>
        <EarthGlobe />
        <TerraNovaMarkers />
      </group>
      <Moon />
      <IssobellaStation />
      <HologramShell />
      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.056}
        minPolarAngle={Math.PI * 0.2}
        maxPolarAngle={Math.PI * 0.82}
        minDistance={1.72}
        maxDistance={4.5}
        autoRotate
        autoRotateSpeed={0.28}
      />
    </>
  );
}

export type HolographicEarthProps = {
  className?: string;
};

export default function HolographicEarth({ className }: HolographicEarthProps) {
  const [webglOk, setWebglOk] = useState(false);

  useEffect(() => {
    setWebglOk(isWebGLAvailable());
  }, []);

  return (
    <div
      className={clsx(
        'relative aspect-[5/4] w-full max-h-[300px] overflow-hidden rounded-[22px] sm:max-h-[340px]',
        'border border-rasta-gold/30 bg-gradient-to-b from-rasta-black/85 via-rasta-dark/82 to-rasta-black/86',
        'shadow-[0_12px_48px_rgba(0,0,0,0.45),0_0_0_1px_rgba(252,209,22,0.06)_inset,0_0_64px_rgba(7,137,48,0.12)]',
        'ring-1 ring-rasta-gold/10',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[22px] bg-[radial-gradient(ellipse_at_50%_42%,rgba(252,209,22,0.38),transparent_58%)]" />
      <div className="pointer-events-none absolute inset-0 rounded-[22px] bg-[radial-gradient(circle_at_50%_88%,rgba(228,30,43,0.14),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[35%] bg-gradient-to-t from-black/25 to-transparent" />
      <div className="pointer-events-none absolute inset-3 rounded-[16px] border border-white/[0.06]" />
      <p className="pointer-events-none absolute inset-x-0 top-2.5 z-10 text-center text-[9px] font-medium uppercase tracking-[0.42em] text-rasta-gold/50">
        Holographic Earth · Solar System · Milky Way · Orion · Bright Stars · Terra Nova · drag orbit
      </p>
      <div className="absolute inset-x-0 bottom-0 top-9 sm:top-10">
        {webglOk ? (
          <Canvas
            className="h-full w-full !block"
            dpr={typeof window !== 'undefined' && window.innerWidth < 768 ? 1 : [1, 1.5]}
            gl={{
              alpha: true,
              antialias: typeof window === 'undefined' || window.innerWidth >= 768,
              powerPreference: 'high-performance',
            }}
            onCreated={({ gl }) => {
              gl.setClearColor(0x000000, 0);
            }}
            camera={{ position: [0, 0, 2.72], fov: 40 }}
          >
            <Scene />
          </Canvas>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-2 h-12 w-12 rounded-full border border-rasta-green/20 bg-rasta-green/10 flex items-center justify-center">
                <span className="text-lg">🌍</span>
              </div>
              <p className="text-[10px] text-rasta-gold/40 uppercase tracking-widest">WebGL unavailable</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
