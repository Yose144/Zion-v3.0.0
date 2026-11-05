/**
 * Render stíhaček z marketu do turnaround sheetu.
 *
 * Proč headless Chromium: výstup musí být **pohled na skutečný herní model**
 * (stejný GLB, stejný materiál jako v Nirvaně), ne ilustrace. Kdyby si skript
 * kreslil vlastní scénu, mohl by schválit něco, co ve hře vypadá jinak.
 *
 * `window.__ready` drží hotový render — Puppeteer na něj čeká a udělá
 * screenshot celého `#frame` (plátno + popisky v DOM).
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const WIDTH = 1600;
const HEIGHT = 900;
/** Horní pruh je pro titulek, zbytek plátna se dělí na 2×2 pohledy. */
const HEAD = 132;
const CELL_W = WIDTH / 2;
const CELL_H = (HEIGHT - HEAD) / 2;

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
scene.background = new THREE.Color('#080b12');

/**
 * Prostředí místo „metal = černá".
 *
 * Kovový materiál bez `environment` odráží jen prázdno, takže loď zčerná —
 * přesně to se stalo v prvním běhu. `RoomEnvironment` je neutrální studio
 * (žádný stažený HDR), takže se dá použít i ve hře bez assetu navíc.
 */
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

/** Světla: teplé klíčové, studené protisvětlo, slabý doplněk. */
function addLights() {
  const key = new THREE.DirectionalLight('#fff3dd', 1.5);
  key.position.set(2.4, 3.2, 2.6);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#9ec7ff', 0.9);
  rim.position.set(-3, -1.2, -2.4);
  scene.add(rim);
  const fill = new THREE.DirectionalLight('#ffd9a8', 0.6);
  fill.position.set(-2.4, 1.6, 1.2);
  scene.add(fill);
  scene.add(new THREE.AmbientLight('#4a5568', 0.3));
}

/**
 * Herní materiál — stejný jako v `core/fleet/FleetScene.tsx`.
 * Destičky jsou otevřené plochy, takže `DoubleSide` je nutnost: mezerami
 * mezi nimi je vidět rub a ten se musí vykreslit jako tmavá spára.
 */
function hullMaterial() {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    metalness: 0.3,
    roughness: 0.42,
    envMapIntensity: 0.9,
    side: THREE.DoubleSide,
  });
}

const views: Array<{ name: string; dir: [number, number, number] }> = [
  { name: 'PŘÍĎ', dir: [0, 0.18, 1] },
  { name: 'TŘI ČTVRTĚ', dir: [0.85, 0.42, 0.9] },
  { name: 'BOK', dir: [1, 0.1, 0.02] },
  { name: 'ZÁĎ', dir: [-0.18, 0.24, -1] },
];

/**
 * DOSADÍ kameru tak, aby model vyplnil buňku.
 *
 * Koule opsaná celému bboxu je pro plochou loď (křídla do šířky, trup do
 * délky) hrubě nadsazená — loď pak zabírá třetinu buňky a detail je
 * nečitelný. Proto se počítá skutečný průmět osmi rohů bboxu do kamery
 * a bere se nejmenší vzdálenost, ve které se všechny vejdou.
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

  // kamera stojí v `center + forward·d`; roh se vejde, když
  //   |right·c'| ≤ (d − forward·c')·tanX   a totéž pro `up`
  // (c' = roh − střed), takže d = |osa·c'|/tan + forward·c'
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

  camera.position.copy(center).addScaledVector(forward, distance * 1.03);
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
  document.getElementById('meta')!.innerHTML = [meta.dims, meta.tris, meta.flags].filter(Boolean).join('<br/>');

  scene.clear();
  addLights();

  const gltf = await new Promise<THREE.Group>((resolve, reject) => {
    new GLTFLoader().load(url, (result) => resolve(result.scene), undefined, reject);
  });

  const model = gltf.clone(true);
  model.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = hullMaterial();
    mesh.geometry.computeBoundingSphere();
    mesh.geometry.computeBoundingBox();
  });
  scene.add(model);

  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  box.setFromObject(model);

  renderer.setScissorTest(false);
  renderer.clear();
  renderer.setScissorTest(true);

  const aspect = CELL_W / CELL_H;
  views.forEach((view, index) => {
    const camera = new THREE.PerspectiveCamera(34, aspect, 0.01, 400);
    frameCamera(camera, view.dir, box, aspect);
    const column = index % 2;
    const row = Math.floor(index / 2);
    // WebGL má počátek vlevo dole, DOM vlevo nahoře
    const x = column * CELL_W;
    const y = HEIGHT - HEAD - (row + 1) * CELL_H;
    renderer.setViewport(x, y, CELL_W, CELL_H);
    renderer.setScissor(x, y, CELL_W, CELL_H);
    renderer.render(scene, camera);
  });

  renderer.setScissorTest(false);
  window.__ready = true;
};
