'use client';

import { useEffect, useRef } from 'react';
import clsx from 'clsx';
// Three.js se tahá dynamicky až po mountu (viz níže), takže v type pozicích
// není namespace `THREE` k dispozici — typy bereme z type-only importu.
import type * as THREE_NS from 'three';

/**
 * HiranUniverse — živá 3D scéna „Hiranyagarbha ve vesmíru" pro homepage.
 *
 * Port scény z `infra/maintenance/index.html` (maintenance stránka
 * kingdom.zionterranova.com): zlatý orb nad lotosem, Mléčná dráha (ESO
 * panorama), třpytivé hvězdy, mlhovina, zlatý prach a Śrí jantra pečeť —
 * tohle je ten „nový Hiran", který nahradil starý HiranOrb.
 *
 * Raw Three.js (ne R3F): scéna potřebuje EffectComposer + UnrealBloom,
 * což v R3F vyžaduje extra balíček. Three.js se tahá dynamicky až po
 * mountu — do hlavního bundlu se nedostane.
 *
 * Respektuje: WebGL check (volá lazy wrapper), reduced-motion (wrapper
 * ji nezavěsí), IntersectionObserver pauzu mimo obrazovku, plný cleanup.
 */

const TEX_URL = '/textures/milkyway-eso-4k.jpg';
const FOV = 42;

/* Śrí jantra — přesná konstrukce (viz infra/maintenance/index.html). */
const YANTRA: ReadonlyArray<readonly [number, number, number]> = [
  [-0.074, 0.72996863, 0.4641715],
  [-0.63144373, 0.55404752, 0.6615825],
  [-1, 0.336, 0.94186199],
  [-0.4853454, 0.21601242, 0.3088074],
  [-0.204, 0.10372162, 0.2230597],
  [0.55404752, -0.074, 0.31109046],
  [1, -0.204, 0.97897089],
  [0.72996863, -0.4853454, 0.73021391],
  [0.336, -0.63144373, 0.42736264],
];

type Three = typeof import('three');
type Post = {
  EffectComposer: typeof import('three/addons/postprocessing/EffectComposer.js').EffectComposer;
  RenderPass: typeof import('three/addons/postprocessing/RenderPass.js').RenderPass;
  UnrealBloomPass: typeof import('three/addons/postprocessing/UnrealBloomPass.js').UnrealBloomPass;
  OutputPass: typeof import('three/addons/postprocessing/OutputPass.js').OutputPass;
};

async function loadThree(): Promise<{ THREE: Three; Post: Post } | null> {
  try {
    const THREE = await import('three');
    const [EffectComposer, RenderPass, UnrealBloomPass, OutputPass] = await Promise.all([
      import('three/addons/postprocessing/EffectComposer.js'),
      import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/UnrealBloomPass.js'),
      import('three/addons/postprocessing/OutputPass.js'),
    ]);
    return {
      THREE,
      Post: {
        EffectComposer: EffectComposer.EffectComposer,
        RenderPass: RenderPass.RenderPass,
        UnrealBloomPass: UnrealBloomPass.UnrealBloomPass,
        OutputPass: OutputPass.OutputPass,
      },
    };
  } catch (err) {
    console.warn('HiranUniverse: three.js/postprocessing unavailable:', err);
    return null;
  }
}

export type HiranUniverseProps = {
  className?: string;
  textureUrl?: string;
  /** true = render smyčka běží; false = pauza (mimo obrazovky) */
  active?: boolean;
};

export default function HiranUniverse({ className, textureUrl = TEX_URL, active = true }: HiranUniverseProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;

    let disposed = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      const loaded = await loadThree();
      if (!loaded || disposed) return;
      const { THREE, Post } = loaded;
      cleanup = mountScene(THREE, Post, canvas, box, textureUrl, () => activeRef.current);
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
    // scéna se nestaví znovu — textureUrl/active se řeší uvnitř
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={boxRef} className={clsx('relative h-full w-full overflow-hidden bg-[#040308]', className)}>
      <canvas ref={canvasRef} className="block h-full w-full" aria-label="Hiran — Hiranyagarbha ve vesmíru" />
    </div>
  );
}

