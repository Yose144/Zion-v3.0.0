'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Loader2, Maximize2, Rotate3d, TriangleAlert } from 'lucide-react';
import { useLangT } from '@/lib/useTranslation';

/**
 * 3D náhled lampionu Království srdce — Lumi 2.
 *
 * Model: `public/models/lumi-2.glb` (8 dílů — šest stěn, zdobený vršek, dno —
 * 214 k trojúhelníků, skutečné míry výpalu: 140 × 126 × 121 mm, Y-up, metry).
 * Vzniká z `heros/shop/Lumi/Lumi_2.glb` skriptem
 * `scripts/ops/lumi-glb-optimize.sh` (meshopt, 12 MB → 1,9 MB). Když soubor
 * chybí, ukáže se „připravujeme" — díky tomu jde model vyměnit bez zásahu
 * do kódu.
 *
 * Materiály modelu se **nepřepisují**: `Překližka` / `Řez` / `Gravír` nesou
 * opálenou hranu laseru a tmavý gravír. Přemalovat je jednou barvou by
 * z lampionu udělalo papírovou krabici (přesně tak vypadal starý model v6,
 * který měl jediný krémový materiál a žádné normály).
 *
 * Proč click-to-load: `three` + postprocessing jsou ~700 kB. Načítat je při
 * každém otevření detailu (i lidem, co se přišli jen podívat na cenu) by zabilo
 * LCP. Do kliknutí je vidět fotka a tlačítko.
 *
 * Vizuál drží jazyk marketu (tmavá plocha, zlato, rasta linka) — galaxie za
 * lampionem, teplé světlo jako od svíčky uvnitř, jemný bloom na prosvícených
 * výřezech, prachové částečky a podstavec se světelným odleskem.
 */
type Phase = 'idle' | 'checking' | 'loading' | 'ready' | 'missing' | 'error';

interface Props {
  modelUrl: string;
  poster: string;
  posterAlt?: string;
}

