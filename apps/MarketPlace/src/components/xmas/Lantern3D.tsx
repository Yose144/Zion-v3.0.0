'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Loader2, Rotate3d, TriangleAlert } from 'lucide-react';
import { useLangT } from '@/lib/useTranslation';

/**
 * Slot pro 3D model lampionu.
 *
 * Záměr: až bude `.glb` hotový, jen se nahraje do `public/models/` a **nic
 * v kódu se nemění** — komponenta si dostupnost ověří HEAD requestem.
 *
 * Proč click-to-load: `three` je ~600 kB. Načítat ho při každém otevření
 * detailu (a to i lidem, kteří se jen přišli podívat na cenu) by zabilo
 * LCP. Proto se stáhne až po stisku tlačítka; do té doby je vidět plakát.
 *
 * Ovládání je vlastní (tažení = rotace, kolečko = přiblížení), ne OrbitControls
 * — ušetří to další chunk a chování je předvídatelné i na dotyku.
 */
type Phase = 'idle' | 'checking' | 'loading' | 'ready' | 'missing' | 'error';

interface Props {
  /** cesta k modelu, např. /models/lampion-kralovstvi-srdce.glb */
  modelUrl: string;
  /** statický náhled, který se ukazuje před načtením 3D */
  poster: string;
  posterAlt?: string;
}

