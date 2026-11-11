#!/usr/bin/env node
/**
 * Z výpalových podkladů (A3 SVG) postaví 3D model lucerny Lumi 2.
 *
 * Vstup: `Lumi_2_A3_1ku1.svg` z balíčku motivů — devět cest v pořadí
 * šest stěn, zdobený vršek, dno a zkušební proužek. Všechny cesty jsou
 * uzavřené polylinie (M/L/Z), takže se čtou bez závislosti na parseru.
 *
 * Výstup: GLB v metrech, Y nahoru, se jmenovanými objekty
 * (`stena-01…06`, `vrsek`, `dno`) a dvěma materiály (`Preklizka` na
 * plochách, `Rez` na hranách). Model se sestaví podle skutečné geometrie:
 * stěny stojí na šestiúhelníku o poloměru 65 mm (apotéma 65√3/2), desky
 * mají průměr 140 mm a drážky se čtou z výpalu, ne odhadem.
 *
 * Použití (z apps/lumi):
 *   node scripts/build-lantern-models.mjs ../../heros/Lumi/<balíček> --slug <slug>
 *   node scripts/build-lantern-models.mjs --all
 */

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// `GLTFExporter` v Node nemá `FileReader` — používá ho jen k převodu
// výsledného Blobu na ArrayBuffer, takže stačí tenhle malý doplněk.
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob
        .arrayBuffer()
        .then((buffer) => {
          this.result = buffer;
          this.onloadend?.();
        })
        .catch((error) => {
          this.onerror?.(error);
        });
    }
  };
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..', '..');
const OUT_DIR = path.join(ROOT, 'public', 'models');

// ── Rozměry z konstrukce (mm) ──────────────────────────────────────────
const THICKNESS = 3; // březová překližka
const BODY_RADIUS = 65; // šestihran těla (vnější poloměr)
const APOTHEM = (BODY_RADIUS * Math.sqrt(3)) / 2; // 56,2917 mm — osa stěny
const MM = 0.001; // GLB je v metrech

// ── Sestavy, které se mají vyrobit ─────────────────────────────────────
const PACKS = [
  { slug: 'priroda', dir: 'Lumi_2_30_novych_motivu_A3_SVG_DXF/01_Priroda' },
  { slug: 'svatebni', dir: 'Lumi_2_30_novych_motivu_A3_SVG_DXF/02_Svatebni' },
  { slug: 'kvetinove', dir: 'Lumi_2_30_novych_motivu_A3_SVG_DXF/03_Kvetinove' },
  { slug: 'oceanske', dir: 'Lumi_2_30_novych_motivu_A3_SVG_DXF/04_Oceanske' },
  { slug: 'vesmirne', dir: 'Lumi_2_30_novych_motivu_A3_SVG_DXF/05_Vesmirne' },
  { slug: 'vanoce', dir: 'Lumi_2_Vanoce_FINAL' },
];

// ── Čtení SVG ──────────────────────────────────────────────────────────

/** Vytáhne `d` ze všech `<path>` v dokumentu. */
function parsePathData(svg) {
  return [...svg.matchAll(/<path[^>]*\bd="([^"]+)"/g)].map((match) => match[1]);
}

/** `M…L…Z M…L…Z` → pole uzavřených obrysů [[x, y], …]. */
function parseRings(d) {
  const rings = [];
  let current = null;
  for (const token of d.match(/[MLZ]|[-+]?\d*\.?\d+/g) ?? []) {
    if (token === 'M') {
      if (current && current.length > 6) rings.push(current);
      current = [];
    } else if (token === 'Z') {
      if (current && current.length > 6) rings.push(current);
      current = null;
    } else if (token !== 'L') {
      if (!current) current = [];
      current.push(Number(token));
    }
  }
  if (current && current.length > 6) rings.push(current);

  return rings.map((flat) => {
    const points = [];
    for (let i = 0; i < flat.length; i += 2) points.push([flat[i], flat[i + 1]]);
    return points;
  });
}

const signedArea = (points) => {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
};

const centroid = (points) => {
  let x = 0;
  let y = 0;
  for (const [px, py] of points) {
    x += px;
    y += py;
  }
  return [x / points.length, y / points.length];
};

