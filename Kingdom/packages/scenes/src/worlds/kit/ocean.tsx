/** @jsxRuntime classic */
'use client';

/**
 * One ocean for every sea scene.
 *
 * `AtlanticOcean` (Dharma Temple, Boa Esperança, Tres Marias) used its own shader with its
 * own palette, while the pools used `SceneWater`. This is the single sea implementation:
 * three scrolling wave bands from procedural slopes (no texture tiling at 2 km), Fresnel
 * toward the sky colour, sun glitter, optional surf foam and a shoreline term.
 *
 * The fragment output is linear; the composer tone maps it.
 */

import { React, useFrame, THREE } from '../../runtime';

import { ripple as rippleMap, tiled } from './textures';

export interface OceanSurfaceProps {
  /** `sea` uses procedural wave trains; `pool` samples a tiling ripple normal map. */
  mode?: 'sea' | 'pool';
  /** Ripple strength for `pool` mode. */
  ripple?: number;
  /** Ripple map tiling for `pool` mode. */
  rippleRepeat?: number;
  /** Circular sheet instead of a square (pools, ponds). */
  circle?: boolean;
  /** Explicit rectangle; `size` stays the square default. */
  width?: number;
  depth?: number;
  level?: number;
  /** Plane size in world units. */
  size?: number;
  /** Sky colour the water reflects at grazing angles. */
  sky?: string;
  deep?: string;
  shallow?: string;
  /** Direction toward the sun. */
  sun?: [number, number, number];
  sunColor?: string;
  /** Wave amplitude multiplier; storms use ~2. */
  roughness?: number;
  /** Adds surf foam along the shoreline term. */
  foam?: boolean;
  /** Tropical palette for lagoons. */
  lagoon?: boolean;
  /** Shoreline: `z = shoreBase - max(x - shoreStart, 0) * shoreSlope + sin(x * 0.12) * 2.5`. */
  shoreBase?: number;
  shoreStart?: number;
  shoreSlope?: number;
  /** Freezes the animation (reduced motion). */
  frozen?: boolean;
  segments?: number;
}

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uRoughness;
  varying vec3 vWorld;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 p = position;
    // Only the sea displaces geometry; a pool is a flat sheet with a ripple normal.
    p.z += (sin(p.x * 0.17 + uTime * 0.55) * 0.035 + sin(p.y * 0.23 - uTime * 0.42) * 0.025) * uRoughness;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uRoughness;
  uniform vec3 uSky;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uFoam;
  uniform float uLagoon;
  uniform vec3 uShore;   // x = enabled, y = base, z = start
  uniform float uSlope;
  uniform float uMode;
  uniform sampler2D uRipple;
  uniform float uRippleRepeat;
  uniform float uRippleStrength;
  uniform vec2 uRippleOffset;
  varying vec3 vWorld;
  varying vec2 vUv;

  // Slope of three crossing wave trains; cheap and stable at any distance.
  vec3 waveSlope(vec2 p, float t) {
    float a = p.x * 0.23 + p.y * 0.39 + sin(p.x * 0.11 - p.y * 0.13) * 1.5 + t * 0.6;
    float b = p.x * -0.37 + p.y * 0.17 + sin(p.y * 0.19) * 0.9 - t * 0.42;
    float c = p.x * 0.09 + p.y * -0.28 + sin(p.x * 0.05 + p.y * 0.07) * 2.1 + t * 0.31;
    float attenuation = 1.0 / (1.0 + length(fwidth(p)) * 0.8);
    return vec3(
      (cos(a) * 0.05 - cos(b) * 0.038 + cos(c) * 0.02) * attenuation * uRoughness,
      1.0,
      (cos(a) * 0.042 + cos(b) * 0.06 - cos(c) * 0.028) * attenuation * uRoughness
    );
  }

  void main() {
    vec2 p = vWorld.xz;
    vec3 n;
    if (uMode > 0.5) {
      // Pool: two scrolling samples of a tiling ripple normal map.
      vec2 base = vUv * uRippleRepeat;
      vec3 n1 = texture2D(uRipple, base + uRippleOffset).xyz * 2.0 - 1.0;
      vec3 n2 = texture2D(uRipple, base * 0.73 - uRippleOffset * 0.6).xyz * 2.0 - 1.0;
      n = normalize(vec3((n1.x + n2.x) * uRippleStrength, 1.0, (n1.z + n2.z) * uRippleStrength));
    } else {
      n = normalize(waveSlope(p, uTime));
    }
    vec3 viewDir = normalize(cameraPosition - vWorld);

    float facing = clamp(dot(n, viewDir), 0.0, 1.0);
    float fresnel = pow(1.0 - facing, 3.0);

    float distanceFade = smoothstep(90.0, 700.0, length(cameraPosition.xz - p));

    // Shoreline: only where the scene asked for one.
    float shore = uShore.y - max(p.x - uShore.z, 0.0) * uSlope + sin(p.x * 0.12) * 2.5;
    float nearShore = exp(-abs(p.y - shore + 2.4) * 0.38) * uShore.x;

    vec3 body = mix(uDeep, uShallow, nearShore * 0.75);
    // Lagoons brighten toward the beach.
    body = mix(body, mix(uDeep * 1.4, uShallow * 1.6, 0.6), uLagoon * exp(-max(shore - p.y, 0.0) * 0.045));

    vec3 color = mix(body, uSky * 0.55, fresnel * 0.7);

    // Sun glitter.
    vec3 halfDir = normalize(uSunDir + viewDir);
    float glare = pow(max(dot(n, halfDir), 0.0), 220.0);
    color += uSunColor * glare * 1.6;

    // Surf only near the shore; the rest of the sea stays clean.
    if (uFoam > 0.001) {
      float bands = smoothstep(0.62, 0.95, sin(p.y * 3.0 + sin(p.x * 0.6) - uTime * 0.65));
      float surf = nearShore * bands * 0.16;
      color += vec3(0.62, 0.72, 0.7) * surf * uFoam;
    }

    color = mix(color, uSky * 0.42, distanceFade * 0.55);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function OceanSurface({
  level = -1.8,
  size = 2800,
  sky = '#9fb6cc',
  deep = '#04141c',
  shallow = '#0a3b45',
  sun = [-0.75, 0.08, -0.66],
  sunColor = '#ffcf8a',
  roughness = 1,
  foam = false,
  lagoon = false,
  shoreBase = -23,
  shoreStart = 8,
  shoreSlope = 0.65,
  frozen = false,
  segments = 100,
  mode = 'sea',
  ripple = 0.5,
  rippleRepeat = 4,
  circle = false,
  width,
  depth,
}: OceanSurfaceProps) {
  const material = React.useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uTime: { value: 0 },
          uRoughness: { value: roughness },
          uSky: { value: new THREE.Color(sky) },
          uDeep: { value: new THREE.Color(deep) },
          uShallow: { value: new THREE.Color(shallow) },
          uSunDir: { value: new THREE.Vector3(...sun).normalize() },
          uSunColor: { value: new THREE.Color(sunColor) },
          uFoam: { value: foam ? 1 : 0 },
          uLagoon: { value: lagoon ? 1 : 0 },
          uShore: { value: new THREE.Vector3(shoalEnabled(foam, lagoon), shoreBase, shoreStart) },
          uSlope: { value: shoreSlope },
          uMode: { value: mode === 'pool' ? 1 : 0 },
          uRipple: { value: mode === 'pool' ? tiled(rippleMap(256).normalMap, 1) : null },
          uRippleRepeat: { value: Math.max(1, rippleRepeat) },
          uRippleStrength: { value: ripple },
          uRippleOffset: { value: new THREE.Vector2(0, 0) },
        },
      }),
    [sky, deep, shallow, sun, sunColor, roughness, foam, lagoon, shoreBase, shoreStart, shoreSlope, mode, ripple, rippleRepeat],
  );

  React.useEffect(() => () => {
    const rippleTexture = material.uniforms.uRipple.value as THREE.Texture | null;
    rippleTexture?.dispose();
    material.dispose();
  }, [material]);

  // Wave motion respects the same reduced-motion preference as the rest of the scenes.
  const still = React.useRef(frozen);
  React.useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { still.current = frozen || query.matches; };
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [frozen]);

  useFrame((_, delta) => {
    if (still.current) return;
    material.uniforms.uTime.value += Math.min(delta, 0.05);
    if (mode === 'pool') {
      const offset = material.uniforms.uRippleOffset.value as THREE.Vector2;
      const t = material.uniforms.uTime.value;
      offset.set(t * 0.012, t * 0.026);
    }
  });

  return (
    <mesh position={[0, level, 0]} rotation={[-Math.PI / 2, 0, 0]} material={material}>
      {circle ? (
        <circleGeometry args={[(width ?? size) / 2, 72]} />
      ) : (
        <planeGeometry args={[width ?? size, depth ?? size, segments, segments]} />
      )}
    </mesh>
  );
}

/** A shoreline term only exists where surf or lagoon colouring needs one. */
function shoalEnabled(foam: boolean, lagoon: boolean): number {
  return foam || lagoon ? 1 : 0;
}
