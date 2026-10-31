/** @jsxRuntime classic */
'use client';

/**
 * Drifting motes: pollen, dust, snow or embers.
 *
 * One `Points` object, animated entirely in the vertex shader — the CPU uploads positions
 * once and never touches them again. Motion freezes under `prefers-reduced-motion`.
 */

import { React, useFrame, THREE } from '../../runtime';

export interface SceneMotesProps {
  count?: number;
  /** Horizontal area the motes occupy. */
  area?: [number, number];
  height?: number;
  /** Vertical drift speed in units per second. */
  speed?: number;
  size?: number;
  color?: string;
  opacity?: number;
  /** Horizontal sway amplitude. */
  sway?: number;
  /** Vertical offset of the volume. */
  level?: number;
  seed?: number;
}

const VERT = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uHeight;
  uniform float uSpeed;
  uniform float uSway;
  uniform float uSize;
  varying float vFade;

  void main() {
    vec3 p = position;
    // Wrap the fall so the volume never empties.
    float fall = mod(position.y * 0.0 + aSeed * uHeight + uTime * uSpeed, uHeight);
    p.y = fall - uHeight * 0.5;
    p.x += sin(uTime * 0.35 + aSeed * 6.2831) * uSway;
    p.z += cos(uTime * 0.27 + aSeed * 4.1) * uSway * 0.6;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (260.0 / max(-mv.z, 1.0));
    vFade = smoothstep(0.0, 0.15, fall / uHeight) * smoothstep(1.0, 0.85, fall / uHeight);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.05, d) * uOpacity * vFade;
    gl_FragColor = vec4(uColor, a);
  }
`;

export function SceneMotes({
  count = 220,
  area = [80, 80],
  height = 24,
  speed = 0.35,
  size = 2.2,
  color = '#ffe8c0',
  opacity = 0.5,
  sway = 1.4,
  level = 0,
  seed = 1,
}: SceneMotesProps) {
  const geometry = React.useMemo(() => {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    let value = seed * 9301 + 49297;
    const random = () => {
      value = (value * 9301 + 49297) % 233280;
      return value / 233280;
    };
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (random() - 0.5) * area[0];
      positions[i * 3 + 1] = random() * height;
      positions[i * 3 + 2] = (random() - 0.5) * area[1];
      seeds[i] = random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    return geometry;
  }, [count, area, height, seed]);

  const material = React.useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uTime: { value: 0 },
          uHeight: { value: height },
          uSpeed: { value: speed },
          uSway: { value: sway },
          uSize: { value: size },
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: opacity },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [height, speed, sway, size, color, opacity],
  );

  const still = React.useRef(false);
  React.useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { still.current = query.matches; };
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  React.useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame((_, delta) => {
    if (still.current) return;
    material.uniforms.uTime.value += Math.min(delta, 0.05);
  });

  return <points geometry={geometry} material={material} position={[0, level + height / 2, 0]} frustumCulled={false} />;
}
