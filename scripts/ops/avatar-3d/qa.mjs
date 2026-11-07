#!/usr/bin/env node
/**
 * QA kontaktní list pro 3D avatary.
 *
 * Pro každé ID vykreslí čtyři pohledy (front / 3-4 / side / back) a vlevo
 * připojí oficiální portrét, aby se dala podoba porovnat. Jeden WebGL
 * renderer, `setScissorTest` na buňku; portréty a popisky jsou DOM vrstva
 * pod plátnem (WebGL kontext a 2D kontext nejdou míchat na jednom canvasu).
 *
 * Použití:
 *   node scripts/ops/avatar-3d/qa.mjs --stage .artifacts/avatar-3d/stage \
 *     --out .artifacts/avatar-3d/qa --ids 000,003,051
 *
 * Předpokládá statický server nad repem (výchozí http://127.0.0.1:8769).
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const STAGE = resolve(value('stage', '.artifacts/avatar-3d/stage'));
const OUT = resolve(value('out', '.artifacts/avatar-3d/qa'));
const BASE = value('base', 'http://127.0.0.1:8769');
const CHROME = value('chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const IDS = (value('ids', '') || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (IDS.length === 0) {
  console.error('chybí --ids 000,003,051');
  process.exit(2);
}

const roster = JSON.parse(await readFile(join(repo, 'V31/L4/oasis/data/avatars.json'), 'utf8')).avatars;
const byId = new Map(roster.map((a) => [String(a.id).padStart(3, '0'), a]));

const CELL = 260;
const LABEL = 34;
const COLUMNS = 5;
const pageWidth = CELL * COLUMNS;
const pageHeight = (CELL + LABEL) * IDS.length;

const cells = IDS.map((id, row) => {
  const avatar = byId.get(id);
  const portraitFile = avatar?.image_url?.split('/').pop() ?? '';
  return {
    id,
    row,
    name: avatar?.name ?? '?',
    model: `${BASE}/.artifacts/avatar-3d/stage/${id}/${id}.glb`,
    portrait: `${BASE}/apps/website-v2.9/public/oasis-assets/final_portraits/${portraitFile}`,
  };
});

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#0e1018;color:#e6ebf5;font:12px system-ui}
  #wrap{position:relative;width:${pageWidth}px;height:${pageHeight}px}
  .cell{position:absolute;width:${CELL}px;height:${CELL}px;object-fit:cover;background:#151a26}
  .label{position:absolute;left:8px;color:#c9d4e6;font:600 13px system-ui}
  #gl{position:absolute;left:0;top:0}
</style>
<script type="importmap">{"imports":{"three":"${BASE}/node_modules/three/build/three.module.js","three/addons/":"${BASE}/node_modules/three/examples/jsm/"}}</script>
</head><body><div id="wrap">
${cells
  .map(
    (cell) =>
      `<img class="cell" src="${cell.portrait}" style="top:${cell.row * (CELL + LABEL)}px" alt="">` +
      `<span class="label" style="top:${cell.row * (CELL + LABEL) + CELL + 20}px">${cell.id} · ${cell.name}</span>`,
  )
  .join('\n')}
<canvas id="gl"></canvas></div>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const CELL=${CELL}, LABEL=${LABEL}, COLS=${COLUMNS};
const cells=${JSON.stringify(cells)};
const canvas=document.getElementById('gl');
canvas.width=${pageWidth}; canvas.height=${pageHeight};
canvas.style.width='${pageWidth}px'; canvas.style.height='${pageHeight}px';

const renderer=new THREE.WebGLRenderer({canvas, antialias:true, alpha:true, preserveDrawingBuffer:true});
renderer.setSize(${pageWidth}, ${pageHeight}, false);
renderer.setScissorTest(true);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.setClearColor(0x151a26, 1);

const scene=new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xdfe8ff,0x2a2438,1.7));
const key=new THREE.DirectionalLight(0xffffff,2.3); key.position.set(3,5,4); scene.add(key);
const rim=new THREE.DirectionalLight(0x9db8ff,1.0); rim.position.set(-4,2,-5); scene.add(rim);

const loader=new GLTFLoader();
const camera=new THREE.PerspectiveCamera(32,1,0.01,200);
camera.aspect=1; camera.updateProjectionMatrix();
const ANGLES=[0,40,90,180];

for(const cell of cells){
  // WebGL má počátek vlevo dole, DOM vlevo nahoře.
  const y=(${cells.length}-1-cell.row)*(CELL+LABEL);
  let root=null;
  try{
    const gltf=await loader.loadAsync(cell.model);
    const box=new THREE.Box3().setFromObject(gltf.scene);
    const size=box.getSize(new THREE.Vector3());
    const center=box.getCenter(new THREE.Vector3());
    const scale=1/Math.max(size.y,1e-6);
    const holder=new THREE.Group();
    holder.add(gltf.scene);
    gltf.scene.position.set(-center.x,-center.y,-center.z);
    holder.scale.setScalar(scale);
    scene.add(holder);
    root=holder;
    const radius=box.getBoundingSphere(new THREE.Sphere()).radius*scale;
    const dist=radius/Math.sin((camera.fov*Math.PI)/360)*1.05;
    for(let i=0;i<ANGLES.length;i++){
      const a=(ANGLES[i]*Math.PI)/180;
      camera.position.set(Math.sin(a)*dist,0,Math.cos(a)*dist);
      camera.lookAt(0,0,0);
      camera.updateMatrixWorld();
      renderer.setViewport((i+1)*CELL,y,CELL,CELL);
      renderer.setScissor((i+1)*CELL,y,CELL,CELL);
      renderer.render(scene,camera);
    }
    scene.remove(root);
  }catch(error){
    console.error('load failed', cell.id, error.message);
    const ctx=canvas.getContext('2d');
    if(ctx){ ctx.save(); ctx.fillStyle='#3a1420'; ctx.fillRect(CELL,y,CELL*4,CELL); ctx.restore(); }
  }
}
window.qaDone=true;
</script></body></html>`;

await mkdir(OUT, { recursive: true });
const htmlPath = join(OUT, '_qa.html');
await writeFile(htmlPath, html);

const browser = await puppeteer.launch({
  executablePath: existsSync(CHROME) ? CHROME : undefined,
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--enable-gpu', '--no-sandbox'],
});
const tab = await browser.newPage();
await tab.setViewport({ width: pageWidth, height: Math.min(pageHeight, 2000) });
tab.on('pageerror', (error) => console.error('pageerror', error.message));
await tab.goto(`${BASE}/.artifacts/avatar-3d/qa/_qa.html`);
await tab.waitForFunction('window.qaDone === true', { timeout: 180000 });

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const png = join(OUT, `${stamp}.png`);
await tab.screenshot({ path: png, captureBeyondViewport: true, fullPage: true });
await writeFile(
  join(OUT, `${stamp}.json`),
  JSON.stringify({ ids: IDS, columns: COLUMNS, cell: CELL, stage: STAGE, createdAt: stamp }, null, 1) + '\n',
);
await browser.close();
console.log(png);