function bboxOf(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** Bod v mnohoúhelníku (ray casting) — pro zařazení děr k obrysu. */
function pointInPolygon([px, py], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Zjednoduší uzavřený obrys (Douglas–Peucker). Drží tvar — tolerance
 * 0,15 mm je hluboko pod tloušťkou čáry řezu — a zmenší počet bodů
 * i několikanásobně, což je rozhodující pro velikost GLB.
 *
 * Obrys se rozdělí na dva oblouky mezi dvěma nejvzdálenějšími body;
 * na každý se pustí klasické DP. Tím zůstane zachovaný tvar i počet
 * bodů (jednoprůchodové mazání umí obrys zhroutit na pár bodů).
 */
function simplifyRing(points, tol = 0.15) {
  if (points.length < 8) return points;

  const distanceToSegment = ([px, py], [ax, ay], [bx, by]) => {
    const dx = bx - ax;
    const dy = by - ay;
    const length = dx * dx + dy * dy;
    if (length === 0) return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  };

  const douglasPeucker = (line) => {
    if (line.length < 3) return line;
    const first = line[0];
    const last = line[line.length - 1];
    let index = -1;
    let maxDistance = tol;
    for (let i = 1; i < line.length - 1; i += 1) {
      const distance = distanceToSegment(line[i], first, last);
      if (distance > maxDistance) {
        index = i;
        maxDistance = distance;
      }
    }
    if (index === -1) return [first, last];
    const left = douglasPeucker(line.slice(0, index + 1));
    const right = douglasPeucker(line.slice(index));
    return left.slice(0, -1).concat(right);
  };

  let far = 0;
  let maxDistance = -1;
  for (let i = 1; i < points.length; i += 1) {
    const distance = (points[i][0] - points[0][0]) ** 2 + (points[i][1] - points[0][1]) ** 2;
    if (distance > maxDistance) {
      maxDistance = distance;
      far = i;
    }
  }

  const firstArc = douglasPeucker(points.slice(0, far + 1));
  const secondArc = douglasPeucker(points.slice(far).concat([points[0]]));
  const out = firstArc.slice(0, -1).concat(secondArc.slice(0, -1));
  return out.length >= 3 ? out : points;
}

/**
 * Rozdělí obrysy na vnější a díry. Vnější obrys = sudá hloubka vnoření,
 * díra = lichá; díra patří nejbližšímu nadřazenému vnějšímu obrysu.
 */
function classifyRings(rings) {
  const entries = rings
    .map((points) => ({ points, area: Math.abs(signedArea(points)), bbox: bboxOf(points), center: centroid(points) }))
    .sort((a, b) => b.area - a.area);

  const shapes = [];
  for (const entry of entries) {
    let parent = null;
    for (const candidate of shapes) {
      const box = candidate.bbox;
      const insideBox =
        entry.bbox.minX >= box.minX - 0.01 &&
        entry.bbox.maxX <= box.maxX + 0.01 &&
        entry.bbox.minY >= box.minY - 0.01 &&
        entry.bbox.maxY <= box.maxY + 0.01;
      if (insideBox && pointInPolygon(entry.center, candidate.points)) parent = candidate;
    }

    if (!parent) {
      const shape = { points: entry.points, area: entry.area, bbox: entry.bbox, holes: [], depth: 0, parent: null };
      shapes.push(shape);
      entry.shape = shape;
    } else {
      // Liché vnoření = díra; sudé = samostatný kus (dřevěný ostrůvek).
      if (parent.depth % 2 === 0) {
        parent.holes.push(entry.points);
        entry.shape = parent;
      } else {
        const shape = {
          points: entry.points,
          area: entry.area,
          bbox: entry.bbox,
          holes: [],
          depth: parent.depth + 1,
          parent,
        };
        shapes.push(shape);
        entry.shape = shape;
      }
    }
    entry.depth = entry.shape.depth;
  }

  return shapes.filter((shape) => shape.depth % 2 === 0);
}

// ── 3D ─────────────────────────────────────────────────────────────────

function geometryForShape(shape, thickness) {
  const contour = shape.points.map(([x, y]) => new THREE.Vector2(x, y));
  const withHoles = new THREE.Shape(contour);
  if (shape.holes.length > 0) {
    // `ExtrudeGeometry` bere díry přes `Shape.holes` (nastavují se před
    // triangulací), proto se staví rovnou s nimi.
    withHoles.holes = shape.holes.map(
      (hole) => new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))),
    );
  }
  const geometry = new THREE.ExtrudeGeometry(withHoles, {
    depth: thickness,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 1,
  });
  // Střed tloušťky v nule — stěna se pak otáčí kolem své osy.
  geometry.translate(0, 0, -thickness / 2);
  return geometry;
}

