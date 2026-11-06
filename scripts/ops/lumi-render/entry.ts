/**
 * Render lampionu Lumi 2 do kontrolního sheetu.
 *
 * Proč headless Chromium: výstup musí být **pohled na skutečný model, který
 * jde do marketu**, ne ilustrace. Kdyby si skript kreslil vlastní scénu, mohl
 * by schválit něco, co zákazník uvidí jinak.
 *
 * Na rozdíl od `fleet-render` se tu **nepřepisuje materiál**: tři materiály
 * modelu (`Překližka` / `Řez` / `Gravír`) nesou informaci, kterou je potřeba
 * zkontrolovat — světlá plocha, opálená hrana řezu a tmavý gravír. Kdyby je
 * skript přemaloval, kontrola by neměla smysl.
 *
 * Uvnitř svítí „svíčka" — stejně jako v `Lantern3D.tsx`, který lampion
 * v marketu rozsvěcí. Bez ní jsou výřezy jen díry do tmy.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const WIDTH = 1600;
const HEIGHT = 900;
/** Horní pruh je pro titulek, zbytek plátna se dělí do mřížky pohledů. */
const HEAD = 132;

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(WIDTH, HEIGHT, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
// čtyři pohledy = čtyři `render()` volání; autoClear by smazal předchozí
renderer.autoClear = false;
renderer.setScissorTest(true);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0a0c12');

/** Dřevo je matné, ale odlesky z místnosti mu dají plasticitu. */
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

function addLights() {
  const key = new THREE.DirectionalLight('#fff0d0', 1.1);
  key.position.set(0.6, 1.2, 0.8);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#8fb4ff', 0.8);
  rim.position.set(-0.9, 0.5, -0.8);
  scene.add(rim);
  const fill = new THREE.DirectionalLight('#ffd9a8', 0.45);
  fill.position.set(-0.8, 0.6, 0.5);
  scene.add(fill);
  scene.add(new THREE.AmbientLight('#3a4256', 0.35));
  // svíčka uvnitř — rozsvítí výřezy zevnitř (stejná role jako v Lantern3D)
  const candle = new THREE.PointLight('#ffa63c', 0.9, 0.42, 2);
  candle.position.set(0, 0.045, 0);
  scene.add(candle);
}

const views: Array<{ name: string; dir: [number, number, number]; lift: number }> = [
  { name: 'ČELNÍ', dir: [0, 0.16, 1], lift: 0 },
  { name: 'TŘI ČTVRTĚ', dir: [0.9, 0.45, 0.85], lift: 0.05 },
  { name: 'KORUNA (DETAIL)', dir: [0.25, 1, 0.32], lift: 0.02 },
  { name: 'BOK', dir: [1, 0.1, 0.02], lift: 0 },
];

/**
 * Šest stěn po 60° — kontrola, že pořadí motivů sedí na výpal
 * (první stěna čistý lotos, třetí loď — viz `03_Navody/Navod.md`).
 */
const turntable: Array<{ name: string; dir: [number, number, number]; lift: number }> = Array.from(
  { length: 6 },
  (_, index) => {
    const angle = (index * Math.PI) / 3;
    return {
      name: `STĚNA ${index + 1}`,
      dir: [Math.sin(angle), 0.12, Math.cos(angle)] as [number, number, number],
      lift: 0,
    };
  },
);

/** Jeden záběr bez titulku — podklad pro fotografii produktu. */
const hero: Array<{ name: string; dir: [number, number, number]; lift: number }> = [
  { name: '', dir: [0.62, 0.33, 1], lift: 0 },
];

/**
 * DOSADÍ kameru tak, aby model vyplnil buňku.
 *
 * Koule opsaná bboxu je pro lampion (vysoký 0,126 m, široký 0,14 m, ale
 * koruna je placka) nadsazená, takže by model zabíral polovinu buňky. Proto
 * se počítá skutečný průmět osmi rohů bboxu do kamery.
 */
function frameCamera(
  camera: THREE.PerspectiveCamera,
  dir: [number, number, number],
  box: THREE.Box3,
  aspect: number,
) {
  const center = box.getCenter(new THREE.Vector3());
  const forward = new THREE.Vector3(...dir).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();
  const up = new THREE.Vector3().crossVectors(forward, right).normalize();

  const fovY = (camera.fov * Math.PI) / 180;
  const tanY = Math.tan(fovY / 2);
  const tanX = tanY * aspect;
  const corner = new THREE.Vector3();

  let distance = 0;
  for (let index = 0; index < 8; index += 1) {
    corner.set(
      index & 1 ? box.max.x : box.min.x,
      index & 2 ? box.max.y : box.min.y,
      index & 4 ? box.max.z : box.min.z,
    ).sub(center);
    const along = corner.dot(forward);
    distance = Math.max(
      distance,
      Math.abs(corner.dot(right)) / tanX + along,
      Math.abs(corner.dot(up)) / tanY + along,
    );
  }

  camera.position.copy(center).addScaledVector(forward, distance * 1.06);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

declare global {
  interface Window {
    __ready: boolean;
    __render: (url: string, meta: Record<string, string>) => Promise<void>;
  }
}

window.__ready = false;

window.__render = async (url: string, meta: Record<string, string>) => {
  document.getElementById('title')!.textContent = meta.name ?? '—';
  document.getElementById('subtitle')!.textContent = meta.subtitle ?? '';
  document.getElementById('meta')!.innerHTML = [meta.dims, meta.materials, meta.flags]
    .filter(Boolean)
    .join('<br/>');

  scene.clear();
  addLights();

  const gltf = await new Promise<THREE.Group>((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(url, (result) => resolve(result.scene), undefined, reject);
  });

  const model = gltf.clone(true);
  model.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    // destičky jsou otevřené plochy — rub musí být vidět stejně jako líc
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      const std = material as THREE.MeshStandardMaterial;
      if ('side' in std) std.side = THREE.DoubleSide;
    }
    mesh.geometry.computeBoundingSphere();
  });
  scene.add(model);

  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  box.setFromObject(model);

  renderer.setScissorTest(false);
  renderer.clear();
  renderer.setScissorTest(true);

  const chosen = meta.mode === 'turntable' ? turntable : meta.mode === 'hero' ? hero : views;
  const head = chosen.length > 1 ? HEAD : 0;
  const columns = chosen.length === 6 ? 3 : chosen.length === 1 ? 1 : 2;
  const rows = Math.ceil(chosen.length / columns);
  const cellWidth = WIDTH / columns;
  const cellHeight = (HEIGHT - head) / rows;

  const labels = document.getElementById('labels')!;
  labels.innerHTML = '';
  if (chosen.length > 1) {
    chosen.forEach((view, index) => {
      const label = document.createElement('div');
      label.className = 'view';
      label.textContent = view.name;
      label.style.left = `${(index % columns) * cellWidth + 24}px`;
      label.style.top = `${head + Math.floor(index / columns) * cellHeight + 8}px`;
      labels.appendChild(label);
    });
  }

  const aspect = cellWidth / cellHeight;
  chosen.forEach((view, index) => {
    const camera = new THREE.PerspectiveCamera(32, aspect, 0.001, 20);
    const lifted = box.clone();
    if (view.lift) lifted.expandByVector(new THREE.Vector3(0, view.lift, 0));
    frameCamera(camera, view.dir, lifted, aspect);
    const column = index % columns;
    const row = Math.floor(index / columns);
    // WebGL má počátek vlevo dole, DOM vlevo nahoře
    const x = column * cellWidth;
    const y = HEIGHT - head - (row + 1) * cellHeight;
    renderer.setViewport(x, y, cellWidth, cellHeight);
    renderer.setScissor(x, y, cellWidth, cellHeight);
    renderer.render(scene, camera);
  });

  renderer.setScissorTest(false);
  window.__ready = true;
};
