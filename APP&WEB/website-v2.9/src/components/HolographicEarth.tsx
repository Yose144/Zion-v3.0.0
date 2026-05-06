'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import clsx from 'clsx';

/* Morpho-style interactive hologram globe: fresnel rim, scan lines, wireframe shell, orbit + zoom. */

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

  float alpha = 0.22 + fresnel * 0.72 + meridians * 0.14;
  gl_FragColor = vec4(core + rimCyan + rimGold, alpha);
}
`;

function HologramGlobe() {
  const matRef = useRef<THREE.ShaderMaterial | null>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCore: { value: new THREE.Color('#040d1c') },
      uRim: { value: new THREE.Color('#6ffff0') },
      uAccent: { value: new THREE.Color('#f5d78e') },
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
      <mesh castShadow={false} receiveShadow={false}>
        <sphereGeometry args={[1, 72, 72]} />
        <shaderMaterial
          ref={matRef}
          transparent
          depthWrite
          depthTest
          side={THREE.DoubleSide}
          uniforms={uniforms}
          vertexShader={HOLO_VERT}
          fragmentShader={HOLO_FRAG}
        />
      </mesh>
      <mesh scale={1.028}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshBasicMaterial
          color="#a8fff8"
          wireframe
          transparent
          opacity={0.13}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh scale={1.06}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color="#67f3df"
          transparent
          opacity={0.04}
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.12} />
      <pointLight position={[4.2, 1.2, 5]} intensity={1.0} color="#b8fff8" />
      <pointLight position={[-4, -0.5, 3.2]} intensity={0.55} color="#8c9cff" />
      <pointLight position={[0, 3.5, 1]} intensity={0.35} color="#ffe8a6" />
      <HologramGlobe />
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
        'border border-cyan-400/25 bg-gradient-to-b from-[#050a14]/95 via-[#070f1c]/92 to-[#05080f]/95',
        'shadow-[0_12px_48px_rgba(0,0,0,0.45),0_0_0_1px_rgba(103,243,223,0.06)_inset,0_0_64px_rgba(103,243,223,0.12)]',
        'ring-1 ring-amber-200/10',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[22px] bg-[radial-gradient(ellipse_at_50%_42%,rgba(103,243,223,0.18),transparent_58%)]" />
      <div className="pointer-events-none absolute inset-0 rounded-[22px] bg-[radial-gradient(circle_at_50%_88%,rgba(245,215,142,0.06),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black/40 to-transparent" />
      <div className="pointer-events-none absolute inset-3 rounded-[16px] border border-white/[0.06]" />
      <p className="pointer-events-none absolute inset-x-0 top-2.5 z-10 text-center text-[9px] font-medium uppercase tracking-[0.42em] text-cyan-100/50">
        Holographic mesh · drag orbit
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
