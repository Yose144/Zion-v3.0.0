'use client';

import { useEffect, useRef, useState } from 'react';
// typy zvlášť: `THREE` je uvnitř efektu lokální konstanta, takže se nedá
// použít v typových anotacích (TS2503)
import type * as Three from 'three';

/**
 * 3D náhled produktu — **stejný model jako ve hře**.
 *
 * Historicky tu bylo holé STL (`/shop/models/*.stl`) s jedním šedým
 * `MeshStandardMaterial`: vypadalo to jako CAD náhled, ne jako produkt.
 * Od 2026-11-05 se načítá **herní GLB** (`/shop/models3d/*.glb`), které
 * vzniká konverzí téhož STL (`scripts/ops/starfighter-glb.py`) a nese
 * panelový lak ve vrcholových barvách — takže karta v marketu ukazuje přesně
 * to, co hráč dostane v Nirvaně. Kdyby se modely rozešly, je to chyba.
 *
 * Tři věci, které se nesmí zjednodušit:
 *  1. **`side: DoubleSide`** — model je soubor otevřených destiček, mezerami
 *     mezi nimi je vidět rub; bez toho je loď děravá.
 *  2. **`scene.environment`** — kov (`metalness > 0`) odráží jen prostředí;
 *     bez něj je loď černá i při silných světlech (přesně to se stalo).
 *  3. **Kamera z bounding boxu** — pevná vzdálenost uřízne křídla u X-Wingu
 *     a nechá TIE Fighter jako tečku.
 *
 * STL zůstává podporované: některé produkty (a staré odkazy) ho pořád mají.
 */

/** Starší název — kvůli importům z jiných komponent. */
const LOCAL_MODEL = /^\/shop\/models3?d?\/[a-z0-9_-]+\.(stl|glb)$/i;

export function isLocalModel(url?: string | null): url is string {
  return typeof url === 'string' && LOCAL_MODEL.test(url);
}

/** @deprecated používá se `isLocalModel` (umí i `.glb`) */
export const isLocalStl = isLocalModel;

export default function StarfighterViewer({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState('táhni pro otočení');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isLocalModel(url)) return;
    canvas.style.touchAction = 'none';

    let stopped = false;
    let frame = 0;
    const disposers: Array<() => void> = [];

    (async () => {
      const THREE = await import('three');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
      const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');
      if (stopped) return;

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 200);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x111111, 0.55));
      const key = new THREE.DirectionalLight(0xfff3dd, 2.1);
      key.position.set(2.4, 3.2, 2.6);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xffd9a8, 0.7);
      fill.position.set(-2.4, 1.6, 1.2);
      scene.add(fill);
      // chladné protisvětlo — oddělí trup od tmavého pozadí karty
      const rim = new THREE.DirectionalLight(0x9ec7ff, 0.9);
      rim.position.set(-3, -1.2, -2.4);
      scene.add(rim);

      // kov potřebuje prostředí, jinak je černý
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.6;
      disposers.push(() => {
        scene.environment?.dispose();
        pmrem.dispose();
      });

      const grid = new THREE.GridHelper(200, 20, 0xc9a227, 0x1a3a1a);
      const gridMat = grid.material;
      if (!Array.isArray(gridMat)) {
        gridMat.opacity = 0.18;
        gridMat.transparent = true;
      }
      scene.add(grid);

      const controls = new OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = false;
      // `prefers-reduced-motion`: otáčení si člověk nevypne v naší UI,
      // nastavuje si ho v systému. Respektovat ho je WCAG 2.3.3.
      const reduced =
        typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      controls.autoRotate = !reduced;
      controls.autoRotateSpeed = 0.7;
      controls.maxPolarAngle = Math.PI * 0.92;
      disposers.push(() => controls.dispose());

      const resize = () => {
        const width = canvas.clientWidth || 1;
        const height = canvas.clientHeight || 1;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      disposers.push(() => observer.disconnect());

      /** Herní materiál — musí zůstat v syncu s `core/fleet/FleetScene.tsx`. */
      const hullMaterial = () =>
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          metalness: 0.3,
          roughness: 0.42,
          envMapIntensity: 0.9,
          side: THREE.DoubleSide,
        });

      /** DOSADÍ kameru tak, aby model vyplnil plátno (z bboxu, ne od oka). */
      const frameObject = (object: Three.Object3D) => {
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        object.position.sub(center);
        box.setFromObject(object);
        const radius = Math.max(size.x, size.y, size.z) * 0.5;
        const fov = (camera.fov * Math.PI) / 180;
        const distance = (radius / Math.sin(fov / 2)) * 1.15;
        camera.position.set(distance * 0.72, distance * 0.5, distance * 0.72);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();
      };

      const onModel = (object: Three.Object3D) => {
        if (stopped) return;
        scene.add(object);
        frameObject(object);
        setNote('táhni pro otočení · zelené tóny');
      };

      const glb = /\.glb$/i.test(url);

      /** Zpracování jednoho modelu — GLB má barvy i normály, STL ne. */
      const applyModel = (result: unknown) => {
        if (stopped) return;
        if (glb) {
          const root = (result as { scene: Three.Group }).scene;
          root.traverse((child: Three.Object3D) => {
            const mesh = child as Three.Mesh;
            if (!mesh.isMesh) return;
            const material = hullMaterial();
            mesh.material = material;
            disposers.push(() => material.dispose());
          });
          onModel(root);
          return;
        }
        const geometry = (result as Three.BufferGeometry).clone();
        geometry.computeVertexNormals();
        const material = hullMaterial();
        const mesh = new THREE.Mesh(geometry, material);
        const size = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
        mesh.scale.setScalar(1 / (Math.max(size.x, size.y, size.z) || 1));
        disposers.push(() => {
          geometry.dispose();
          material.dispose();
        });
        onModel(mesh);
      };

      const handleError = () => {
        if (!stopped) setFailed(true);
      };

      if (glb) {
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        new GLTFLoader().load(url, applyModel, undefined, handleError);
      } else {
        const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
        new STLLoader().load(url, applyModel, undefined, handleError);
      }

      const animate = () => {
        if (stopped) return;
        frame = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();
      disposers.push(() => {
        cancelAnimationFrame(frame);
        renderer.dispose();
      });
    })().catch(() => {
      if (!stopped) setFailed(true);
    });

    return () => {
      stopped = true;
      disposers.forEach((fn) => fn());
    };
  }, [url]);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="block h-full w-full touch-none" aria-label="3D náhled" />
      <div className="absolute bottom-3 left-3 text-[11px] text-rasta-gold/80 bg-black/50 px-2 py-1 rounded">
        {note}
      </div>
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
          3D náhled se nepodařilo načíst
        </div>
      )}
    </div>
  );
}
