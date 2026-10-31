/** @jsxRuntime classic */
'use client';

/**
 * Post-processing chain for the project scenes.
 *
 * Deliberately self-contained: the shared scenes are bundled into two applications from
 * outside their package roots, so importing `three/addons/*` here would only resolve in
 * the app that happens to own a `three` install. Instead the chain is a small HDR
 * composer built on the renderer API:
 *
 *   scene → HDR target (MSAA) → bright pass → two blur levels → composite
 *
 * The composite does bloom, saturation lift, vignette, grain, ACES tone mapping and the
 * sRGB transfer in one pass. Everything runs at half/quarter resolution except the scene.
 */

import { React, useFrame, useThree, THREE } from '../../runtime';

const FULLSCREEN_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const BRIGHT_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tSrc;
  uniform float uThreshold;
  uniform float uKnee;
  void main() {
    vec3 color = texture2D(tSrc, vUv).rgb;
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    // Soft knee: no hard cut-off banding around bright edges.
    float weight = smoothstep(uThreshold, uThreshold + uKnee, luma);
    gl_FragColor = vec4(color * weight, 1.0);
  }
`;

const COPY_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tSrc;
  void main() {
    gl_FragColor = vec4(texture2D(tSrc, vUv).rgb, 1.0);
  }
`;

const BLUR_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tSrc;
  uniform vec2 uDirection;
  void main() {
    // 9-tap gaussian, linear-sampled between taps.
    vec3 sum = texture2D(tSrc, vUv).rgb * 0.2270270270;
    vec2 step0 = uDirection * 1.3846153846;
    vec2 step1 = uDirection * 3.2307692308;
    sum += texture2D(tSrc, vUv + step0).rgb * 0.3162162162;
    sum += texture2D(tSrc, vUv - step0).rgb * 0.3162162162;
    sum += texture2D(tSrc, vUv + step1).rgb * 0.0702702703;
    sum += texture2D(tSrc, vUv - step1).rgb * 0.0702702703;
    gl_FragColor = vec4(sum, 1.0);
  }
`;

const COMPOSITE_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tScene;
  uniform sampler2D tBloomNear;
  uniform sampler2D tBloomFar;
  uniform float uBloom;
  uniform float uThreshold;
  uniform float uVignette;
  uniform float uGrain;
  uniform float uSaturation;
  uniform float uExposure;
  uniform float uTime;
  uniform vec3 uLift;

  // Narkowicz's ACES filmic curve; cheap and keeps highlights on the shoulder.
  vec3 aces(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  }

  vec3 linearToSRGB(vec3 c) {
    return mix(1.055 * pow(max(c, 0.0), vec3(0.41666667)) - 0.055, c * 12.92, step(c, vec3(0.0031308)));
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec3 color = texture2D(tScene, vUv).rgb;
    vec3 bloom = texture2D(tBloomNear, vUv).rgb * 0.62 + texture2D(tBloomFar, vUv).rgb * 0.38;
    color += bloom * uBloom;

    // Grade: luma-preserving saturation, cool shadows, warm highlights.
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(vec3(luma), color, uSaturation);
    color += uLift * (1.0 - smoothstep(0.0, 0.35, luma)) * 0.3;
    color *= 1.0 + smoothstep(0.55, 1.0, luma) * 0.05;

    // Vignette.
    vec2 centered = vUv - 0.5;
    float vignette = smoothstep(0.85, 0.2, length(centered) * 1.15);
    color *= mix(1.0, vignette, uVignette);

    // Film grain at a fixed 24 fps cadence so screenshots stay comparable.
    float t = floor(uTime * 24.0);
    color += (hash(vUv * 1024.0 + t) - 0.5) * uGrain;

    color = aces(max(color, 0.0) * uExposure);
    gl_FragColor = vec4(linearToSRGB(color), 1.0);
  }
`;

/** Scene-only render counters; the composer's full-screen passes would otherwise mask them. */
export const sceneRenderStats = { calls: 0, triangles: 0 };

export interface ScenePostProps {
  bloom?: number;
  threshold?: number;
  vignette?: number;
  grain?: number;
  saturation?: number;
  exposure?: number;
  /** MSAA samples for the HDR scene target (0 disables). */
  samples?: number;
}

interface Targets {
  scene: THREE.WebGLRenderTarget;
  bright: THREE.WebGLRenderTarget;
  blurA: THREE.WebGLRenderTarget;
  blurB: THREE.WebGLRenderTarget;
  quarterA: THREE.WebGLRenderTarget;
  quarterB: THREE.WebGLRenderTarget;
}

function makeTarget(width: number, height: number, options: { samples?: number } = {}): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)), {
    type: THREE.HalfFloatType,
    depthBuffer: true,
    samples: options.samples ?? 0,
  });
  target.texture.minFilter = THREE.LinearFilter;
  target.texture.magFilter = THREE.LinearFilter;
  target.texture.generateMipmaps = false;
  return target;
}

function buildTargets(width: number, height: number, samples: number): Targets {
  return {
    scene: makeTarget(width, height, { samples }),
    bright: makeTarget(width / 2, height / 2),
    blurA: makeTarget(width / 2, height / 2),
    blurB: makeTarget(width / 2, height / 2),
    quarterA: makeTarget(width / 4, height / 4),
    quarterB: makeTarget(width / 4, height / 4),
  };
}

/**
 * Render pipeline. Mount once per canvas; it takes over rendering (priority 1), so the
 * default R3F render is skipped and this composer owns the frame.
 */
