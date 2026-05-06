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

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float ndv = clamp(dot(vWorldNormal, viewDir), 0.0, 1.0);
  float fresnel = pow(1.0 - ndv, 2.65);

  float scan = sin(vWorldPosition.y * 52.0 + uTime * 2.2) * 0.5 + 0.5;
  float meridians = pow(abs(sin(vWorldPosition.x * 38.0 + uTime * 0.15)), 12.0);
  float noise = sin(uTime * 0.7 + vWorldPosition.z * 12.0) * 0.02;

  vec3 core = uCore * (0.22 + scan * 0.12 + meridians * 0.25);
  vec3 rim = uRim * fresnel * (1.15 + noise);

  float alpha = 0.26 + fresnel * 0.68 + meridians * 0.12;
  gl_FragColor = vec4(core + rim, alpha);
}
`;

function HologramGlobe() {
  const matRef = useRef<THREE.ShaderMaterial | null>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCore: { value: new THREE.Color('#061428') },
      uRim: { value: new THREE.Color('#67f3df') },
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
      <mesh scale={1.022}>
        <sphereGeometry args={[1, 40, 40]} />
        <meshBasicMaterial
          color="#8afbf0"
          wireframe
          transparent
          opacity={0.11}
          depthWrite={false}
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
      <pointLight position={[4, 2, 5]} intensity={0.85} color="#a5fff6" />
      <pointLight position={[-4, -1, 3]} intensity={0.45} color="#8090ff" />
      <HologramGlobe />
      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.056}
        minPolarAngle={Math.PI * 0.2}
        maxPolarAngle={Math.PI * 0.82}
        minDistance={1.65}
        maxDistance={4.8}
        autoRotate
        autoRotateSpeed={0.35}
      />
    </>
  );
}

export type HolographicEarthProps = {
  className?: string;
  /** Minimum height of the WebGL viewport */
  minHeight?: string;
};

export default function HolographicEarth({ className, minHeight = 'min-h-[220px] md:min-h-[280px]' }: HolographicEarthProps) {
  return (
    <div
      className={clsx(
        'relative w-full overflow-hidden rounded-2xl border border-cyan-400/20 bg-gradient-to-b from-slate-950/90 via-[#060d18]/85 to-slate-950/90 shadow-[0_0_40px_rgba(94,243,231,0.08)]',
        minHeight,
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_50%_30%,rgba(103,243,223,0.14),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/35 to-transparent" />
      <p className="pointer-events-none absolute left-3 top-2 z-10 text-[10px] uppercase tracking-[0.35em] text-cyan-200/55">
        Holographic link · drag
      </p>
      <Canvas
        className="h-full w-full"
        dpr={[1, 2]}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
        camera={{ position: [0, 0.15, 2.75], fov: 42 }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