export default function Lantern3D({ modelUrl, poster, posterAlt }: Props) {
  const { lang } = useLangT();
  const cs = lang === 'cs';
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [hintVisible, setHintVisible] = useState(true);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);

  const toggleFullscreen = useCallback(() => {
    const host = mountRef.current?.parentElement;
    if (!host) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else host.requestFullscreen?.().catch(() => {});
  }, []);

  const start = useCallback(async () => {
    setPhase('checking');

    let exists = false;
    try {
      const res = await fetch(modelUrl, { method: 'HEAD', cache: 'no-store' });
      exists = res.ok;
    } catch {
      exists = false;
    }
    if (!exists) {
      setPhase('missing');
      return;
    }

    setPhase('loading');
    try {
      const THREE = await import('three');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
      const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');

      const host = mountRef.current;
      if (!host) return;

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
      const wide = window.innerWidth >= 900;
      const useBloom = wide && !saveData;

      const width = host.clientWidth || 800;
      const height = host.clientHeight || 500;

      const scene = new THREE.Scene();

      const camera = new THREE.PerspectiveCamera(34, width / height, 0.05, 100);
      camera.position.set(0, 0.1, 0.6);
      camera.lookAt(0, 0, 0);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.72;
      renderer.domElement.style.touchAction = 'none';
      renderer.domElement.style.cursor = 'grab';
      // Stíny: měsíc svítí zleva, lampion i svíčka vrhají stín na sníh.
      // Na mobilu vypnuto — model má 236 k tris a stínový průchod by sežral snímky.
      const shadowsOn = window.innerWidth >= 720;
      renderer.shadowMap.enabled = shadowsOn;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      host.appendChild(renderer.domElement);

      // ── Prostředí pro PBR odlesky (dřevo + kov) ──────────────────────
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
      scene.environment = envRT.texture;
      scene.environmentIntensity = 0.22;

      // ── Světla: svíčka uvnitř, klíčové zlato shora, chladný rim ──────
      scene.add(new THREE.HemisphereLight(0xfff0d2, 0x0a0a0c, 0.28));

      const key = new THREE.DirectionalLight(0xffd089, 0.45);
      key.position.set(1.6, 2.4, 1.8);
      scene.add(key);

      const rim = new THREE.DirectionalLight(0x7fa8ff, 0.9);
      rim.position.set(-1.8, 0.9, -1.6);
      scene.add(rim);

      // zadní obrysové světlo: bez podlahy by se lampion ztrácel ve tmě
      const backLight = new THREE.DirectionalLight(0xffc98a, 0.7);
      backLight.position.set(0.9, 1.4, -2.2);
      scene.add(backLight);

      const candle = new THREE.PointLight(0xffa63c, 0.5, 0.36, 2);
      candle.position.set(0, 0.02, 0);
      scene.add(candle);

      // vytvoří se až po načtení modelu (potřebují jeho měřítko)
      let flame: import('three').Mesh;
      let flameCore: import('three').Mesh;
      let moonDir: import('three').DirectionalLight;

      // ── Galaxie: hvězdy + jemný prach ────────────────────────────────
      const galaxyGroup = new THREE.Group();
      scene.add(galaxyGroup);

      const makeStars = (count: number, radius: number, size: number, color: number) => {
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          // rovnoměrně na kouli, ale s hustším pásem (mléčná dráha)
          const u = Math.random() * 2 - 1;
          const theta = Math.random() * Math.PI * 2;
          const r = radius * (0.75 + Math.random() * 0.5);
          const band = 1 - Math.abs(u) * 0.55;
          const su = u * band;
          const s = Math.sqrt(Math.max(0, 1 - su * su));
          pos[i * 3] = r * s * Math.cos(theta);
          pos[i * 3 + 1] = r * su;
          pos[i * 3 + 2] = r * s * Math.sin(theta);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({
          color,
          size,
          sizeAttenuation: true,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        return new THREE.Points(geo, mat);
      };

      const starsFar = makeStars(3000, 14, 0.034, 0xdfe8ff);
      const starsNear = makeStars(800, 7, 0.058, 0xffe3b0);
      galaxyGroup.add(starsFar, starsNear);

      // kulatá textura vločky (PointsMaterial kreslí jinak čtverce)
      const snowCanvas = document.createElement('canvas');
      snowCanvas.width = snowCanvas.height = 64;
      const snowCtx = snowCanvas.getContext('2d')!;
      const sgrad2 = snowCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
      sgrad2.addColorStop(0, 'rgba(255,255,255,1)');
      sgrad2.addColorStop(0.55, 'rgba(255,255,255,0.85)');
      sgrad2.addColorStop(1, 'rgba(255,255,255,0)');
      snowCtx.fillStyle = sgrad2;
      snowCtx.fillRect(0, 0, 64, 64);
      const snowTex = new THREE.CanvasTexture(snowCanvas);

      // prachové částečky kolem lampionu
      const dustCount = reducedMotion ? 0 : 420;
      let dust: import('three').Points | null = null;
      let dustBase: Float32Array | null = null;
      if (dustCount > 0) {
        const dpos = new Float32Array(dustCount * 3);
        dustBase = new Float32Array(dustCount * 3);
        for (let i = 0; i < dustCount; i++) {
          const r = 0.12 + Math.random() * 0.62;
          const a = Math.random() * Math.PI * 2;
          dpos[i * 3] = Math.cos(a) * r;
          dpos[i * 3 + 1] = Math.random() * 0.9 - 0.15;
          dpos[i * 3 + 2] = Math.sin(a) * r;
          dustBase.set([dpos[i * 3], dpos[i * 3 + 1], dpos[i * 3 + 2]], i * 3);
        }
        const dgeo = new THREE.BufferGeometry();
        dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
        dust = new THREE.Points(
          dgeo,
          new THREE.PointsMaterial({
            color: 0xeaf2ff,
            size: 0.0045,
            map: snowTex,
            alphaTest: 0.02,
            transparent: true,
            opacity: 0.8,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        );
        scene.add(dust);
      }

      // ── Model ───────────────────────────────────────────────────────
      const pivot = new THREE.Group();
      scene.add(pivot);

      // Model je zabalený `EXT_meshopt_compression` (12 MB → 1,9 MB, viz
      // scripts/ops/lumi-glb-optimize.sh). Bez dekodéru by se nenačetl vůbec;
      // je součástí `three`, takže se nic nedotahuje ze sítě.
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      let raf = 0;
      let disposed = false;
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      let velY = reducedMotion ? 0 : 0.0028;
      let velX = 0;
      let autoRotate = !reducedMotion;
      let targetZ = camera.position.z;
      let minZ = 0.2;
      let maxZ = 2.0;
      let interacted = false;
      let visible = true;

      const onDown = (e: PointerEvent) => {
        dragging = true;
        autoRotate = false;
        lastX = e.clientX;
        lastY = e.clientY;
        renderer.domElement.style.cursor = 'grabbing';
        try {
          renderer.domElement.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        if (!interacted) {
          interacted = true;
          setHintVisible(false);
        }
      };
      const onMove = (e: PointerEvent) => {
        if (!dragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        velY = dx * 0.006;
        velX = dy * 0.003;
        pivot.rotation.y += velY;
        pivot.rotation.x = Math.max(-0.45, Math.min(0.45, pivot.rotation.x + velX));
      };
      const onUp = (e: PointerEvent) => {
        dragging = false;
        renderer.domElement.style.cursor = 'grab';
        try {
          renderer.domElement.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      };
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        targetZ = Math.max(minZ, Math.min(maxZ, targetZ + e.deltaY * 0.0011));
      };
      const onDouble = () => {
        pivot.rotation.set(0, 0, 0);
        targetZ = maxZ / 1.9 * 1.0;
        velX = 0;
        velY = reducedMotion ? 0 : 0.0028;
        autoRotate = !reducedMotion;
      };

      renderer.domElement.addEventListener('pointerdown', onDown);
      renderer.domElement.addEventListener('pointermove', onMove);
      renderer.domElement.addEventListener('pointerup', onUp);
      renderer.domElement.addEventListener('pointercancel', onUp);
      renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
      renderer.domElement.addEventListener('dblclick', onDouble);

      // ── Postprocessing (bloom jen na širokých obrazovkách) ──────────
      type Composer = { render: () => void; setSize: (w: number, h: number) => void; dispose: () => void };
      let composer: Composer | null = null;

      const onResize = () => {
        const w = host.clientWidth || width;
        const h = host.clientHeight || height;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        composer?.setSize(w, h);
      };
      const resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(host);

      const io = new IntersectionObserver((entries) => {
        visible = entries[0]?.isIntersecting ?? true;
      }, { threshold: 0.05 });
      io.observe(host);

      loader.load(
        modelUrl,
        async (gltf) => {
          if (disposed) return;
          const model = gltf.scene;

          // Vycentrovat podle bounding boxu a zmenšit do záběru — model je
          // v metrech (126 mm výška), takže bez normalizace by byl titěrný.
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          model.position.sub(center);

          // Model je v metrech (0,14 × 0,126 × 0,121 m) — NEškálujeme ho,
          // jen vycentrujeme a kameru dopočítáme z bounding sphere, aby sedl
          // do záběru bez ohledu na exportní jednotky.
          const sphere = box.getBoundingSphere(new THREE.Sphere());
          const radius = Math.max(sphere.radius, 0.02);
          const fitDist = (radius / Math.sin((camera.fov * Math.PI) / 180 / 2)) * 1.34;
          camera.position.set(0, radius * 0.42, fitDist);
          targetZ = fitDist;
          minZ = fitDist * 0.55;
          maxZ = fitDist * 1.9;

          // podstavec a prach držíme ve stejných proporcích jako model
          if (dust) dust.scale.setScalar(radius * 2.2);

          model.traverse((obj) => {
            const mesh = obj as import('three').Mesh;
            if (!mesh.isMesh) return;
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            // Dřevo je nasvícené zevnitř — necháme PBR, jen srovnáme hrubost,
            // aby výřezy nebyly „plastové".
            const mat = mesh.material as import('three').MeshStandardMaterial;
            if (mat && 'roughness' in mat) {
              mat.roughness = Math.min(1, (mat.roughness ?? 0.7) * 1.05);
              mat.envMapIntensity = 0.6;
            }
          });

          pivot.add(model);

          // ── Stíny na modelu ────────────────────────────────────────
          // POZOR: `box` je z doby PŘED vycentrováním (model.position.sub(center)),
          // takže box.min.y je 0, ne dno. Po vycentrování je dno v -size.y/2 —
          // dřív kvůli tomu svíčka stála uprostřed lampionu.
          const floorY = box.min.y - center.y; // = -size.y / 2
          model.traverse((obj) => {
            const mesh = obj as import('three').Mesh;
            if (!mesh.isMesh) return;
            mesh.castShadow = shadowsOn;
            mesh.receiveShadow = shadowsOn;
          });

          // ── Zimní zem: sníh, na kterém lampion stojí ────────────────
          // ── Měsíc: studené světlo zleva, vrhá stín po sněhu ────────
          const moonDir = new THREE.DirectionalLight(0xdce8ff, shadowsOn ? 1.15 : 0.6);
          moonDir.position.set(-radius * 7, radius * 6, radius * 5);
          moonDir.target.position.set(0, floorY, 0);
          scene.add(moonDir.target);
          if (shadowsOn) {
            moonDir.castShadow = true;
            moonDir.shadow.mapSize.set(2048, 2048);
            moonDir.shadow.camera.near = radius * 1.5;
            moonDir.shadow.camera.far = radius * 30;
            moonDir.shadow.camera.left = -radius * 2.4;
            moonDir.shadow.camera.right = radius * 2.4;
            moonDir.shadow.camera.top = radius * 2.4;
            moonDir.shadow.camera.bottom = -radius * 2.4;
            moonDir.shadow.bias = -0.0007;
            moonDir.shadow.radius = 4;
          }
          scene.add(moonDir);

          // měsíc jako světelný kotouč na obloze
          const moonCanvas = document.createElement('canvas');
          moonCanvas.width = moonCanvas.height = 256;
          const mctx = moonCanvas.getContext('2d')!;
          const mgrad = mctx.createRadialGradient(128, 128, 0, 128, 128, 128);
          mgrad.addColorStop(0, 'rgba(255,255,255,1)');
          mgrad.addColorStop(0.32, 'rgba(226,238,255,0.92)');
          mgrad.addColorStop(0.42, 'rgba(200,220,255,0.35)');
          mgrad.addColorStop(1, 'rgba(180,205,255,0)');
          mctx.fillStyle = mgrad;
          mctx.fillRect(0, 0, 256, 256);
          const moonTex = new THREE.CanvasTexture(moonCanvas);
          const moonSprite = new THREE.Sprite(
            new THREE.SpriteMaterial({ map: moonTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
          );
          moonSprite.scale.setScalar(radius * 3.2);
          moonSprite.position.set(-radius * 4.8, radius * 2.1, -radius * 13);
          scene.add(moonSprite);

          // ── Hořící svíčka uvnitř lampionu ──────────────────────────
          const candleGroup = new THREE.Group();
          const waxH = radius * 0.36;
          const waxR = radius * 0.17;
          const wax = new THREE.Mesh(
            new THREE.CylinderGeometry(waxR, waxR * 1.02, waxH, 24),
            new THREE.MeshStandardMaterial({
              color: 0xfff4dc,
              roughness: 0.72,
              emissive: 0xff9c3c,
              emissiveIntensity: 0.22,
            }),
          );
          wax.castShadow = shadowsOn;
          candleGroup.add(wax);

          // knot
          const wick = new THREE.Mesh(
            new THREE.CylinderGeometry(radius * 0.008, radius * 0.008, radius * 0.03, 6),
            new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 1 }),
          );
          wick.position.y = waxH / 2 + radius * 0.012;
          candleGroup.add(wick);

          // plamen — emissive kužel, bloom z něj udělá skutečné světlo
          const flameMat = new THREE.MeshBasicMaterial({ color: 0xffd08a, toneMapped: false });
          const flame = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.075, radius * 0.26, 14), flameMat);
          flame.position.y = waxH / 2 + radius * 0.1;
          candleGroup.add(flame);

          const flameCore = new THREE.Mesh(
            new THREE.ConeGeometry(radius * 0.036, radius * 0.13, 12),
            new THREE.MeshBasicMaterial({ color: 0xfff6df, toneMapped: false }),
          );
          flameCore.position.copy(flame.position);
          candleGroup.add(flameCore);

          candleGroup.position.set(0, floorY + waxH / 2 + 0.002, 0);
          scene.add(candleGroup);

          // halo kolem plamene — teplá záře, kterou bloom podrží
          const haloCanvas = document.createElement('canvas');
          haloCanvas.width = haloCanvas.height = 128;
          const hctx = haloCanvas.getContext('2d')!;
          const hgrad = hctx.createRadialGradient(64, 64, 0, 64, 64, 64);
          hgrad.addColorStop(0, 'rgba(255,236,190,0.95)');
          hgrad.addColorStop(0.28, 'rgba(255,186,96,0.5)');
          hgrad.addColorStop(0.6, 'rgba(255,140,50,0.16)');
          hgrad.addColorStop(1, 'rgba(255,120,30,0)');
          hctx.fillStyle = hgrad;
          hctx.fillRect(0, 0, 128, 128);
          const haloTex = new THREE.CanvasTexture(haloCanvas);
          const halo = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: haloTex,
              transparent: true,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
            }),
          );
          halo.scale.setScalar(radius * 1.9);
          halo.position.set(0, waxH / 2 + radius * 0.12, 0);
          candleGroup.add(halo);

          // světlo plamene (point light) — dýchá s plamenem a vrhá stín
          candle.position.set(0, floorY + waxH + radius * 0.09, 0);
          candle.distance = radius * 3.2;
          candle.intensity = 0.4;
          if (shadowsOn) {
            candle.castShadow = true;
            candle.shadow.mapSize.set(512, 512);
            candle.shadow.bias = -0.0025;
            candle.shadow.camera.near = radius * 0.05;
            candle.shadow.camera.far = radius * 3.4;
          }

          if (useBloom) {
            const { EffectComposer } = await import('three/examples/jsm/postprocessing/EffectComposer.js');
            const { RenderPass } = await import('three/examples/jsm/postprocessing/RenderPass.js');
            const { UnrealBloomPass } = await import('three/examples/jsm/postprocessing/UnrealBloomPass.js');
            const { OutputPass } = await import('three/examples/jsm/postprocessing/OutputPass.js');

            // MSAA render target — jinak jsou hrany vyřezávaných ornamentů zubaté
            const bufferSize = renderer.getDrawingBufferSize(new THREE.Vector2());
            const rt = new THREE.WebGLRenderTarget(bufferSize.x, bufferSize.y, { samples: 4 });
            const comp = new EffectComposer(renderer, rt);
            comp.addPass(new RenderPass(scene, camera));
            const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.16, 0.4, 1.25);
            comp.addPass(bloom);
            comp.addPass(new OutputPass());
            comp.setSize(width, height);
            composer = comp as unknown as Composer;
          }

          const clock = new THREE.Clock();

          const animate = () => {
            raf = requestAnimationFrame(animate);
            if (!visible) return;

            const t = clock.getElapsedTime();

            // setrvačnost po tažení
            if (!dragging) {
              velY *= 0.94;
              velX *= 0.9;
              pivot.rotation.y += velY;
              if (autoRotate) pivot.rotation.y += 0.0016;
              pivot.rotation.x = Math.max(-0.45, Math.min(0.45, pivot.rotation.x + velX));
            }

            // plamen: jemné chvění + světlo, které opravdu svítí do výřezů
            const flick = 0.86 + Math.sin(t * 9.1) * 0.06 + Math.sin(t * 21.7) * 0.03 + Math.sin(t * 3.3) * 0.05;
            flame.scale.set(1 + Math.sin(t * 7.7) * 0.05, flick, 1 + Math.cos(t * 6.1) * 0.05);
            flame.position.x = Math.sin(t * 5.2) * radius * 0.006;
            flameCore.scale.copy(flame.scale).multiplyScalar(0.92);
            flameCore.position.copy(flame.position);
            candle.intensity = 0.38 * flick + 0.05;
            halo.material.opacity = 0.55 + (flick - 0.86) * 1.2;
            candle.position.x = Math.sin(t * 4.4) * radius * 0.008;
            candle.position.z = Math.cos(t * 3.8) * radius * 0.008;

            moonDir.intensity = (shadowsOn ? 1.15 : 0.6) + Math.sin(t * 0.4) * 0.05;

            // hvězdy se otáčejí, chumelenice padá
            galaxyGroup.rotation.y = t * 0.008;
            if (dust && dustBase) {
              const pos = dust.geometry.getAttribute('position') as import('three').BufferAttribute;
              for (let i = 0; i < pos.count; i++) {
                let y = pos.getY(i) - 0.0011 - (i % 5) * 0.00012;
                if (y < -0.15) y = 0.95 + Math.random() * 0.2;
                pos.setY(i, y);
                pos.setX(i, dustBase[i * 3] + Math.sin(t * 0.5 + i * 0.7) * 0.03);
              }
              pos.needsUpdate = true;
            }

            camera.position.z += (targetZ - camera.position.z) * 0.08;
            camera.position.y = fitDist * 0.3 + Math.sin(t * 0.5) * fitDist * 0.01;
            camera.lookAt(0, -radius * 0.08, 0);

            if (composer) composer.render();
            else renderer.render(scene, camera);
          };
          animate();
          setPhase('ready');

          cleanupRef.current = () => {
            disposed = true;
            cancelAnimationFrame(raf);
            resizeObserver.disconnect();
            io.disconnect();
            renderer.domElement.removeEventListener('pointerdown', onDown);
            renderer.domElement.removeEventListener('pointermove', onMove);
            renderer.domElement.removeEventListener('pointerup', onUp);
            renderer.domElement.removeEventListener('pointercancel', onUp);
            renderer.domElement.removeEventListener('wheel', onWheel);
            renderer.domElement.removeEventListener('dblclick', onDouble);
            composer?.dispose();
            envRT.dispose();
            pmrem.dispose();
            moonTex.dispose();
            haloTex.dispose();
            snowTex.dispose();
            renderer.dispose();
            renderer.domElement.remove();
            scene.traverse((o) => {
              const m = o as import('three').Mesh;
              if (m.geometry) m.geometry.dispose();
            });
            scene.clear();
          };
        },
        (evt) => {
          if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100));
        },
        () => {
          if (!disposed) setPhase('error');
        },
      );

      // úklid i pro případ, že model nedorazí
      cleanupRef.current = () => {
        disposed = true;
        cancelAnimationFrame(raf);
        resizeObserver.disconnect();
        io.disconnect();
        renderer.dispose();
        renderer.domElement.remove();
      };
    } catch {
      setPhase('error');
    }
  }, [modelUrl]);

  const showPoster = phase !== 'ready';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold font-display flex items-center gap-2">
          <Rotate3d className="w-5 h-5 text-rasta-gold" />
          {cs ? 'Lampion ve 3D' : 'Lantern in 3D'}
        </h2>
        <p className="text-xs text-gray-500">
          {cs ? 'Táhni pro otočení · kolečko přiblíží · dvojklik vrátí pohled' : 'Drag to rotate · scroll to zoom · double-click to reset'}
        </p>
      </div>

      <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-white/10 bg-[#05060a]">
        {/* galaxie pod plátnem — čistě CSS, ať je pozadí i před načtením modelu */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(60% 55% at 50% 62%, rgba(255,168,72,0.16), transparent 70%),' +
              'radial-gradient(45% 40% at 18% 18%, rgba(96,130,255,0.16), transparent 72%),' +
              'radial-gradient(50% 45% at 84% 22%, rgba(255,90,120,0.10), transparent 72%),' +
              'linear-gradient(180deg, #05060a 0%, #080a12 55%, #05060a 100%)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'radial-gradient(1px 1px at 12% 24%, #fff 0%, transparent 100%),' +
              'radial-gradient(1px 1px at 28% 68%, #fff 0%, transparent 100%),' +
              'radial-gradient(1.5px 1.5px at 47% 18%, #ffe6b0 0%, transparent 100%),' +
              'radial-gradient(1px 1px at 63% 78%, #fff 0%, transparent 100%),' +
              'radial-gradient(1px 1px at 81% 36%, #cfe0ff 0%, transparent 100%),' +
              'radial-gradient(1.5px 1.5px at 92% 64%, #fff 0%, transparent 100%)',
            backgroundSize: '340px 340px',
          }}
        />

        {showPoster && (
          <img
            src={poster}
            alt={posterAlt ?? (cs ? 'Lampion Království srdce' : 'Kingdom of the Heart lantern')}
            loading="lazy"
            className={`relative h-full w-full object-cover ${
              phase === 'missing' || phase === 'error' ? 'opacity-30' : 'opacity-70'
            }`}
          />
        )}

        <div ref={mountRef} className="absolute inset-0 [&>canvas]:h-full [&>canvas]:w-full" />

        {phase === 'ready' && (
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={cs ? 'Celá obrazovka' : 'Fullscreen'}
            className="absolute right-3 top-3 z-10 rounded-lg border border-white/15 bg-black/50 p-2 text-white/80 backdrop-blur-sm transition-colors hover:border-rasta-gold/50 hover:text-rasta-gold"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}

        {phase === 'ready' && hintVisible && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-[11px] text-white/70 backdrop-blur-sm">
            {cs ? 'Táhni pro otočení' : 'Drag to rotate'}
          </div>
        )}

        {phase !== 'ready' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
            {phase === 'idle' && (
              <>
                <button
                  type="button"
                  onClick={start}
                  className="inline-flex items-center gap-2 rounded-xl border border-rasta-gold/45 bg-rasta-gold/15 px-5 py-2.5 text-sm font-bold text-rasta-gold shadow-[0_0_30px_rgba(252,209,22,0.18)] transition-colors hover:bg-rasta-gold/25"
                >
                  <Box className="h-4 w-4" />
                  {cs ? 'Otočit lampion ve 3D' : 'Spin the lantern in 3D'}
                </button>
                <p className="max-w-xs text-[11px] leading-snug text-gray-400">
                  {cs
                    ? 'Model je skutečný výpal — šest stěn, zdobený vršek a dno. Stahuje se až po kliknutí, kvůli rychlosti stránky.'
                    : 'The model is the real cut: six walls, the carved crown and the base. It downloads only after you click, to keep the page fast.'}
                </p>
              </>
            )}

            {phase === 'checking' && (
              <span className="inline-flex items-center gap-2 text-sm text-gray-300">
                <Loader2 className="h-4 w-4 animate-spin" /> {cs ? 'Zjišťuji model…' : 'Checking the model…'}
              </span>
            )}

            {phase === 'loading' && (
              <div className="w-56 space-y-2">
                <span className="inline-flex items-center gap-2 text-sm text-gray-300">
                  <Loader2 className="h-4 w-4 animate-spin" /> {cs ? 'Načítám 3D model' : 'Loading the 3D model'}
                </span>
                <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rasta-green via-rasta-gold to-rasta-red transition-[width] duration-200"
                    style={{ width: `${Math.max(6, progress)}%` }}
                  />
                </div>
              </div>
            )}

            {phase === 'missing' && (
              <div className="max-w-sm space-y-1.5">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-white/80">
                  <Box className="h-4 w-4" /> {cs ? '3D náhled se připravuje' : 'The 3D preview is being prepared'}
                </p>
                <p className="text-[11px] leading-snug text-gray-400">
                  {cs
                    ? 'Fotky a konstrukční snímky výše jsou zatím přesné. Hotový model se tu objeví sám.'
                    : 'The photos and construction shots above are accurate for now. The finished model will appear here on its own.'}
                </p>
              </div>
            )}

            {phase === 'error' && (
              <div className="max-w-sm space-y-2">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-amber-300">
                  <TriangleAlert className="h-4 w-4" /> {cs ? '3D se nepodařilo načíst' : 'The 3D preview could not load'}
                </p>
                <button
                  type="button"
                  onClick={start}
                  className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-gray-200 hover:border-white/40"
                >
                  {cs ? 'Zkusit znovu' : 'Try again'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-[11px] leading-snug text-gray-500">
        {cs
          ? 'Vizualizační model z technické dokumentace A3 (Lumi 2) — šest stěn, zdobený vršek a dno se skutečnými průchozími výřezy. Není to výrobní dokumentace ani podklad pro 3D tisk; fyzické lícování a bezpečnost svíčky ověřuje dílna.'
          : 'A visualisation model from the A3 (Lumi 2) technical drawings — six walls, the carved crown and the base, with real through-cut ornaments. Not production documentation or a 3D-printing file; physical fit and candle safety are verified by the workshop.'}
      </p>
    </div>
  );
}