const woodMaterial = new THREE.MeshStandardMaterial({
  name: 'Překližka',
  color: new THREE.Color('#d8b98d'),
  roughness: 0.78,
  metalness: 0.02,
});

const cutMaterial = new THREE.MeshStandardMaterial({
  name: 'Řez',
  color: new THREE.Color('#6f4f32'),
  roughness: 0.9,
  metalness: 0.02,
});

/** Jeden díl = jeden mesh na každý vnější obrys (stěna má jediný). */
function meshesForPart(shapes, { name, thickness = THICKNESS }) {
  return shapes.map((shape, index) => {
    const raw = geometryForShape(shape, thickness);
    // Extrudační geometrie je neindexovaná (každý trojúhelník vlastní
    // vrcholy). Svaření podle pozice + normály + UV zmenší soubor i paměť.
    const geometry = mergeVertices(raw, 1e-3);
    raw.dispose();
    // Skupiny [0] = plochy, [1] = hrany řezu.
    const mesh = new THREE.Mesh(geometry, [woodMaterial, cutMaterial]);
    mesh.name = shapes.length > 1 ? `${name}-${String(index + 1).padStart(2, '0')}` : name;
    return mesh;
  });
}

const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Sestaví lucernu. Pracuje v „souřadnicích archu“ (x doprava, y dolů),
 * takže drážky i stěny sedí na stejné mřížce; nakonec celý model otočí
 * o 180° kolem X, aby Y mířilo nahoru (otočení, ne zrcadlení — normály
 * zůstanou správně).
 */
function assemble(parts) {
  const root = new THREE.Group();
  root.name = 'Lumi-2';

  const sheet = new THREE.Group();
  sheet.name = 'sestava';
  root.add(sheet);

  // ── Dno a vršek: vodorovné desky ────────────────────────────────────
  const plateRotation = -Math.PI / 2; // (x, y, z) → (x, z, −y)

  const plateGroup = (meshes, { center, y }) => {
    const group = new THREE.Group();
    for (const mesh of meshes) {
      // Střed desky do počátku (v rovině archu), tloušťka už je vycentrovaná.
      mesh.geometry.translate(-center[0], -center[1], 0);
      mesh.rotation.x = plateRotation;
      mesh.position.y = y;
      group.add(mesh);
    }
    return group;
  };

  const bottomShapes = classifyRings(parts.bottom);
  const topShapes = classifyRings(parts.top);

  const bottomCenter = bboxCenter(parts.bottom);
  const topCenter = bboxCenter(parts.top);

  // Dno: v souřadnicích archu 0…−3 (po otočení modelu 0…3 mm).
  sheet.add(plateGroup(meshesForPart(bottomShapes, { name: 'dno' }), { center: bottomCenter, y: -THICKNESS / 2 }));
  // Vršek: −123…−126 mm.
  sheet.add(
    plateGroup(meshesForPart(topShapes, { name: 'vrsek' }), {
      center: topCenter,
      y: -120 - THICKNESS - THICKNESS / 2,
    }),
  );

  // ── Stěny: šest stěn na šestihranu ─────────────────────────────────
  parts.walls.forEach((wallRings, index) => {
    const shapes = classifyRings(wallRings);
    if (shapes.length === 0) return;

    const box = bboxOf(wallRings.flat());
    const centerX = (box.minX + box.maxX) / 2;
    // V souřadnicích archu je „nahoru“ −y: spodní hrana (větší y) → 0.
    for (const mesh of meshesForPart(shapes, { name: `stena-${String(index + 1).padStart(2, '0')}` })) {
      mesh.geometry.translate(-centerX, -box.maxY, -THICKNESS / 2);
      // Otočení stěny: +Z (tloušťka) míří ven z šestihranu.
      const beta = toRad(30 + index * 60); // úhel drážek v archu
      const alpha = Math.PI / 2 + beta;
      mesh.rotation.y = alpha;
      mesh.position.set(Math.sin(alpha) * APOTHEM, 0, Math.cos(alpha) * APOTHEM);
      sheet.add(mesh);
    }
  });

  // ── Do světa: Y nahoru ──────────────────────────────────────────────
  sheet.rotation.x = Math.PI;
  root.updateMatrixWorld(true);
  return root;
}

