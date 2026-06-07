'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as THREE from 'three';
import clsx from 'clsx';

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

  vec3 core = uCore * (0.2 + scan * 0.14 + meridians * 0.28 + latBands * 0.08);
  vec3 rimCyan = uRim * fresnel * (1.28 + noise);
  vec3 rimGold = uAccent * fresnel * fresnel * 0.85;

  float alpha = 0.05 + fresnel * 0.28 + meridians * 0.06;
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
          bumpScale={0.055}
          roughness={0.22}
          metalness={0.15}
          color={new THREE.Color('#a8d8ea')}
          emissiveMap={maps.night ?? undefined}
          emissive={maps.night ? new THREE.Color('#ffeedd') : undefined}
          emissiveIntensity={maps.night ? 1.8 : 0}
        />
      </mesh>
      {/* Atmosphere glow — day side */}
      <mesh scale={1.012}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color="#4fc3f7"
          transparent
          opacity={0.04}
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Atmosphere rim — fresnel-like bright ring */}
      <mesh scale={1.035}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color="#81d4fa"
          transparent
          opacity={0.025}
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
        <meshStandardMaterial color="#c8c8c8" roughness={0.92} metalness={0.05} />
      </mesh>
      {/* faint moon glow */}
      <mesh scale={1.35}>
        <sphereGeometry args={[0.27, 16, 16]} />
        <meshBasicMaterial color="#dceeff" transparent opacity={0.06} depthWrite={false} blending={THREE.AdditiveBlending} />
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
        <meshBasicMaterial color="#ffdb78" />
      </mesh>
      {/* inner corona */}
      <mesh scale={1.4}>
        <sphereGeometry args={[2.8, 24, 24]} />
        <meshBasicMaterial color="#ffaa44" transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* outer corona */}
      <mesh scale={2.2}>
        <sphereGeometry args={[2.8, 16, 16]} />
        <meshBasicMaterial color="#ffeebb" transparent opacity={0.06} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
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
        <meshStandardMaterial color="#d946ef" emissive="#a855f7" emissiveIntensity={0.8} roughness={0.3} metalness={0.7} />
      </mesh>
      {/* Central core */}
      <mesh>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color="#f0abfc" emissive="#e879f9" emissiveIntensity={1.2} roughness={0.2} metalness={0.5} />
      </mesh>
      {/* Solar panels */}
      <mesh position={[0.22, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.28, 0.01, 0.14]} />
        <meshStandardMaterial color="#1e1b4b" emissive="#8b5cf6" emissiveIntensity={0.4} roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[-0.22, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.28, 0.01, 0.14]} />
        <meshStandardMaterial color="#1e1b4b" emissive="#8b5cf6" emissiveIntensity={0.4} roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Issobella glow */}
      <mesh scale={2.5}>
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshBasicMaterial color="#c084fc" transparent opacity={0.08} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function HologramShell() {
  const matRef = useRef<THREE.ShaderMaterial | null>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCore: { value: new THREE.Color('#0c3d5c') },
      uRim: { value: new THREE.Color('#4dd0e1') },
      uAccent: { value: new THREE.Color('#ffe082') },
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
          color="#81d4fa"
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

function latLonToVector3(lat: number, lon: number, radius: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return [x, y, z];
}

const TERRA_NOVA_MARKERS = [
  { lat: 37.0, lon: -8.0, color: '#34D399', glow: '#10B981', nameCs: 'Zahrada Genesis', nameEn: 'Garden of Genesis', href: '/terranova/genesis' },
  { lat: 28.7, lon: -17.9, color: '#F97316', glow: '#F59E0B', nameCs: 'Dharma Temple', nameEn: 'Dharma Temple', href: '/terranova/dharma-temple' },
  { lat: -17.0, lon: -150.0, color: '#22D3EE', glow: '#06B6D4', nameCs: 'Te Piko Ora', nameEn: 'Te Piko Ora', href: '/terranova/te-piko-ora' },
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
        color="#c4e0ff"
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
      <ambientLight intensity={0.85} />
      <directionalLight position={[10, 5, 10]} intensity={2.2} color="#fff8e7" />
      <pointLight position={[-8, -2, 5]} intensity={0.8} color="#a8d8ff" />
      <pointLight position={[0, 6, 2]} intensity={0.5} color="#ffe8b0" />
      <hemisphereLight color="#87ceeb" groundColor="#1a2f4a" intensity={0.6} />
      <StarField />
      <Sun />
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
  return (
    <div
      className={clsx(
        'relative aspect-[5/4] w-full max-h-[300px] overflow-hidden rounded-[22px] sm:max-h-[340px]',
        'border border-cyan-300/30 bg-gradient-to-b from-[#0a1a2e]/90 via-[#0d1f33]/88 to-[#081422]/92',
        'shadow-[0_12px_48px_rgba(0,0,0,0.45),0_0_0_1px_rgba(103,243,223,0.06)_inset,0_0_64px_rgba(103,243,223,0.12)]',
        'ring-1 ring-amber-200/10',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[22px] bg-[radial-gradient(ellipse_at_50%_42%,rgba(103,243,223,0.28),transparent_58%)]" />
      <div className="pointer-events-none absolute inset-0 rounded-[22px] bg-[radial-gradient(circle_at_50%_88%,rgba(245,215,142,0.10),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[35%] bg-gradient-to-t from-black/25 to-transparent" />
      <div className="pointer-events-none absolute inset-3 rounded-[16px] border border-white/[0.06]" />
      <p className="pointer-events-none absolute inset-x-0 top-2.5 z-10 text-center text-[9px] font-medium uppercase tracking-[0.42em] text-cyan-100/50">
        Holographic Earth · L6 Issobella Station · Terra Nova Nodes · drag orbit
      </p>
      <div className="absolute inset-x-0 bottom-0 top-9 sm:top-10">
        <Canvas
          className="h-full w-full !block"
          dpr={[1, 2]}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance',
          }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
          }}
          camera={{ position: [0, 0, 2.72], fov: 40 }}
        >
          <Scene />
        </Canvas>
      </div>
    </div>
  );
}
