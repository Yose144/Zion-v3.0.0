/** @jsxRuntime classic */
'use client';

/**
 * Sky, image-based lighting and key light for the shared scenes.
 *
 * The sky is a shader dome (gradient + sun glow + cloud band + stars for night scenes).
 * The same sky is rendered into a PMREM environment once per mount, which gives every
 * PBR material a matching reflection without shipping an HDR file. `<KeyLight>` replaces
 * the hand-placed directional lights with one shadow-casting sun aligned to the dome.
 */

import { React, useFrame, useThree, THREE } from '@genesis/runtime';

import { quality } from './quality';

export type Vec3 = [number, number, number];

export interface SkyOptions {
  /** Direction from the target toward the sun (normalised internally). */
  sun?: Vec3;
  zenith?: string;
  horizon?: string;
  ground?: string;
  sunColor?: string;
  /** Higher = tighter sun disc. 220 is a hard sun, 60 a hazy one. */
  sunSharpness?: number;
  /** 0 = clear, 1 = overcast band. */
  clouds?: number;
  /** 0 = daylight, 1 = full star field. */
  stars?: number;
  /** Radiance multiplier for the sun disc inside the environment map. */
  sunPower?: number;
}

const DEFAULTS: Required<SkyOptions> = {
  sun: [-0.42, 0.3, -0.86],
  zenith: '#243b57',
  horizon: '#f3c088',
  ground: '#2a2a24',
  sunColor: '#ffd9a0',
  sunSharpness: 180,
  clouds: 0.25,
  stars: 0,
  sunPower: 9,
};

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vDir;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  uniform float uSharpness;
  uniform float uClouds;
  uniform float uStars;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }

  void main() {
    vec3 d = normalize(vDir);
    float up = max(d.y, 0.0);
    vec3 col = mix(uHorizon, uZenith, pow(up, 0.55));
    // Below the horizon fade into the ground haze instead of a hard seam.
    col = mix(col, uGround, smoothstep(0.02, -0.14, d.y));

    // Sun disc and halo.
    float sd = max(dot(d, uSunDir), 0.0);
    float disc = pow(sd, uSharpness) * 3.0;
    float halo = pow(sd, 8.0) * 0.35 + pow(sd, 2.0) * 0.06;
    col += uSunColor * (disc + halo);

    // Cloud band: only above the horizon, broken up by low-frequency noise.
    if (uClouds > 0.001) {
      vec3 p = d / max(abs(d.y) + 0.25, 0.05);
      float cl = noise(p * 1.6) * 0.6 + noise(p * 4.1) * 0.3 + noise(p * 9.0) * 0.1;
      cl = smoothstep(0.46, 0.74, cl) * smoothstep(0.0, 0.2, d.y) * uClouds;
      col = mix(col, mix(uHorizon, vec3(1.0), 0.6) + uSunColor * pow(sd, 6.0) * 0.55, cl * 1.25);
    }

    // Stars: quantised directions, brighter near the zenith.
    if (uStars > 0.001) {
      vec3 q = floor(d * 620.0);
      float s = hash(q);
      float twinkle = pow(s, 64.0) * 2.1;
      col += vec3(twinkle) * uStars * smoothstep(-0.02, 0.35, d.y) * (1.0 - uClouds * 0.7);
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

function skyMaterial(options: Required<SkyOptions>, forEnv: boolean): THREE.ShaderMaterial {
  const sunDir = new THREE.Vector3(...options.sun).normalize();
  const sunColor = new THREE.Color(options.sunColor).multiplyScalar(forEnv ? options.sunPower : 1);
  return new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: {
      uZenith: { value: new THREE.Color(options.zenith) },
      uHorizon: { value: new THREE.Color(options.horizon) },
      uGround: { value: new THREE.Color(options.ground) },
      uSunColor: { value: sunColor },
      uSunDir: { value: sunDir },
      uSharpness: { value: options.sunSharpness },
      uClouds: { value: options.clouds },
      uStars: { value: options.stars },
    },
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
}

/** Sky dome that follows the camera so it always covers the frame. */
export function SceneSky(props: SkyOptions) {
  const options = { ...DEFAULTS, ...props };
  const { camera, gl } = useThree();
  const material = React.useMemo(() => skyMaterial(options, false), [JSON.stringify(options)]);
  const geometry = React.useMemo(() => new THREE.SphereGeometry(1, 48, 32), []);
  const mesh = React.useRef<THREE.Mesh>(null);
  const radius = React.useMemo(() => {
    const far = (camera as THREE.PerspectiveCamera).far;
    return (Number.isFinite(far) && far > 10 ? far : 1000) * 0.86;
  }, [camera]);

  React.useEffect(() => {
    material.toneMapped = true;
    return () => {
      material.dispose();
      geometry.dispose();
    };
  }, [material, geometry]);

  useFrame(() => {
    const node = mesh.current;
    if (!node) return;
    node.position.copy(camera.position);
    node.scale.setScalar(radius);
  }, -1000);

  // The dome is unlit and drawn first; nothing else may be occluded by it.
  void gl;
  return <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} renderOrder={-1000} />;
}

export interface EnvironmentProps extends SkyOptions {
  /** Exponential fog colour; omit for clear air. */
  fog?: string;
  /** Fog density per world unit (0.0015 is a light haze at 200 units). */
  fogDensity?: number;
  /** How strongly the environment map lights materials. */
  envIntensity?: number;
}

/**
 * Sky dome + PMREM environment + optional fog. Mount once per scene, above the lights.
 * It does not add a sun light — pair it with `<KeyLight sun={...}>` so the shadow
 * direction matches the visible sun.
 */
export function SceneEnvironment({ fog, fogDensity = 0.0018, envIntensity = 1, ...skyProps }: EnvironmentProps) {
  const options = { ...DEFAULTS, ...skyProps };
  const { gl, scene } = useThree();

  React.useEffect(() => {
    const renderer = gl as THREE.WebGLRenderer & { isWebGPURenderer?: boolean };
    let target: THREE.WebGLRenderTarget | null = null;
    let envScene: THREE.Scene | null = null;
    let envMaterial: THREE.ShaderMaterial | null = null;
    let envGeometry: THREE.SphereGeometry | null = null;
    let sunGeometry: THREE.SphereGeometry | null = null;
    let sunMaterial: THREE.MeshBasicMaterial | null = null;
    const previousEnvironment = scene.environment;
    const previousIntensity = scene.environmentIntensity;
    const previousFog = scene.fog;

    // PMREM is a WebGL feature; the WebGPU path keeps its own lighting.
    if (!renderer.isWebGPURenderer) {
      try {
        envScene = new THREE.Scene();
        envGeometry = new THREE.SphereGeometry(10, 32, 24);
        envMaterial = skyMaterial(options, true);
        envScene.add(new THREE.Mesh(envGeometry, envMaterial));
        sunGeometry = new THREE.SphereGeometry(0.9, 16, 12);
        sunMaterial = new THREE.MeshBasicMaterial({
          color: new THREE.Color(options.sunColor).multiplyScalar(options.sunPower),
          toneMapped: false,
        });
        const sun = new THREE.Mesh(sunGeometry, sunMaterial);
        sun.position.copy(new THREE.Vector3(...options.sun).normalize().multiplyScalar(8));
        envScene.add(sun);
        const pmrem = new THREE.PMREMGenerator(renderer);
        target = pmrem.fromScene(envScene, 0.04, 0.1, 50);
        scene.environment = target.texture;
        scene.environmentIntensity = envIntensity;
        pmrem.dispose();
      } catch {
        // A renderer without PMREM support simply keeps the scene lights.
      }
    }

    if (fog) {
      scene.fog = new THREE.FogExp2(new THREE.Color(fog), fogDensity);
    }

    return () => {
      scene.environment = previousEnvironment;
      scene.environmentIntensity = previousIntensity;
      scene.fog = previousFog;
      target?.dispose();
      envGeometry?.dispose();
      sunGeometry?.dispose();
      envMaterial?.dispose();
      sunMaterial?.dispose();
    };
  }, [gl, scene, fog, fogDensity, envIntensity, JSON.stringify(options)]);

  return <SceneSky {...skyProps} />;
}

export interface KeyLightProps {
  sun?: Vec3;
  color?: string;
  intensity?: number;
  /** Orthographic shadow extent in world units. */
  extent?: number;
  /** Distance from the origin along the sun direction. */
  distance?: number;
  shadows?: boolean;
  shadowBias?: number;
}

/** One shadow-casting sun, aligned with `<SceneEnvironment sun>`. */
export function KeyLight({
  sun = DEFAULTS.sun,
  color = '#ffd2a1',
  intensity = 2.4,
  extent = 90,
  distance = 120,
  shadows = true,
  shadowBias = -0.0006,
}: KeyLightProps) {
  const qualitySettings = quality();
  const reflection = React.useRef<THREE.DirectionalLight>(null);
  const direction = React.useMemo(() => new THREE.Vector3(...sun).normalize(), [JSON.stringify(sun)]);
  const position = React.useMemo(() => direction.clone().multiplyScalar(distance), [direction, distance]);

  React.useLayoutEffect(() => {
    const light = reflection.current;
    if (!light) return;
    light.shadow.mapSize.set(qualitySettings.shadowMapSize, qualitySettings.shadowMapSize);
    light.shadow.bias = shadowBias;
    light.shadow.normalBias = 0.03;
    const camera = light.shadow.camera as THREE.OrthographicCamera;
    camera.left = -extent;
    camera.right = extent;
    camera.top = extent;
    camera.bottom = -extent;
    camera.near = 1;
    camera.far = distance * 2.4;
    camera.updateProjectionMatrix();
  }, [qualitySettings.shadowMapSize, extent, distance, shadowBias]);

  return (
    <directionalLight
      ref={reflection}
      position={position.toArray()}
      intensity={intensity}
      color={color}
      castShadow={shadows && qualitySettings.shadowRefreshHz > 0}
    />
  );
}

/** Soft bounce light from the ground half of the sky. */
export function SkyFill({ sky = '#bcd2e8', ground = '#6b5a44', intensity = 0.55 }: { sky?: string; ground?: string; intensity?: number }) {
  return <hemisphereLight args={[sky, ground, intensity]} />;
}
