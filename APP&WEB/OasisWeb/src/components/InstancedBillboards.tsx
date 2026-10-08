'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface BillboardInstance {
  position: [number, number, number];
  /** Billboard size in world units (x = width, y = height). */
  scale: [number, number];
  color: string;
  opacity?: number;
  /** Per-instance phase offset for rotation/pulse (radians). */
  phase?: number;
}

const VERT = /* glsl */ `
  attribute vec3 aOffset;
  attribute vec2 aScale;
  attribute vec3 aColor;
  attribute float aOpacity;
  attribute float aPhase;
  uniform float uTime;
  uniform float uPulse;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vOpacity;
  varying float vPhase;
  void main() {
    vUv = uv;
    vColor = aColor;
    vOpacity = aOpacity;
    vPhase = aPhase;
    // Camera right/up in world space = first two rows of the view matrix.
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec2 s = aScale * (1.0 + sin(uTime * 1.4 + aPhase) * 0.08 * uPulse);
    vec3 worldCenter = (modelMatrix * vec4(aOffset, 1.0)).xyz;
    vec3 world = worldCenter + right * position.x * s.x + up * position.y * s.y;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D map;
  uniform float uTime;
  uniform float uRotSpeed;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vOpacity;
  varying float vPhase;
  void main() {
    vec2 c = vUv - 0.5;
    float a = uTime * uRotSpeed + vPhase;
    float cs = cos(a), sn = sin(a);
    vec2 uv = vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs) + 0.5;
    vec4 tex = texture2D(map, uv);
    float alpha = tex.a * vOpacity;
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(vColor * tex.rgb, alpha);
  }
`;

/**
 * Screen-facing quads rendered as ONE instanced draw call — replaces
 * dozens of THREE.Sprite objects (star rays, distant galaxies, glows).
 * Per-instance offset/scale/color/opacity/phase via instanced attributes;
 * rotation + pulse run in-shader so there is no per-frame JS work.
 *
 * GLSL ShaderMaterial — WebGL2 path only (WebGPU uses node materials).
 */
export default function InstancedBillboards({
  texture,
  instances,
  rotationSpeed = 0,
  pulse = false,
  renderOrder,
}: {
  texture: THREE.Texture;
  instances: BillboardInstance[];
  /** UV rotation speed in rad/s (0 = static). */
  rotationSpeed?: number;
  /** Enable the ±8% scale pulse. */
  pulse?: boolean;
  renderOrder?: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1);
    const n = instances.length;
    const offsets = new Float32Array(n * 3);
    const scales = new Float32Array(n * 2);
    const colors = new Float32Array(n * 3);
    const opacities = new Float32Array(n);
    const phases = new Float32Array(n);
    const col = new THREE.Color();
    instances.forEach((inst, i) => {
      offsets.set(inst.position, i * 3);
      scales.set(inst.scale, i * 2);
      col.set(inst.color);
      colors.set([col.r, col.g, col.b], i * 3);
      opacities[i] = inst.opacity ?? 1;
      phases[i] = inst.phase ?? 0;
    });
    geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
    geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 2));
    geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));
    geo.setAttribute('aOpacity', new THREE.InstancedBufferAttribute(opacities, 1));
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
    return geo;
  }, [instances]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          map: { value: texture },
          uTime: { value: 0 },
          uRotSpeed: { value: rotationSpeed },
          uPulse: { value: pulse ? 1 : 0 },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [texture, rotationSpeed, pulse]
  );

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
  });

  if (instances.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, instances.length]}
      frustumCulled={false}
      raycast={() => null}
      renderOrder={renderOrder}
    />
  );
}