/* ─── scéna ─────────────────────────────────────────────────────────── */

function mountScene(
  THREE: Three,
  Post: Post,
  canvas: HTMLCanvasElement,
  box: HTMLElement,
  textureUrl: string,
  isActive: () => boolean,
): () => void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x040308);

  const ownedTextures: THREE_NS.Texture[] = [];
  const track = <T extends THREE_NS.Texture>(t: T): T => {
    ownedTextures.push(t);
    return t;
  };

  /* Mléčná dráha — ESO all-sky panorama, částečná kopule přes galaktické jádro. */
  const texLoader = new THREE.TextureLoader();
  let alive = true;
  texLoader.load(textureUrl, (t) => {
    if (!alive) {
      t.dispose();
      return;
    }
    ownedTextures.push(t);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(90, 96, 48, -Math.PI, Math.PI, 0.556, 1.75),
      new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, depthWrite: false })
    );
    (dome.material as THREE_NS.MeshBasicMaterial).color.setScalar(0.72);
    dome.renderOrder = -1;
    dome.rotation.z = -0.3;
    scene.add(dome);
  });
  scene.fog = new THREE.FogExp2(0x040308, 0.02);

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
  const camBase = new THREE.Vector3(0, 2.0, 8.0);
  camera.position.copy(camBase);

  /* světla */
  scene.add(new THREE.AmbientLight(0x2e2517, 1.6));
  const orbLight = new THREE.PointLight(0xffc14d, 34, 0, 2);
  orbLight.position.set(0, 1.72, 0);
  scene.add(orbLight);
  const rim = new THREE.DirectionalLight(0x8fb8ff, 0.5);
  rim.position.set(-6, 5, -4);
  scene.add(rim);

  /* ── textury generované na canvas ── */
  const glowTexture = (inner = 'rgba(255,214,107,1)', mid = 'rgba(251,191,36,0.35)') => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, inner);
    g.addColorStop(0.35, mid);
    g.addColorStop(1, 'rgba(251,191,36,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const t = track(new THREE.CanvasTexture(c));
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const dotTexture = () => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,240,200,1)');
    g.addColorStop(0.4, 'rgba(252,209,22,0.6)');
    g.addColorStop(1, 'rgba(252,209,22,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const t = track(new THREE.CanvasTexture(c));
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const yantraTexture = (size = 1024) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    const S = size / 2.56;
    const X = (x: number) => size / 2 + x * S;
    const Y = (y: number) => size / 2 - y * S;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [wpx, col] of [[size * 0.011, 'rgba(255,190,60,0.30)'], [size * 0.0052, 'rgba(255,236,185,1)']] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = wpx;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, S, 0, Math.PI * 2);
      for (const [a, b, w] of YANTRA) {
        ctx.moveTo(X(-w), Y(b));
        ctx.lineTo(X(w), Y(b));
        ctx.lineTo(X(0), Y(a));
        ctx.closePath();
      }
      ctx.stroke();
    }
    const bg = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.03);
    bg.addColorStop(0, 'rgba(255,250,230,1)');
    bg.addColorStop(0.45, 'rgba(255,220,120,0.9)');
    bg.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.03, 0, Math.PI * 2);
    ctx.fill();
    const t = track(new THREE.CanvasTexture(c));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  const rayTexture = () => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 256, 0, 0);
    g.addColorStop(0, 'rgba(255,220,130,0.55)');
    g.addColorStop(0.45, 'rgba(255,210,110,0.22)');
    g.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 256);
    const gx = ctx.createLinearGradient(0, 0, 64, 0);
    gx.addColorStop(0, 'rgba(0,0,0,1)');
    gx.addColorStop(0.5, 'rgba(0,0,0,0)');
    gx.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = gx;
    ctx.fillRect(0, 0, 64, 256);
    const t = track(new THREE.CanvasTexture(c));
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const petalGeometry = (length: number, width: number) => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(width, length * 0.28, width * 0.76, length * 0.78, 0, length);
    shape.bezierCurveTo(-width * 0.76, length * 0.78, -width, length * 0.28, 0, 0);
    const g = new THREE.ShapeGeometry(shape, 12);
    g.rotateX(-Math.PI / 2);
    g.rotateY(-Math.PI / 2);
    return g;
  };

  /* ── hvězdy — dvouvrstvé třpytivé pole ── */
  const starUniforms = { uTime: { value: 0 } };
  const starField = (n: number, rMin: number, rMax: number, sizeMul: number) => {
    const pos = new Float32Array(n * 3);
    const phase = new Float32Array(n);
    const size = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = rMin + Math.random() * (rMax - rMin);
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = Math.abs(r * Math.cos(ph)) * 0.85 - 4;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      phase[i] = Math.random() * Math.PI * 2;
      size[i] = (0.5 + Math.random()) * sizeMul;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: starUniforms,
      vertexShader: `
        attribute float aPhase; attribute float aSize;
        uniform float uTime;
        varying float vTw;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float tw = 0.82 + 0.18 * sin(uTime * (0.5 + fract(aPhase) * 0.9) + aPhase * 7.0);
          vTw = tw;
          float dist = -mv.z;
          gl_PointSize = dist > 0.5 ? aSize * (0.9 + 0.1 * tw) * 150.0 / dist : 0.0;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vTw;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv) * 2.0;
          float a = smoothstep(1.0, 0.3, d) * vTw * 0.85;
          vec3 col = mix(vec3(1.0, 0.93, 0.78), vec3(1.0, 0.82, 0.45), d);
          gl_FragColor = vec4(col, a);
        }`,
    });
    return new THREE.Points(g, m);
  };
  const stars = starField(700, 42, 80, 4.2);
  const starsFar = starField(500, 70, 110, 3.2);
  scene.add(stars, starsFar);

  /* mlhovina */
  const nebTex = glowTexture('rgba(99,52,237,0.5)', 'rgba(99,52,237,0.12)');
  for (const [x, y, z, s, o] of [[-14, 7, -30, 34, 0.08], [12, 9, -34, 30, 0.06]] as const) {
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: nebTex, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    sp.position.set(x, y, z);
    sp.scale.setScalar(s);
    scene.add(sp);
  }

  /* ── LOTOS ── */
  const lotus = new THREE.Group();
  lotus.position.y = -0.55;
  scene.add(lotus);

  const petalMat = new THREE.MeshStandardMaterial({
    color: 0xfff1d8,
    roughness: 0.5,
    metalness: 0.08,
    emissive: 0x241804,
    side: THREE.DoubleSide,
  });
  const petalEdge = new THREE.MeshStandardMaterial({
    color: 0xc99a43,
    roughness: 0.45,
    metalness: 0.35,
    side: THREE.DoubleSide,
  });
  const petalRing = (count: number, radius: number, tilt: number, len: number, wid: number, mat: THREE_NS.Material, y = 0) => {
    const geo = petalGeometry(len, wid);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const p = new THREE.Mesh(geo, mat);
      p.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius);
      p.rotation.set(0, -a, tilt);
      lotus.add(p);
    }
  };
  petalRing(12, 1.12, 0.84, 2.05, 0.78, petalMat);
  petalRing(10, 0.86, 0.55, 1.55, 0.6, petalMat, 0.07);
  petalRing(8, 0.56, 0.32, 1.05, 0.44, petalEdge, 0.14);
  const bud = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 18), petalMat);
  bud.position.y = 0.12;
  bud.scale.y = 1.25;
  lotus.add(bud);

  /* ── ORB — Hiranyagarbha ── */
  const orbGroup = new THREE.Group();
  const ORB_Y = 1.72;
  orbGroup.position.y = ORB_Y;
  scene.add(orbGroup);

  const ORB_R = 0.95;
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(ORB_R * 0.86, 48, 32),
    new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: new THREE.Color(0xffedb0) },
        uMid: { value: new THREE.Color(0xf0991a) },
        uBot: { value: new THREE.Color(0x6e2f02) },
      },
      vertexShader: `
        varying float vY; varying vec3 vN;
        void main() {
          vY = normalize(position).y;
          vN = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBot;
        varying float vY; varying vec3 vN;
        void main() {
          vec3 c = vY > 0.0 ? mix(uMid, uTop, pow(max(vY, 0.0), 0.8)) : mix(uMid, uBot, pow(max(-vY, 0.0), 0.7));
          float light = 0.85 + 0.15 * vN.z;
          gl_FragColor = vec4(c * light, 1.0);
        }`,
    })
  );
  orbGroup.add(core);

  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(ORB_R, 48, 32),
    new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color(0xffc95e) } },
      vertexShader: `
        varying vec3 vN; varying vec3 vV;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
        void main() {
          float f = pow(max(0.0, 1.0 - abs(dot(vN, vV))), 2.6);
          gl_FragColor = vec4(uColor, f * 0.9);
        }`,
    })
  );
  orbGroup.add(shell);

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  halo.scale.setScalar(4.2);
  orbGroup.add(halo);

  /* Śrí jantra — pečeť před diskem */
  const yantraGroup = new THREE.Group();
  const yantraMat = new THREE.MeshBasicMaterial({
    map: yantraTexture(),
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const yantra = new THREE.Mesh(new THREE.PlaneGeometry(ORB_R * 1.42, ORB_R * 1.42), yantraMat);
  yantraGroup.add(yantra);
  orbGroup.add(yantraGroup);

  /* paprsky */
  const rayMat = new THREE.MeshBasicMaterial({
    map: rayTexture(),
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const rays = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const w = 0.1 + (i % 3) * 0.05;
    const ray = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.3), rayMat);
    ray.position.y = ORB_R + 0.72;
    const arm = new THREE.Group();
    arm.add(ray);
    arm.rotation.z = (i / 12) * Math.PI * 2 + 0.13;
    rays.add(arm);
  }
  rays.rotation.x = -0.55;
  rays.position.z = -0.15;
  orbGroup.add(rays);

  /* prstence */
  const ringGroup = new THREE.Group();
  ringGroup.position.y = 1.72;
  scene.add(ringGroup);
  for (const [r, tilt] of [[1.42, 1.12], [1.62, 1.9]] as const) {
    const t = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.006, 8, 160),
      new THREE.MeshBasicMaterial({ color: 0xffc94d, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    t.rotation.x = tilt;
    ringGroup.add(t);
  }

  /* ── zlatý prach ── */
  const DUST_N = 260;
  const dustPos = new Float32Array(DUST_N * 3);
  const dustSpd = new Float32Array(DUST_N);
  for (let i = 0; i < DUST_N; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.6 + Math.random() * 2.4;
    dustPos[i * 3] = Math.cos(a) * r;
    dustPos[i * 3 + 1] = -0.6 + Math.random() * 4;
    dustPos[i * 3 + 2] = Math.sin(a) * r;
    dustSpd[i] = 0.06 + Math.random() * 0.14;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  scene.add(
    new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        color: 0xffca5e,
        size: 0.05,
        map: dotTexture(),
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      })
    )
  );

  /* ── post-processing: bloom + tonemap ── */
  let composer: InstanceType<Post['EffectComposer']> | null = null;
  try {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    composer = new Post.EffectComposer(renderer, rt);
    composer.addPass(new Post.RenderPass(scene, camera));
    composer.addPass(new Post.UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.4, 0.85));
    composer.addPass(new Post.OutputPass());
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  } catch (err) {
    composer = null;
    console.warn('HiranUniverse: postprocessing disabled:', err);
  }

  const render = () => {
    if (composer) composer.render();
    else renderer.render(scene, camera);
  };

  /* ── resize — podle kontejneru, ne okna ── */
  const resize = () => {
    const w = Math.max(1, box.clientWidth);
    const h = Math.max(1, box.clientHeight);
    renderer.setSize(w, h, false);
    if (composer) composer.setSize(w, h);
    camera.aspect = w / h;
    /* vzdálenost kamery podle aspectu — úzký/portretový panel → dál, aby se
       orb+lotos vešly na výšku i šířku */
    const aspect = w / h;
    const fitH = 3.6 / 0.6; // obsah ~3.6 j. na ~60 % výšky
    const fitW = 3.8 / (0.6 * Math.max(aspect, 0.4));
    const dist = Math.min(Math.max(fitH, fitW), 13);
    camBase.set(0, 2.0, dist);
    camera.updateProjectionMatrix();
  };
  let resizeT = 0;
  const ro = new ResizeObserver(() => {
    clearTimeout(resizeT);
    resizeT = window.setTimeout(resize, 60);
  });
  ro.observe(box);
  resize();

  /* ── pointer parallax (vůči kontejneru) ── */
  const pointer = { x: 0, y: 0 };
  const onPointer = (e: PointerEvent) => {
    const r = box.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / Math.max(r.width, 1) - 0.5) * 2;
    pointer.y = ((e.clientY - r.top) / Math.max(r.height, 1) - 0.5) * 2;
  };
  box.addEventListener('pointermove', onPointer, { passive: true });

  /* ── viditelnost — pauza mimo obrazovku ── */
  let visible = true;
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
  });
  io.observe(box);

  const t0 = performance.now();
  const camTarget = new THREE.Vector3(0, 0.92, 0);

  let raf = 0;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    if (!visible || !isActive()) return;
    const t = (performance.now() - t0) / 1000;

    const breath = 1 + Math.sin(t * (Math.PI * 2) / 5) * 0.014;
    orbGroup.scale.setScalar(breath);
    orbGroup.position.y = ORB_Y + Math.sin(t * 0.55) * 0.05;
    orbLight.position.y = orbGroup.position.y;

    yantraGroup.position.set(0, 0, 0);
    yantraGroup.lookAt(camera.position);
    yantraGroup.translateZ(ORB_R * 1.05);
    yantra.rotation.z = t * 0.05;
    yantraMat.opacity = 0.92 + 0.08 * Math.sin(t * 1.1);

    starUniforms.uTime.value = t;
    stars.rotation.y = t * 0.004;
    starsFar.rotation.y = -t * 0.0025;

    rays.rotation.z = -t * 0.045;
    ringGroup.rotation.y = t * 0.12;
    ringGroup.children[1].rotation.x = 1.9 + Math.sin(t * 0.3) * 0.1;

    lotus.scale.setScalar(1 + Math.sin(t * (Math.PI * 2) / 5 - 0.6) * 0.008);

    const pos = dustGeo.attributes.position as THREE_NS.BufferAttribute;
    for (let i = 0; i < DUST_N; i++) {
      let y = pos.getY(i) + dustSpd[i] * 0.016;
      if (y > 3.6) {
        y = -0.6;
        const a = Math.random() * Math.PI * 2;
        const r = 0.6 + Math.random() * 2.4;
        pos.setX(i, Math.cos(a) * r);
        pos.setZ(i, Math.sin(a) * r);
      }
      pos.setY(i, y);
    }
    pos.needsUpdate = true;

    camera.position.x = camBase.x + pointer.x * 0.55 + Math.sin(t * 0.12) * 0.3;
    camera.position.y = camBase.y - pointer.y * 0.3 + Math.sin(t * 0.17) * 0.12;
    camera.position.z = camBase.z + Math.sin(t * 0.09) * 0.2;
    camera.lookAt(camTarget);

    render();
    if (reduced) cancelAnimationFrame(raf); // jeden statický frame
  };
  frame();

  /* ── cleanup ── */
  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    clearTimeout(resizeT);
    ro.disconnect();
    io.disconnect();
    box.removeEventListener('pointermove', onPointer);
    scene.traverse((obj) => {
      const mesh = obj as THREE_NS.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE_NS.Material | THREE_NS.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    });
    ownedTextures.forEach((t) => t.dispose());
    composer?.dispose?.();
    renderer.dispose();
    renderer.forceContextLoss();
  };
}
