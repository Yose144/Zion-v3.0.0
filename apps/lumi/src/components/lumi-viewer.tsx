'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Loader2, Maximize2, Rotate3d, TriangleAlert } from 'lucide-react';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';

type Phase = 'idle' | 'checking' | 'loading' | 'ready' | 'missing' | 'error';

/**
 * 3D náhled lampionu. Model je skutečný výpal (`/models/lumi-2-*.glb`, meshopt),
 * materiály se **nepřepisují** — nesou opálenou hranu a tmavý gravír.
 *
 * Dvě cesty načtení:
 *  - `autoLoad` (homepage): model se dotáhne sám, jakmile je sekce na
 *    obrazovce, po `requestIdleCallback` — poster je vidět hned, takže LCP
 *    nečeká na three.js.
 *  - bez `autoLoad` (detaily): až po kliknutí, protože tam jde člověk
 *    nejčastěji pro cenu.
 */
export default function LumiViewer({
  modelUrl,
  poster,
  tone = 'light',
  autoLoad = false,
}: {
  modelUrl: string;
  poster: string;
  tone?: 'light' | 'dark';
  autoLoad?: boolean;
}) {
  const { lang } = useLang();
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const startedRef = useRef(false);

  useEffect(() => () => cleanupRef.current?.(), []);

  const toggleFullscreen = useCallback(() => {
    const host = mountRef.current?.parentElement;
    if (!host) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else host.requestFullscreen?.().catch(() => {});
  }, []);

  const start = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setPhase('checking');
    let exists = false;
    try {
      const response = await fetch(modelUrl, { method: 'HEAD', cache: 'no-store' });
      exists = response.ok;
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
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
      const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');

      const host = mountRef.current;
      if (!host) return;

      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const width = host.clientWidth || 800;
      const height = host.clientHeight || 520;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(36, width / height, 0.01, 40);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.domElement.style.touchAction = 'none';
      renderer.domElement.style.cursor = 'grab';
      host.appendChild(renderer.domElement);

      const pmrem = new THREE.PMREMGenerator(renderer);
      const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
      scene.environment = envRT.texture;
      scene.environmentIntensity = 0.5;

      scene.add(new THREE.HemisphereLight(0xfff0d8, 0x2a1a10, 0.6));

      const key = new THREE.DirectionalLight(0xffe0b0, 2.2);
      key.position.set(2.4, 3.2, 2.6);
      scene.add(key);

      const fill = new THREE.DirectionalLight(0xd9c3a3, 0.7);
      fill.position.set(-2.6, 1.4, 1.4);
      scene.add(fill);

      const rim = new THREE.DirectionalLight(0xffb46a, 1.4);
      rim.position.set(-1.2, 1.2, -2.6);
      scene.add(rim);

      const candle = new THREE.PointLight(0xffa63c, 1.2, 3, 2);
      scene.add(candle);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = false;
      controls.autoRotate = !reduced;
      controls.autoRotateSpeed = 0.75;
      controls.minPolarAngle = Math.PI * 0.12;
      controls.maxPolarAngle = Math.PI * 0.86;

      const resize = () => {
        const w = host.clientWidth || width;
        const h = host.clientHeight || height;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(host);

      let visible = true;
      const io = new IntersectionObserver(
        (entries) => {
          visible = entries[0]?.isIntersecting ?? true;
        },
        { threshold: 0.05 },
      );
      io.observe(host);

      let frame = 0;
      let disposed = false;
      let rafStart = 0;

      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      loader.load(
        modelUrl,
        (gltf) => {
          if (disposed) return;
          const model = gltf.scene;

          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          model.position.sub(center);

          const radius = Math.max(size.length() * 0.5, 0.03);
          const fov = (camera.fov * Math.PI) / 180;
          const distance = (radius / Math.sin(fov / 2)) * 1.05;

          camera.position.set(distance * 0.58, distance * 0.42, distance * 0.88);
          camera.lookAt(0, 0, 0);
          controls.target.set(0, 0, 0);
          controls.minDistance = distance * 0.6;
          controls.maxDistance = distance * 2.2;
          controls.update();

          // Svíčka uvnitř: teplé světlo, které prosvítí výřezy.
          candle.position.set(0, -size.y * 0.08, 0);
          candle.distance = radius * 4;
          candle.intensity = 0.9;

          model.traverse((object) => {
            const mesh = object as import('three').Mesh;
            if (!mesh.isMesh) return;
            const material = mesh.material;
            if (Array.isArray(material)) {
              material.forEach((entry) => {
                if ('envMapIntensity' in entry) entry.envMapIntensity = 0.55;
              });
            } else if (material && 'envMapIntensity' in material) {
              (material as import('three').MeshStandardMaterial).envMapIntensity = 0.55;
            }
          });

          scene.add(model);

          // Domácí podstavec — jen jemný kruh, ne podlaha.
          const pedestal = new THREE.Mesh(
            new THREE.CylinderGeometry(radius * 1.15, radius * 1.24, radius * 0.035, 48),
            new THREE.MeshStandardMaterial({ color: 0x3a2718, roughness: 0.9, metalness: 0.05 }),
          );
          pedestal.position.y = -size.y / 2 - radius * 0.02;
          scene.add(pedestal);

          const animate = (time: number) => {
            if (disposed) return;
            frame = requestAnimationFrame(animate);
            if (!visible) return;
            if (!rafStart) rafStart = time;
            const elapsed = (time - rafStart) / 1000;

            const flicker = 0.92 + Math.sin(elapsed * 7.3) * 0.05 + Math.sin(elapsed * 17.1) * 0.03;
            candle.intensity = 0.85 * flicker;
            candle.position.x = Math.sin(elapsed * 3.7) * radius * 0.012;
            candle.position.z = Math.cos(elapsed * 4.1) * radius * 0.012;

            controls.update();
            renderer.render(scene, camera);
          };
          frame = requestAnimationFrame(animate);
          setPhase('ready');

          cleanupRef.current = () => {
            disposed = true;
            cancelAnimationFrame(frame);
            observer.disconnect();
            io.disconnect();
            controls.dispose();
            envRT.dispose();
            pmrem.dispose();
            renderer.dispose();
            renderer.domElement.remove();
            scene.traverse((object) => {
              const mesh = object as import('three').Mesh;
              if (mesh.geometry) mesh.geometry.dispose();
            });
            scene.clear();
          };
        },
        (event) => {
          if (event.total) setProgress(Math.round((event.loaded / event.total) * 100));
        },
        () => {
          if (!disposed) setPhase('error');
        },
      );

      cleanupRef.current = () => {
        disposed = true;
        cancelAnimationFrame(frame);
        observer.disconnect();
        io.disconnect();
        controls.dispose();
        envRT.dispose();
        pmrem.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    } catch {
      setPhase('error');
    }
  }, [modelUrl]);

  // Homepage: začni načítat, až je sekce na obrazovce, a to až když má
  // prohlížeč volno. `rootMargin` 300 px znamená, že se model stahuje
  // kousek před tím, než na něj člověk dojede.
  useEffect(() => {
    if (!autoLoad) return;
    const host = mountRef.current;
    if (!host) return;

    let idleHandle: number | undefined;
    const idle = window as unknown as {
      requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        const run = () => void start();
        if (typeof idle.requestIdleCallback === 'function') {
          idleHandle = idle.requestIdleCallback(run, { timeout: 2500 });
        } else {
          idleHandle = window.setTimeout(run, 250);
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(host);

    return () => {
      observer.disconnect();
      if (idleHandle === undefined) return;
      if (typeof idle.cancelIdleCallback === 'function') idle.cancelIdleCallback(idleHandle);
      else window.clearTimeout(idleHandle);
    };
  }, [autoLoad, start]);

  const showPoster = phase !== 'ready';

  return (
    <div className="space-y-3">
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-forest/30 bg-[#0B141E]">
        {/* teplá záře — čistě CSS, aby pozadí drželo i před načtením modelu */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(55% 50% at 50% 58%, rgba(255,168,72,0.24), transparent 70%),' +
              'radial-gradient(40% 40% at 80% 12%, rgba(255,210,150,0.10), transparent 70%),' +
              'linear-gradient(180deg, #1a1109 0%, #241708 60%, #140d06 100%)',
          }}
        />
        {showPoster && (
          <img
            src={poster}
            alt={pick({ cs: 'Lampion Lumi', en: 'Lumi lantern', de: 'Lumi-Laterne' }, lang)}
            loading="lazy"
            className={`relative h-full w-full object-cover ${phase === 'missing' || phase === 'error' ? 'opacity-25' : 'opacity-60'}`}
          />
        )}

        <div ref={mountRef} className="absolute inset-0 [&>canvas]:h-full [&>canvas]:w-full" />

        {phase === 'ready' && (
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={pick({ cs: 'Celá obrazovka', en: 'Fullscreen', de: 'Vollbild' }, lang)}
            className="absolute right-3 top-3 z-10 rounded-lg border border-white/15 bg-black/40 p-2 text-white/80 backdrop-blur-sm transition-colors hover:border-amber-400/60 hover:text-amber-300"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}

        {phase === 'ready' && (
          <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-black/45 px-2.5 py-1 text-[10px] text-white/70 backdrop-blur-sm sm:bottom-3 sm:px-3 sm:py-1.5 sm:text-[11px]">
            <span className="sm:hidden">
              {pick({ cs: 'Táhni pro otočení', en: 'Drag to rotate', de: 'Ziehen zum Drehen' }, lang)}
            </span>
            <span className="hidden sm:inline">
              {pick({ cs: 'Táhni pro otočení · kolečko přiblíží', en: 'Drag to rotate · scroll to zoom', de: 'Ziehen zum Drehen · Scrollen zum Zoomen' }, lang)}
            </span>
          </div>
        )}

        {phase !== 'ready' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
            {phase === 'idle' && !autoLoad && (
              <>
                <button
                  type="button"
                  onClick={start}
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-400/50 bg-amber-500/15 px-5 py-2.5 text-sm font-bold text-amber-200 shadow-[0_0_30px_rgba(201,123,46,0.2)] transition-colors hover:bg-amber-500/25"
                >
                  <Box className="h-4 w-4" />
                  {pick({ cs: 'Otočit lampion ve 3D', en: 'Spin the lantern in 3D', de: 'Laterne in 3D drehen' }, lang)}
                </button>
                <p className="max-w-xs text-[11px] leading-snug text-white/55">
                  {pick(
                    {
                      cs: 'Skutečný model z výrobní dokumentace. Načítá se až po kliknutí, kvůli rychlosti stránky.',
                      en: 'The real model from the production drawings. It loads only after you click, to keep the page fast.',
                      de: 'Das echte Modell aus den Fertigungszeichnungen. Es lädt erst nach dem Klick, damit die Seite schnell bleibt.',
                    },
                    lang,
                  )}
                </p>
              </>
            )}

            {phase === 'idle' && autoLoad && (
              <span className="inline-flex items-center gap-2 text-sm text-white/70">
                <Loader2 className="h-4 w-4 animate-spin" />
                {pick({ cs: 'Připravuji 3D náhled…', en: 'Preparing the 3D preview…', de: '3D-Vorschau wird vorbereitet…' }, lang)}
              </span>
            )}

            {phase === 'checking' && (
              <span className="inline-flex items-center gap-2 text-sm text-white/75">
                <Loader2 className="h-4 w-4 animate-spin" />
                {pick({ cs: 'Zjišťuji model…', en: 'Checking the model…', de: 'Modell wird geprüft…' }, lang)}
              </span>
            )}

            {phase === 'loading' && (
              <div className="w-56 space-y-2">
                <span className="inline-flex items-center gap-2 text-sm text-white/75">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {pick({ cs: 'Načítám 3D model', en: 'Loading the 3D model', de: '3D-Modell wird geladen' }, lang)}
                </span>
                <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-700 via-amber-400 to-amber-200 transition-[width] duration-200"
                    style={{ width: `${Math.max(6, progress)}%` }}
                  />
                </div>
              </div>
            )}

            {phase === 'missing' && (
              <div className="max-w-sm space-y-1.5">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-white/80">
                  <Box className="h-4 w-4" />
                  {pick({ cs: '3D náhled se připravuje', en: 'The 3D preview is being prepared', de: 'Die 3D-Ansicht wird vorbereitet' }, lang)}
                </p>
                <p className="text-[11px] leading-snug text-white/50">
                  {pick(
                    {
                      cs: 'Fotky a konstrukční snímky výše jsou zatím přesné. Hotový model se tu objeví sám.',
                      en: 'The photos and construction shots above are accurate for now. The finished model will appear here on its own.',
                      de: 'Die Fotos und Konstruktionsaufnahmen oben sind vorerst genau. Das fertige Modell erscheint hier von selbst.',
                    },
                    lang,
                  )}
                </p>
              </div>
            )}

            {phase === 'error' && (
              <div className="max-w-sm space-y-2">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-amber-300">
                  <TriangleAlert className="h-4 w-4" />
                  {pick({ cs: '3D se nepodařilo načíst', en: 'The 3D preview could not load', de: 'Die 3D-Ansicht konnte nicht geladen werden' }, lang)}
                </p>
                <button
                  type="button"
                  onClick={start}
                  className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 hover:border-white/40"
                >
                  {pick({ cs: 'Zkusit znovu', en: 'Try again', de: 'Erneut versuchen' }, lang)}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <p className={`flex items-start gap-2 text-[11px] leading-snug ${tone === 'dark' ? 'text-parchment/55' : 'text-muted'}`}>
        <Rotate3d className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {pick(
          {
            cs: 'Vizualizace postavená z výrobních podkladů. Rozhodující je fyzický kus — lícování a bezpečnost svíčky ověřuje dílna.',
            en: 'A visualisation built from the production files. The physical piece decides — fit and candle safety are verified by the workshop.',
            de: 'Eine Visualisierung aus den Fertigungsdaten. Entscheidend ist das physische Stück — Passung und Kerzensicherheit prüft die Werkstatt.',
          },
          lang,
        )}
      </p>
    </div>
  );
}