export function ScenePost({
  bloom = 0.5,
  threshold = 0.85,
  vignette = 0.5,
  grain = 0.014,
  saturation = 1.06,
  exposure = 1,
  samples = 4,
}: ScenePostProps) {
  const { gl, scene, camera, size } = useThree();
  const resolve = React.useMemo(() => {
    const renderer = gl as THREE.WebGLRenderer & { isWebGPURenderer?: boolean };
    if (renderer.isWebGPURenderer) return null;

    const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadScene = new THREE.Scene();
    const quadGeometry = new THREE.PlaneGeometry(2, 2);
    const quad = new THREE.Mesh(quadGeometry, new THREE.MeshBasicMaterial()) as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
    quad.frustumCulled = false;
    quadScene.add(quad);
    const copyMaterial = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: COPY_FRAG,
      uniforms: { tSrc: { value: null } },
      depthTest: false,
      depthWrite: false,
    });

    const brightMaterial = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: BRIGHT_FRAG,
      uniforms: { tSrc: { value: null }, uThreshold: { value: threshold }, uKnee: { value: 0.25 } },
      depthTest: false,
      depthWrite: false,
    });
    const blurMaterial = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: BLUR_FRAG,
      uniforms: { tSrc: { value: null }, uDirection: { value: new THREE.Vector2() } },
      depthTest: false,
      depthWrite: false,
    });
    const compositeMaterial = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: COMPOSITE_FRAG,
      uniforms: {
        tScene: { value: null },
        tBloomNear: { value: null },
        tBloomFar: { value: null },
        uBloom: { value: bloom },
        uThreshold: { value: threshold },
        uVignette: { value: vignette },
        uGrain: { value: grain },
        uSaturation: { value: saturation },
        uExposure: { value: exposure },
        uTime: { value: 0 },
        uLift: { value: new THREE.Color('#0a0d12') },
      },
      depthTest: false,
      depthWrite: false,
    });

    const draw = (material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
      quad.material = material;
      renderer.setRenderTarget(target);
      renderer.render(quadScene, quadCamera);
    };

    return { renderer, quadScene, quadCamera, quad, quadGeometry, brightMaterial, blurMaterial, copyMaterial, compositeMaterial, draw };
  }, [gl, bloom, threshold, vignette, grain, saturation, exposure]);

  const targets = React.useRef<Targets | null>(null);

  React.useEffect(() => {
    if (!resolve) return;
    const buffer = resolve.renderer.getDrawingBufferSize(new THREE.Vector2());
    targets.current = buildTargets(buffer.x || size.width, buffer.y || size.height, samples);
    return () => {
      const current = targets.current;
      if (!current) return;
      for (const target of Object.values(current)) target.dispose();
      targets.current = null;
    };
  }, [resolve, size.width, size.height, samples]);

  React.useEffect(() => {
    if (!resolve) return;
    const material = resolve.compositeMaterial;
    material.uniforms.uBloom.value = bloom;
    material.uniforms.uThreshold.value = threshold;
    material.uniforms.uVignette.value = vignette;
    material.uniforms.uGrain.value = grain;
    material.uniforms.uSaturation.value = saturation;
    material.uniforms.uExposure.value = exposure;
  }, [resolve, bloom, threshold, vignette, grain, saturation, exposure]);

  React.useEffect(() => {
    if (!resolve) return;
    return () => {
      resolve.quadGeometry.dispose();
      resolve.brightMaterial.dispose();
      resolve.blurMaterial.dispose();
      resolve.copyMaterial.dispose();
      resolve.compositeMaterial.dispose();
    };
  }, [resolve]);

  useFrame((state) => {
    if (!resolve || !targets.current) return;
    const { renderer, draw, copyMaterial, brightMaterial, blurMaterial, compositeMaterial } = resolve;
    const current = targets.current;

    // 1. Scene into the HDR target. Tone mapping stays off for render targets.
    renderer.setRenderTarget(current.scene);
    renderer.clear();
    renderer.render(scene, camera);
    sceneRenderStats.calls = renderer.info.render.calls;
    sceneRenderStats.triangles = renderer.info.render.triangles;

    // 2. Bright pass at half resolution, then a separable blur.
    brightMaterial.uniforms.tSrc.value = current.scene.texture;
    draw(brightMaterial, current.bright);
    blurMaterial.uniforms.tSrc.value = current.bright.texture;
    blurMaterial.uniforms.uDirection.value.set(1 / current.bright.width, 0);
    draw(blurMaterial, current.blurA);
    blurMaterial.uniforms.tSrc.value = current.blurA.texture;
    blurMaterial.uniforms.uDirection.value.set(0, 1 / current.bright.height);
    draw(blurMaterial, current.blurB);

    // 3. Wider, softer level at quarter resolution for the halo.
    copyMaterial.uniforms.tSrc.value = current.blurB.texture;
    draw(copyMaterial, current.quarterA);
    blurMaterial.uniforms.tSrc.value = current.quarterA.texture;
    blurMaterial.uniforms.uDirection.value.set(1 / current.quarterA.width, 0);
    draw(blurMaterial, current.quarterB);
    blurMaterial.uniforms.tSrc.value = current.quarterB.texture;
    blurMaterial.uniforms.uDirection.value.set(0, 1 / current.quarterA.height);
    draw(blurMaterial, current.quarterA);

    // 4. Composite to the canvas.
    compositeMaterial.uniforms.tScene.value = current.scene.texture;
    compositeMaterial.uniforms.tBloomNear.value = current.blurB.texture;
    compositeMaterial.uniforms.tBloomFar.value = current.quarterA.texture;
    compositeMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    draw(compositeMaterial, null);
  }, 1);

  return null;
}