export default function Lantern3D({ modelUrl, poster, posterAlt }: Props) {
  const { lang } = useLangT();
  const cs = lang === 'cs';
  const [phase, setPhase] = useState<Phase>('idle');
  const mountRef = useRef<HTMLDivElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);

  const start = useCallback(async () => {
    setPhase('checking');

    // 1) Existuje model? Když ne, ukážeme „připravujeme" místo chyby.
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
      const host = mountRef.current;
      if (!host) return;

      const width = host.clientWidth || 640;
      const height = host.clientHeight || 420;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
      camera.position.set(0, 0.9, 3.4);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      host.appendChild(renderer.domElement);
      renderer.domElement.style.touchAction = 'none';
      renderer.domElement.style.cursor = 'grab';

      // Světla: teplé „svíčkové" světlo zespodu (lampion svítí), chladný
      // doplněk shora, ať je vidět gravírování.
      scene.add(new THREE.HemisphereLight(0xfff1d0, 0x141210, 1.15));
      const key = new THREE.DirectionalLight(0xffd98a, 2.1);
      key.position.set(2.5, 3.5, 2.5);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x88aaff, 0.55);
      rim.position.set(-3, 1.5, -2.5);
      scene.add(rim);
      const inner = new THREE.PointLight(0xffb347, 1.8, 6);
      inner.position.set(0, 0.15, 0);
      scene.add(inner);

      const pivot = new THREE.Group();
      scene.add(pivot);

      const loader = new GLTFLoader();
      let raf = 0;
      let disposed = false;
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      let spin = 0.004;

      const onDown = (e: PointerEvent) => {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        renderer.domElement.style.cursor = 'grabbing';
        renderer.domElement.setPointerCapture(e.pointerId);
      };
      const onMove = (e: PointerEvent) => {
        if (!dragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        pivot.rotation.y += dx * 0.008;
        pivot.rotation.x = Math.max(-0.6, Math.min(0.6, pivot.rotation.x + dy * 0.005));
      };
      const onUp = (e: PointerEvent) => {
        dragging = false;
        renderer.domElement.style.cursor = 'grab';
        try {
          renderer.domElement.releasePointerCapture(e.pointerId);
        } catch {
          /* prohlížeč mohl pointer už uvolnit */
        }
      };
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        camera.position.z = Math.max(1.8, Math.min(6, camera.position.z + e.deltaY * 0.0016));
      };

      let resizeObserver: ResizeObserver | null = null;

      loader.load(
        modelUrl,
        (gltf) => {
          if (disposed) return;
          const model = gltf.scene;

          // Vycentrovat a zmenšit/natáhnout tak, aby model sedl do záběru
          // bez ohledu na to, v jakých jednotkách byl exportovaný.
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          model.position.sub(center);
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          const scale = 1.9 / maxDim;
          model.scale.setScalar(scale);
          model.position.multiplyScalar(scale);
          pivot.add(model);

          const animate = () => {
            raf = requestAnimationFrame(animate);
            if (!dragging) pivot.rotation.y += spin;
            renderer.render(scene, camera);
          };
          animate();
          setPhase('ready');

          resizeObserver = new ResizeObserver(() => {
            const w = host.clientWidth || width;
            const h = host.clientHeight || height;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
          });
          resizeObserver.observe(host);
        },
        undefined,
        () => {
          if (!disposed) setPhase('error');
        },
      );

      renderer.domElement.addEventListener('pointerdown', onDown);
      renderer.domElement.addEventListener('pointermove', onMove);
      renderer.domElement.addEventListener('pointerup', onUp);
      renderer.domElement.addEventListener('pointercancel', onUp);
      renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

      cleanupRef.current = () => {
        disposed = true;
        cancelAnimationFrame(raf);
        resizeObserver?.disconnect();
        renderer.domElement.removeEventListener('pointerdown', onDown);
        renderer.domElement.removeEventListener('pointermove', onMove);
        renderer.domElement.removeEventListener('pointerup', onUp);
        renderer.domElement.removeEventListener('pointercancel', onUp);
        renderer.domElement.removeEventListener('wheel', onWheel);
        renderer.dispose();
        renderer.domElement.remove();
        scene.clear();
      };
    } catch {
      setPhase('error');
    }
  }, [modelUrl]);

  const showPoster = phase === 'idle' || phase === 'checking' || phase === 'missing' || phase === 'error';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold font-display flex items-center gap-2">
          <Rotate3d className="w-5 h-5 text-rasta-gold" />
          {cs ? 'Lampion ve 3D' : 'Lantern in 3D'}
        </h2>
        <p className="text-xs text-gray-500">
          {cs ? 'Táhni pro otočení · kolečko přiblíží' : 'Drag to rotate · scroll to zoom'}
        </p>
      </div>

      <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-white/10 bg-black/40">
        {/* Plakát — vidí ho každý, kdo 3D nenačte */}
        {showPoster && (
          <>
            <img
              src={poster}
              alt={posterAlt ?? (cs ? 'Lampion Království srdce' : 'Kingdom of the Heart lantern')}
              loading="lazy"
              className={`h-full w-full object-cover ${phase === 'error' || phase === 'missing' ? 'opacity-45' : ''}`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          </>
        )}

        {/* Plátno pro three.js — mountuje se sem renderer */}
        <div ref={mountRef} className="absolute inset-0 [&>canvas]:h-full [&>canvas]:w-full" />

        {/* Vrstva s akcí / stavem */}
        {phase !== 'ready' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
            {phase === 'idle' && (
              <>
                <button
                  type="button"
                  onClick={start}
                  className="raised inline-flex items-center gap-2 rounded-xl border border-rasta-gold/45 bg-rasta-gold/15 px-5 py-2.5 text-sm font-bold text-rasta-gold transition-colors hover:bg-rasta-gold/25"
                >
                  <Box className="h-4 w-4" />
                  {cs ? 'Načíst 3D náhled' : 'Load the 3D preview'}
                </button>
                <p className="max-w-xs text-[11px] leading-snug text-gray-400">
                  {cs
                    ? 'Model se stahuje až po kliknutí — kvůli rychlosti stránky.'
                    : 'The model downloads only after you click — to keep the page fast.'}
                </p>
              </>
            )}

            {phase === 'checking' && (
              <span className="inline-flex items-center gap-2 text-sm text-gray-300">
                <Loader2 className="h-4 w-4 animate-spin" /> {cs ? 'Zjišťuji model…' : 'Checking the model…'}
              </span>
            )}

            {phase === 'loading' && (
              <span className="inline-flex items-center gap-2 text-sm text-gray-300">
                <Loader2 className="h-4 w-4 animate-spin" /> {cs ? 'Načítám 3D model…' : 'Loading the 3D model…'}
              </span>
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
          ? 'Interaktivní náhled pro představu o tvaru a gravírování. Výrobní geometrii určuje technická dokumentace, ne 3D náhled.'
          : 'An interactive preview of shape and engraving. Production geometry is defined by the technical documentation, not this preview.'}
      </p>
    </div>
  );
}
