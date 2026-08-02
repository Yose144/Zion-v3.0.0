'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface WarpGateVortexProps {
  color: string;
  size: number;
  active?: boolean;
}

export default function WarpGateVortex({ color, size, active = false }: WarpGateVortexProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useRef({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(color) },
    uIntensity: { value: active ? 0.85 : 0.45 },
  });

  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      materialRef.current.uniforms.uIntensity.value +=
        ((active ? 0.85 : 0.45) - materialRef.current.uniforms.uIntensity.value) * 0.05;
    }
    if (meshRef.current) {
      meshRef.current.rotation.z += (active ? 0.03 : 0.01) * delta;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <circleGeometry args={[size * 1.7, 32]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms.current}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform vec3 uColor;
          uniform float uIntensity;
          varying vec2 vUv;

          void main() {
            vec2 p = vUv - 0.5;
            float r = length(p);
            float a = atan(p.y, p.x);

            float spiral = sin(a * 9.0 + r * 24.0 - uTime * 3.2);
            float rings = sin(r * 28.0 - uTime * 1.8);
            float pattern = (spiral * 0.6 + rings * 0.3) * 0.5 + 0.5;

            float mask = smoothstep(0.48, 0.05, r);
            float core = smoothstep(0.15, 0.0, r);

            float alpha = (pattern * mask + core) * uIntensity;

            gl_FragColor = vec4(uColor, alpha);
          }
        `}
      />
    </mesh>
  );
}