function bboxCenter(rings) {
  const box = bboxOf(rings.flat());
  return [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2];
}

// ── Export ─────────────────────────────────────────────────────────────

async function exportGlb(scene, file) {
  const exporter = new GLTFExporter();
  const arrayBuffer = await new Promise((resolve, reject) => {
    exporter.parse(scene, resolve, reject, { binary: true, onlyVisible: false });
  });
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, Buffer.from(arrayBuffer));
  return arrayBuffer.byteLength;
}

async function build(pack) {
  const dir = path.join(REPO, 'heros', 'Lumi', pack.dir);
  const svgFile = path.join(dir, 'Lumi_2_A3_1ku1.svg');
  if (!existsSync(svgFile)) throw new Error(`Chybí ${svgFile}`);

  const svg = await fs.readFile(svgFile, 'utf8');
  const paths = parsePathData(svg);
  if (paths.length !== 9) throw new Error(`${pack.slug}: čekal jsem 9 cest, je jich ${paths.length}`);

  const rings = paths.map(parseRings);

  // Tolerance: stěny 0,15 mm, zdobený vršek 0,3 mm (nejvíc bodů, nejmenší
  // vliv na siluetu) — hluboko pod tloušťkou čáry řezu 0,08 mm × 3 mm.
  const walls = rings.slice(0, 6).map((list) => list.map((ring) => simplifyRing(ring, 0.15)));
  const top = rings[6].map((ring) => simplifyRing(ring, 0.3));
  const bottom = rings[7].map((ring) => simplifyRing(ring, 0.15));

  const root = assemble({ walls, top, bottom });
  root.name = `Lumi-2-${pack.slug}`;

  let vertices = 0;
  let triangles = 0;
  root.traverse((object) => {
    if (!object.isMesh) return;
    const geometry = object.geometry;
    vertices += geometry.getAttribute('position').count;
    triangles += (geometry.index ? geometry.index.count : geometry.getAttribute('position').count) / 3;
    if (process.argv.includes('--debug')) {
      const meshBox = new THREE.Box3().setFromObject(object);
      const meshSize = meshBox.getSize(new THREE.Vector3());
      const points = geometry.getAttribute('position').count;
      console.log(
        `    ${object.name.padEnd(12)} ${(points / 1000).toFixed(1).padStart(7)}k vrcholů · bbox ` +
          `${(meshBox.min.x * 1000).toFixed(0)}…${(meshBox.max.x * 1000).toFixed(0)} × ` +
          `${(meshBox.min.y * 1000).toFixed(0)}…${(meshBox.max.y * 1000).toFixed(0)} × ` +
          `${(meshBox.min.z * 1000).toFixed(0)}…${(meshBox.max.z * 1000).toFixed(0)} mm · ` +
          `velikost ${(meshSize.x * 1000).toFixed(0)}×${(meshSize.y * 1000).toFixed(0)}×${(meshSize.z * 1000).toFixed(0)}`,
      );
    }
  });
  // Měřítko do metrů.
  root.scale.setScalar(MM);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());

  const file = path.join(OUT_DIR, `lumi-2-${pack.slug}.glb`);
  const bytes = await exportGlb(root, file);

  console.log(
    `${pack.slug.padEnd(10)} ${triangles.toFixed(0).padStart(7)} trojúhelníků · ${vertices.toFixed(0).padStart(7)} vrcholů · ` +
      `${(bytes / 1024 / 1024).toFixed(2)} MB · ${(size.x * 1000).toFixed(0)}×${(size.y * 1000).toFixed(0)}×${(size.z * 1000).toFixed(0)} mm`,
  );

  return { slug: pack.slug, file, bytes, triangles };
}

// ── CLI ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.includes('--all')) {
  const results = [];
  for (const pack of PACKS) results.push(await build(pack));
  console.log(`\nHotovo: ${results.length} modelů v ${path.relative(REPO, OUT_DIR)}`);
} else {
  const dir = args.find((arg) => !arg.startsWith('--'));
  const slugIndex = args.indexOf('--slug');
  if (!dir || slugIndex === -1) {
    console.error('Použití: node scripts/build-lantern-models.mjs <balíček> --slug <slug> | --all');
    process.exit(1);
  }
  const slug = args[slugIndex + 1];
  await build({ slug, dir: path.relative(path.join(REPO, 'heros', 'Lumi'), path.resolve(dir)) });
}
