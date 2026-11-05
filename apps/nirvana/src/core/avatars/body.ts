/**
 * AVATAR — tělo z primitiv, složené do **jedné geometrie**.
 *
 * Proč ne JSX s 40 meshi: ve hře se potká až 8 avatarů naráz a 8×40 meshů je
 * 320 draw callů jen za postavy. Tady se všechny díly zapečou do bufferu
 * s barvou ve vrcholech (`vertexColors`), takže postava = 1–3 draw calls
 * (tělo, kov, světlo) bez ohledu na počet detailů.
 *
 * Co se kreslí, plyne z `AvatarLook` (viz `kit.ts`): paprsek → barvy,
 * archetyp z podtitulu → silueta (zbroj, plášť, vlasy), vzácnost a CL →
 * koruna, aura, svítící oči. Žádné modely v repu nejsou a ani být nemusí.
 *
 * Souřadnice: postava stojí nohama na y = 0, referenční výška 1,75 m;
 * `AvatarModel` pak škáluje podle `look.height`.
 */

import * as THREE from 'three';
import type { AvatarLook } from './kit';

interface Piece {
  geometry: THREE.BufferGeometry;
  color: string;
}

export interface AvatarMeshData {
  /** Tělo, oděv, kůže — `MeshStandardMaterial` s vertexColors. */
  solid: THREE.BufferGeometry;
  /** Zbroj, spony, zbraně — kovový standard. */
  metal: THREE.BufferGeometry | null;
  /** Koruna, aura, oči, jádra — neosvětlené (`meshBasicMaterial`). */
  glow: THREE.BufferGeometry | null;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Ztmaví/ztlumí barvu — plášť nesmí svítit stejně jako trim. */
function shade(hex: string, factor: number): string {
  const value = hex.replace('#', '');
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const r = clamp(parseInt(value.slice(0, 2), 16) * factor);
  const g = clamp(parseInt(value.slice(2, 4), 16) * factor);
  const b = clamp(parseInt(value.slice(4, 6), 16) * factor);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

interface Transform {
  pos?: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number] | number;
}

/** Zapeče geometrii s transformací a barvou do dílu. */
function piece(geometry: THREE.BufferGeometry, color: string, transform: Transform = {}): Piece {
  const scale = transform.scale ?? 1;
  const matrix = new THREE.Matrix4().compose(
    V(...(transform.pos ?? [0, 0, 0])),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...(transform.rot ?? [0, 0, 0]))),
    typeof scale === 'number' ? V(scale, scale, scale) : V(...scale),
  );
  geometry.applyMatrix4(matrix);
  return { geometry, color };
}

/** Sloučí díly do jedné neindexované geometrie s barvou ve vrcholech. */
function merge(pieces: Piece[]): THREE.BufferGeometry | null {
  if (pieces.length === 0) return null;
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const color = new THREE.Color();

  for (const { geometry, color: hex } of pieces) {
    const source = geometry.index ? geometry.toNonIndexed() : geometry;
    const pos = source.getAttribute('position');
    const nor = source.getAttribute('normal');
    color.set(hex);
    for (let index = 0; index < pos.count; index += 1) {
      positions.push(pos.getX(index), pos.getY(index), pos.getZ(index));
      if (nor) normals.push(nor.getX(index), nor.getY(index), nor.getZ(index));
      colors.push(color.r, color.g, color.b);
    }
    if (source !== geometry) source.dispose();
    geometry.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length === positions.length) {
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  }
  merged.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return merged;
}

// ── proporce (referenční postava 1,75 m) ─────────────────────────────
const HIP_Y = 0.9;
const CHEST_Y = 1.26;
const SHOULDER_Y = 1.42;
const NECK_Y = 1.5;
const HEAD_Y = 1.62;

export function buildAvatarMesh(look: AvatarLook): AvatarMeshData {
  const solid: Piece[] = [];
  const metal: Piece[] = [];
  const glow: Piece[] = [];

  const width = look.width;
  const robe = look.palette.robe;
  const robeDark = shade(robe, 0.72);
  const trim = look.palette.trim;
  const glowColor = look.palette.glow;
  const skin = look.palette.skin;
  const hair = look.hairColor;
  const metalColor = look.metal;

  const px = (value: number) => value * width;

  // ── nohy a boty ─────────────────────────────────────────────────────
  for (const side of [-1, 1]) {
    solid.push(
      piece(new THREE.CylinderGeometry(px(0.062), px(0.075), 0.74, 10), robeDark, {
        pos: [side * px(0.095), 0.53, 0],
      }),
    );
    metal.push(
      piece(new THREE.CylinderGeometry(px(0.082), px(0.09), 0.18, 10), shade(metalColor, 0.8), {
        pos: [side * px(0.095), 0.09, 0.01],
      }),
    );
    solid.push(
      piece(new THREE.BoxGeometry(px(0.14), 0.07, 0.24), shade(robeDark, 0.85), {
        pos: [side * px(0.095), 0.035, 0.04],
      }),
    );
  }

  // ── plášť / sukně ───────────────────────────────────────────────────
  // Délka a šířka sukně závisí na střihu — tunic je krátký, armor má pláty.
  const skirtHeight = look.outfit === 'tunic' ? 0.52 : look.outfit === 'armor' ? 0.62 : 0.72;
  const skirtTopY = look.outfit === 'tunic' ? 0.62 : 0.5;
  const skirtBottom = look.outfit === 'tunic' ? px(0.245) : px(0.3);
  solid.push(
    piece(new THREE.CylinderGeometry(px(0.19), skirtBottom, skirtHeight, 18, 1, false), robe, {
      pos: [0, skirtTopY, 0],
    }),
  );
  // lem pláště
  metal.push(
    piece(new THREE.TorusGeometry(skirtBottom - px(0.01), px(0.014), 6, 24), trim, {
      pos: [0, skirtTopY - skirtHeight / 2, 0],
      rot: [Math.PI / 2, 0, 0],
    }),
  );
  // přední pruh látky — plášť nesmí být hladký kužel
  solid.push(
    piece(new THREE.BoxGeometry(px(0.062), skirtHeight * 0.92, 0.014), trim, {
      pos: [0, skirtTopY, px(skirtBottom * 0.74)],
      rot: [-0.055, 0, 0],
    }),
  );

  // střih: zbroj = pláty přes stehna, sárí = šikmá šerpa přes trup
  if (look.outfit === 'armor') {
    for (const side of [-1, 1]) {
      metal.push(
        piece(new THREE.BoxGeometry(px(0.16), 0.26, 0.05), shade(metalColor, 0.9), {
          pos: [side * px(0.15), 0.62, px(0.16)],
          rot: [0.12, side * 0.16, 0],
        }),
      );
      metal.push(
        piece(new THREE.CylinderGeometry(px(0.075), px(0.08), 0.3, 10), shade(metalColor, 0.75), {
          pos: [side * px(0.095), 0.32, 0.01],
        }),
      );
    }
  }
  if (look.outfit === 'sari') {
    solid.push(
      piece(new THREE.BoxGeometry(px(0.13), 0.62, 0.05), trim, {
        pos: [px(0.02), CHEST_Y - 0.04, px(0.16)],
        rot: [0, 0, 0.56],
      }),
    );
    solid.push(
      piece(new THREE.BoxGeometry(px(0.2), 0.3, 0.045), shade(trim, 0.9), {
        pos: [-px(0.19), SHOULDER_Y - 0.16, px(0.1)],
        rot: [0, 0, -0.3],
      }),
    );
  }
  if (look.outfit === 'tunic') {
    // viditelné nohavice — tunic končí nad koleny
    for (const side of [-1, 1]) {
      solid.push(
        piece(new THREE.CylinderGeometry(px(0.072), px(0.082), 0.42, 10), robeDark, {
          pos: [side * px(0.095), 0.42, 0],
        }),
      );
    }
  }

  // ── trup ────────────────────────────────────────────────────────────
  solid.push(
    piece(new THREE.CylinderGeometry(px(0.205), px(0.17), 0.58, 16), robe, {
      pos: [0, CHEST_Y - 0.08, 0],
    }),
  );
  // hrudní plát (jen bojovníci) nebo štóla
  if (look.pauldrons > 0) {
    // zaoblený kyrys místo krabice — krabice trčela rohy do prostoru
    metal.push(
      piece(new THREE.SphereGeometry(1, 18, 12), metalColor, {
        pos: [0, CHEST_Y + 0.03, 0.06],
        scale: [px(0.195), 0.17, 0.14],
      }),
    );
    glow.push(
      piece(new THREE.OctahedronGeometry(0.03, 0), glowColor, { pos: [0, CHEST_Y + 0.03, 0.2] }),
    );
  } else {
    solid.push(
      piece(new THREE.BoxGeometry(px(0.12), 0.44, 0.02), trim, {
        pos: [0, CHEST_Y - 0.02, 0.163],
        rot: [0, 0, 0.05],
      }),
    );
  }
  // pás
  metal.push(
    piece(new THREE.CylinderGeometry(px(0.19), px(0.19), 0.055, 16), shade(metalColor, 0.92), {
      pos: [0, HIP_Y + 0.03, 0],
    }),
  );
  metal.push(
    piece(new THREE.TorusGeometry(px(0.05), px(0.014), 6, 14), trim, {
      pos: [0, HIP_Y + 0.03, 0.19],
    }),
  );

  // ── ramena a pauldrony ──────────────────────────────────────────────
  for (const side of [-1, 1]) {
    solid.push(
      piece(new THREE.SphereGeometry(px(0.093), 14, 12), robe, {
        pos: [side * px(0.208), SHOULDER_Y, 0],
      }),
    );
    if (look.pauldrons > 0) {
      metal.push(
        piece(new THREE.SphereGeometry(px(0.098), 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), metalColor, {
          pos: [side * px(0.232), SHOULDER_Y - 0.01, 0],
          rot: [0, 0, side * 0.26],
        }),
      );
    }
    if (look.pauldrons > 1) {
      metal.push(
        piece(new THREE.SphereGeometry(px(0.086), 12, 9, 0, Math.PI * 2, 0, Math.PI * 0.58), shade(metalColor, 0.82), {
          pos: [side * px(0.252), SHOULDER_Y - 0.085, 0],
          rot: [0, 0, side * 0.46],
        }),
      );
    }
  }

  // ── paže ────────────────────────────────────────────────────────────
  for (const side of [-1, 1]) {
    // postoj: jinak stojí všech 202 postav jako vojáčci
    const raised = look.pose === 'raise' && side === 1;
    const open = look.pose === 'open';
    const guard = look.pose === 'guard';
    const armZ = raised ? -2.15 : open ? side * 0.34 : guard ? side * 0.12 : side * 0.04;
    const foreZ = raised ? -0.55 : open ? side * 0.5 : guard ? side * 0.2 : side * 0.05;
    const foreX = guard ? -0.95 : 0;

    // horní paže v rukávu
    solid.push(
      piece(new THREE.CapsuleGeometry(px(0.055), 0.24, 4, 10), robeDark, {
        pos: [side * (px(0.25) + (open ? side * 0.03 : 0)), 1.2, 0],
        rot: [0, 0, armZ],
      }),
    );
    // předloktí
    solid.push(
      piece(new THREE.CapsuleGeometry(px(0.048), 0.24, 4, 10), skin, {
        pos: [
          side * (px(0.265) + (open ? side * 0.06 : 0)) + (raised ? 0.06 : 0),
          raised ? 1.62 : 0.94 + (guard ? 0.12 : 0),
          raised ? 0.02 : 0.01,
        ],
        rot: [foreX, 0, foreZ],
      }),
    );
    // ruka
    solid.push(
      piece(new THREE.SphereGeometry(px(0.058), 10, 8), skin, {
        pos: [
          side * (px(0.272) + (open ? side * 0.09 : 0)) + (raised ? 0.14 : 0),
          raised ? 1.9 : 0.78 + (guard ? 0.24 : 0),
          raised ? 0.04 : 0.02,
        ],
      }),
    );
    // náramek
    metal.push(
      piece(new THREE.TorusGeometry(px(0.052), px(0.012), 6, 12), trim, {
        pos: [side * (px(0.268) + (open ? side * 0.06 : 0)), raised ? 1.7 : 0.86 + (guard ? 0.12 : 0), 0.01],
        rot: [Math.PI / 2, 0, 0],
      }),
    );
  }

  // ── krk a hlava ─────────────────────────────────────────────────────
  solid.push(
    piece(new THREE.CylinderGeometry(px(0.05), px(0.055), 0.1, 10), skin, { pos: [0, NECK_Y - 0.03, 0] }),
  );
  solid.push(
    piece(new THREE.SphereGeometry(0.148, 22, 18), skin, {
      pos: [0, HEAD_Y, 0],
      scale: [0.96, 1.06, 0.94],
    }),
  );
  // brada / čelist
  solid.push(
    piece(new THREE.SphereGeometry(0.098, 16, 12), skin, {
      pos: [0, HEAD_Y - 0.088, 0.018],
      scale: [0.94, 0.74, 0.88],
    }),
  );
  // uši
  for (const side of [-1, 1]) {
    solid.push(
      piece(new THREE.SphereGeometry(0.032, 8, 6), skin, {
        pos: [side * 0.136, HEAD_Y - 0.005, 0],
        scale: [0.5, 1, 0.9],
      }),
    );
  }
  // oči
  for (const side of [-1, 1]) {
    const eye = look.eyeGlow ? glow : solid;
    eye.push(
      piece(new THREE.SphereGeometry(0.022, 10, 8), look.eyeGlow ? glowColor : '#221a1d', {
        pos: [side * 0.052, HEAD_Y + 0.018, 0.12],
        scale: [1, 0.82, 0.6],
      }),
    );
    // obočí — bez něj má tvář prázdný výraz
    solid.push(
      piece(new THREE.BoxGeometry(0.05, 0.009, 0.014), look.hair === 'bald' ? shade(skin, 0.7) : look.hairColor, {
        pos: [side * 0.053, HEAD_Y + 0.062, 0.121],
        rot: [0, 0, side * 0.12],
      }),
    );
  }
  // nos
  solid.push(
    piece(new THREE.ConeGeometry(0.019, 0.055, 6), shade(skin, 0.95), {
      pos: [0, HEAD_Y - 0.012, 0.133],
      rot: [1.35, 0, 0],
    }),
  );
  // ústa
  solid.push(
    piece(new THREE.BoxGeometry(0.055, 0.009, 0.012), shade(skin, 0.7), {
      pos: [0, HEAD_Y - 0.062, 0.122],
    }),
  );

  // ── vlasy / pokrývka hlavy ──────────────────────────────────────────
  switch (look.hair) {
    case 'short':
      solid.push(
        piece(new THREE.SphereGeometry(0.153, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.34), hair, {
          pos: [0, HEAD_Y + 0.004, -0.006],
          scale: [1, 1.06, 1],
        }),
      );
      // krátké boky nad ušima
      for (const side of [-1, 1]) {
        solid.push(
          piece(new THREE.SphereGeometry(0.055, 10, 8), hair, {
            pos: [side * 0.115, HEAD_Y + 0.03, -0.02],
            scale: [0.7, 1.1, 1],
          }),
        );
      }
      break;
    case 'bald':
      break;
    case 'topknot': {
      solid.push(
        piece(new THREE.SphereGeometry(0.152, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.3), hair, {
          pos: [0, HEAD_Y + 0.006, -0.004],
        }),
      );
      solid.push(
        piece(new THREE.CylinderGeometry(0.028, 0.038, 0.07, 8), hair, { pos: [0, HEAD_Y + 0.16, -0.01] }),
      );
      solid.push(
        piece(new THREE.SphereGeometry(0.05, 12, 10), hair, { pos: [0, HEAD_Y + 0.215, -0.012] }),
      );
      metal.push(
        piece(new THREE.TorusGeometry(0.035, 0.009, 6, 12), metalColor, {
          pos: [0, HEAD_Y + 0.15, -0.01],
          rot: [Math.PI / 2, 0, 0],
        }),
      );
      break;
    }
    case 'long': {
      solid.push(
        piece(new THREE.SphereGeometry(0.154, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.34), hair, {
          pos: [0, HEAD_Y + 0.004, -0.004],
        }),
      );
      for (const side of [-1, 1]) {
        solid.push(
          piece(new THREE.CapsuleGeometry(0.042, 0.34, 3, 8), hair, {
            pos: [side * 0.14, HEAD_Y - 0.17, -0.01],
            rot: [0, 0, side * 0.08],
          }),
        );
      }
      solid.push(
        piece(new THREE.CapsuleGeometry(0.06, 0.36, 3, 10), hair, {
          pos: [0, HEAD_Y - 0.2, -0.115],
        }),
      );
      break;
    }
    case 'braids': {
      solid.push(
        piece(new THREE.SphereGeometry(0.152, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.32), hair, {
          pos: [0, HEAD_Y + 0.004, -0.004],
        }),
      );
      for (const side of [-1, 1]) {
        for (let bead = 0; bead < 4; bead += 1) {
          solid.push(
            piece(new THREE.SphereGeometry(0.032, 8, 6), hair, {
              pos: [side * 0.145, HEAD_Y - 0.07 - bead * 0.075, -0.02],
            }),
          );
        }
      }
      break;
    }
    case 'hood': {
      // Kápě je otevřená dopředu — plný kužel by schoval celý obličej.
      // Pozor: `phiStart` u koule jde od −X přes +Z (předek), takže zadní
      // polovina je až kolem 1,5π. První pokus kreslil kápi přes obličej.
      solid.push(
        piece(new THREE.SphereGeometry(0.172, 18, 14, Math.PI * 1.05, Math.PI * 0.9, 0, Math.PI * 0.86), robeDark, {
          pos: [0, HEAD_Y + 0.005, -0.01],
          scale: [1, 1.06, 1.02],
        }),
      );
      solid.push(
        piece(new THREE.ConeGeometry(0.14, 0.26, 14, 1, true), robeDark, {
          pos: [0, HEAD_Y - 0.02, -0.14],
          rot: [-1.3, 0, 0],
        }),
      );
      break;
    }
    case 'veil': {
      // Závoj jde za hlavou (ne přes obličej). `thetaStart` u válce začíná
      // na +Z (předek), takže zadní oblouk je 0,36π…1,64π — první pokus
      // omylem zakryl obličej.
      solid.push(
        piece(new THREE.CylinderGeometry(0.155, 0.235, 0.46, 16, 1, true, Math.PI * 0.58, Math.PI * 0.84), trim, {
          pos: [0, HEAD_Y - 0.1, -0.01],
          scale: [1, 1, 0.96],
        }),
      );
      solid.push(
        piece(new THREE.TorusGeometry(0.152, 0.014, 6, 20), trim, {
          pos: [0, HEAD_Y + 0.075, 0],
          rot: [Math.PI / 2, 0, 0],
        }),
      );
      solid.push(
        piece(new THREE.SphereGeometry(0.155, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.36), hair, {
          pos: [0, HEAD_Y + 0.004, -0.004],
        }),
      );
      break;
    }
  }

  // ── plnovous ────────────────────────────────────────────────────────
  if (look.beard) {
    solid.push(
      piece(new THREE.ConeGeometry(0.1, 0.19, 12), hair, {
        pos: [0, HEAD_Y - 0.15, 0.06],
        rot: [Math.PI, 0, 0],
        scale: [1, 1, 0.72],
      }),
    );
    solid.push(
      piece(new THREE.BoxGeometry(0.09, 0.014, 0.012), hair, { pos: [0, HEAD_Y - 0.075, 0.122] }),
    );
  }

  // ── pokrývka hlavy (kultura / hodnost) ──────────────────────────────
  switch (look.headwear) {
    case 'none':
      break;
    case 'circlet':
      metal.push(
        piece(new THREE.TorusGeometry(0.152, 0.011, 6, 24), metalColor, {
          pos: [0, HEAD_Y + 0.07, 0],
          rot: [Math.PI / 2, 0, 0],
        }),
      );
      glow.push(
        piece(new THREE.OctahedronGeometry(0.022, 0), glowColor, { pos: [0, HEAD_Y + 0.07, 0.15] }),
      );
      break;
    case 'laurel':
      for (const side of [-1, 1]) {
        for (let leaf = 0; leaf < 4; leaf += 1) {
          solid.push(
            piece(new THREE.ConeGeometry(0.022, 0.075, 5), '#d8c86a', {
              pos: [side * (0.09 + leaf * 0.018), HEAD_Y + 0.1 - leaf * 0.012, 0.06 - leaf * 0.035],
              rot: [0.5, side * 0.7, side * 1.1],
            }),
          );
        }
      }
      break;
    case 'feathers':
      for (let feather = 0; feather < 3; feather += 1) {
        const angle = -0.5 + feather * 0.5;
        solid.push(
          piece(new THREE.ConeGeometry(0.022, 0.26, 5), feather % 2 === 0 ? trim : '#f2e3c8', {
            pos: [Math.sin(angle) * 0.09, HEAD_Y + 0.2, -0.05 - Math.cos(angle) * 0.05],
            rot: [0.42, angle * 0.4, angle * 0.5],
          }),
        );
      }
      metal.push(
        piece(new THREE.TorusGeometry(0.15, 0.012, 6, 20), metalColor, {
          pos: [0, HEAD_Y + 0.06, 0],
          rot: [Math.PI / 2, 0, 0],
        }),
      );
      break;
    case 'turban': {
      for (let wrap = 0; wrap < 3; wrap += 1) {
        solid.push(
          piece(new THREE.TorusGeometry(0.152 - wrap * 0.008, 0.042, 8, 22), wrap === 1 ? shade(trim, 0.9) : trim, {
            pos: [0, HEAD_Y + 0.11 - wrap * 0.045, -0.004],
            rot: [Math.PI / 2 + (wrap - 1) * 0.09, 0, 0],
          }),
        );
      }
      glow.push(
        piece(new THREE.OctahedronGeometry(0.026, 0), glowColor, { pos: [0, HEAD_Y + 0.12, 0.135] }),
      );
      break;
    }
    case 'mitre':
      solid.push(
        piece(new THREE.ConeGeometry(0.14, 0.3, 10), trim, { pos: [0, HEAD_Y + 0.24, -0.005] }),
      );
      metal.push(
        piece(new THREE.TorusGeometry(0.142, 0.012, 6, 20), metalColor, {
          pos: [0, HEAD_Y + 0.1, 0],
          rot: [Math.PI / 2, 0, 0],
        }),
      );
      break;
  }

  // ── koruna (vzácnost / CL) ──────────────────────────────────────────
  if (look.crown && look.headwear !== 'mitre' && look.headwear !== 'turban') {
    metal.push(
      piece(new THREE.TorusGeometry(0.125, 0.018, 6, 20), metalColor, {
        pos: [0, HEAD_Y + 0.1, 0],
        rot: [Math.PI / 2, 0, 0],
      }),
    );
    for (let spike = 0; spike < 5; spike += 1) {
      const angle = -Math.PI * 0.5 + (spike / 4) * Math.PI;
      metal.push(
        piece(new THREE.ConeGeometry(0.016, 0.08, 6), metalColor, {
          pos: [Math.sin(angle) * 0.12, HEAD_Y + 0.17, Math.cos(angle) * 0.12],
        }),
      );
      glow.push(
        piece(new THREE.SphereGeometry(0.014, 6, 6), glowColor, {
          pos: [Math.sin(angle) * 0.12, HEAD_Y + 0.215, Math.cos(angle) * 0.12],
        }),
      );
    }
  }

  // ── plášť přes ramena ───────────────────────────────────────────────
  if (look.cape) {
    solid.push(
      piece(new THREE.CylinderGeometry(px(0.2), px(0.28), 0.14, 16, 1, true), robeDark, {
        pos: [0, SHOULDER_Y - 0.05, -0.01],
      }),
    );
    // zadní díl pláště — část pláště, ne rovná deska
    solid.push(
      piece(
        new THREE.CylinderGeometry(px(0.24), px(0.33), 0.82, 18, 1, true, Math.PI * 0.68, Math.PI * 0.64),
        robeDark,
        { pos: [0, HIP_Y + 0.02, 0], scale: [1, 1, 0.92] },
      ),
    );
    metal.push(
      piece(new THREE.TorusGeometry(px(0.17), px(0.012), 6, 16), trim, {
        pos: [0, SHOULDER_Y + 0.02, 0.02],
        rot: [Math.PI / 2, 0, 0],
      }),
    );
  }

  // ── aura ────────────────────────────────────────────────────────────
  // Prstence leží u země (kolem nohou), ne v pase — v pase vypadají jako obruč.
  for (let ring = 0; ring < look.auraRings; ring += 1) {
    glow.push(
      piece(new THREE.TorusGeometry(px(0.46) + ring * 0.1, 0.009, 6, 36), glowColor, {
        pos: [0, 0.09 + ring * 0.14, 0],
        rot: [Math.PI / 2, 0, 0],
      }),
    );
  }
  // záře pod nohama
  glow.push(
    piece(new THREE.CircleGeometry(px(0.42), 24), shade(glowColor, 0.55), {
      pos: [0, 0.008, 0],
      rot: [-Math.PI / 2, 0, 0],
    }),
  );

  // ── ornamenty ───────────────────────────────────────────────────────
  const has = (ornament: string) => look.ornaments.includes(ornament as never);

  if (has('halo')) {
    glow.push(
      piece(new THREE.TorusGeometry(0.2, 0.014, 6, 26), glowColor, {
        pos: [0, HEAD_Y + 0.2, -0.1],
        rot: [Math.PI / 2.9, 0, 0],
      }),
    );
  }

  if (has('staff')) {
    solid.push(
      piece(new THREE.CylinderGeometry(0.02, 0.024, 1.86, 8), '#6b4a2f', {
        pos: [px(0.29), 1.0, 0.1],
      }),
    );
    glow.push(
      piece(new THREE.SphereGeometry(0.072, 12, 10), glowColor, { pos: [px(0.29), 1.96, 0.1] }),
    );
    metal.push(
      piece(new THREE.TorusGeometry(0.055, 0.012, 6, 12), metalColor, {
        pos: [px(0.29), 1.88, 0.1],
        rot: [Math.PI / 2, 0, 0],
      }),
    );
  }

  if (has('sword')) {
    metal.push(
      piece(new THREE.BoxGeometry(0.045, 1.1, 0.016), '#dfe6f0', {
        pos: [-px(0.33), 1.06, 0.05],
        rot: [0, 0, 0.16],
      }),
    );
    metal.push(
      piece(new THREE.BoxGeometry(0.19, 0.028, 0.05), metalColor, {
        pos: [-px(0.35), 1.6, 0.05],
        rot: [0, 0, 0.16],
      }),
    );
    solid.push(
      piece(new THREE.CylinderGeometry(0.026, 0.026, 0.16, 8), '#4a3222', {
        pos: [-px(0.37), 1.69, 0.05],
        rot: [0, 0, 0.16],
      }),
    );
  }

  if (has('book')) {
    metal.push(
      piece(new THREE.BoxGeometry(0.24, 0.3, 0.055), trim, {
        pos: [-px(0.28), 1.02, 0.16],
        rot: [0.24, -0.36, 0.08],
      }),
    );
    glow.push(
      piece(new THREE.BoxGeometry(0.2, 0.26, 0.006), glowColor, {
        pos: [-px(0.278), 1.02, 0.19],
        rot: [0.24, -0.36, 0.08],
      }),
    );
  }

  if (has('lotus')) {
    solid.push(
      piece(new THREE.CylinderGeometry(0.014, 0.02, 0.2, 6), '#4f7a44', {
        pos: [px(0.3), 1.36, 0.12],
        rot: [0.3, 0, 0.2],
      }),
    );
    for (let petal = 0; petal < 7; petal += 1) {
      const angle = (petal / 7) * Math.PI * 2;
      solid.push(
        piece(new THREE.ConeGeometry(0.042, 0.14, 5), '#ff9de2', {
          pos: [px(0.3) + Math.sin(angle) * 0.035, 1.48, 0.12 + Math.cos(angle) * 0.035],
          rot: [Math.cos(angle) * 0.5, angle, Math.sin(angle) * 0.5],
        }),
      );
    }
    glow.push(
      piece(new THREE.SphereGeometry(0.026, 8, 8), '#ffe08a', { pos: [px(0.3), 1.5, 0.12] }),
    );
  }

  if (has('conch')) {
    solid.push(
      piece(new THREE.ConeGeometry(0.062, 0.19, 12), '#f4efe4', {
        pos: [px(0.26), 1.28, 0.16],
        rot: [0.3, 0.4, 0.18],
      }),
    );
    metal.push(
      piece(new THREE.TorusGeometry(0.05, 0.01, 6, 12), metalColor, {
        pos: [px(0.26), 1.2, 0.16],
        rot: [1.2, 0.4, 0],
      }),
    );
  }

  if (has('veena')) {
    solid.push(
      piece(new THREE.BoxGeometry(0.085, 0.86, 0.055), '#8a5f2f', {
        pos: [-px(0.3), 1.2, 0.15],
        rot: [0, 0, 0.44],
      }),
    );
    solid.push(
      piece(new THREE.SphereGeometry(0.105, 12, 10), '#8a5f2f', {
        pos: [-px(0.47), 0.83, 0.15],
      }),
    );
    for (let string = 0; string < 3; string += 1) {
      metal.push(
        piece(new THREE.BoxGeometry(0.003, 0.78, 0.003), metalColor, {
          pos: [-px(0.3) + (string - 1) * 0.02, 1.2, 0.18],
          rot: [0, 0, 0.44],
        }),
      );
    }
  }

  if (has('bow')) {
    metal.push(
      piece(new THREE.TorusGeometry(0.32, 0.017, 6, 26, Math.PI * 0.95), '#c8a26a', {
        pos: [-px(0.32), 1.06, 0.02],
        rot: [0, 0, Math.PI / 2 - 0.4],
      }),
    );
    solid.push(
      piece(new THREE.BoxGeometry(0.004, 0.62, 0.004), '#e8e2d2', {
        pos: [-px(0.32) + 0.1, 1.06, 0.02],
      }),
    );
  }

  if (has('drum')) {
    metal.push(
      piece(new THREE.CylinderGeometry(0.075, 0.075, 0.12, 14), '#b06a3a', {
        pos: [px(0.235), 0.98, 0.14],
        rot: [0, 0, Math.PI / 2],
      }),
    );
    solid.push(
      piece(new THREE.CylinderGeometry(0.077, 0.077, 0.01, 14), '#f2e3c8', {
        pos: [px(0.235) + 0.062, 0.98, 0.14],
        rot: [0, 0, Math.PI / 2],
      }),
    );
    solid.push(
      piece(new THREE.BoxGeometry(0.014, 0.3, 0.014), '#6b4a2f', {
        pos: [px(0.19), 1.16, 0.1],
        rot: [0, 0, 0.5],
      }),
    );
  }

  if (has('orb')) {
    glow.push(
      piece(new THREE.SphereGeometry(0.082, 14, 12), glowColor, { pos: [px(0.33), 1.5, 0.12] }),
    );
    metal.push(
      piece(new THREE.TorusGeometry(0.1, 0.008, 6, 16), metalColor, {
        pos: [px(0.33), 1.5, 0.12],
        rot: [0.6, 0.3, 0],
      }),
    );
  }

  if (has('banner')) {
    solid.push(
      piece(new THREE.CylinderGeometry(0.016, 0.016, 1.72, 6), '#6b4a2f', { pos: [-px(0.36), 1.05, -0.02] }),
    );
    // prapor visí od násady dolů — dřív to byla deska plovoucí ve vzduchu
    solid.push(
      piece(new THREE.PlaneGeometry(0.22, 0.4), trim, {
        pos: [-px(0.36) + 0.11, 1.6, -0.02],
        rot: [0, 0, 0.02],
      }),
    );
    glow.push(
      piece(new THREE.CircleGeometry(0.045, 14), glowColor, {
        pos: [-px(0.36) + 0.11, 1.62, -0.018],
      }),
    );
  }

  if (has('spear')) {
    solid.push(
      piece(new THREE.CylinderGeometry(0.016, 0.016, 1.9, 6), '#7a5a3a', { pos: [px(0.29), 1.05, 0.1] }),
    );
    metal.push(
      piece(new THREE.ConeGeometry(0.05, 0.19, 6), '#cfd6e4', { pos: [px(0.29), 2.06, 0.1] }),
    );
  }

  // ── atributy z kánonu ───────────────────────────────────────────────
  if (has('flute')) {
    // flétna držená šikmo u hrudi — Krišna
    solid.push(
      piece(new THREE.CylinderGeometry(0.016, 0.016, 0.34, 8), '#c8a26a', {
        pos: [px(0.2), 1.2, 0.2],
        rot: [0.2, 0, 1.15],
      }),
    );
    for (let hole = 0; hole < 4; hole += 1) {
      metal.push(
        piece(new THREE.TorusGeometry(0.017, 0.004, 5, 8), '#8a6a3a', {
          pos: [px(0.2) + (hole - 1.5) * 0.06, 1.2 + (hole - 1.5) * 0.03, 0.2],
          rot: [1.45, 0, 1.15],
        }),
      );
    }
  }

  if (has('trident')) {
    solid.push(
      piece(new THREE.CylinderGeometry(0.02, 0.022, 2.0, 8), '#6b4a2f', { pos: [px(0.29), 1.1, 0.1] }),
    );
    metal.push(
      piece(new THREE.BoxGeometry(0.06, 0.05, 0.05), metalColor, { pos: [px(0.29), 2.02, 0.1] }),
    );
    for (const offset of [-0.075, 0, 0.075]) {
      metal.push(
        piece(new THREE.CylinderGeometry(0.011, 0.006, 0.26, 6), '#cfd6e4', {
          pos: [px(0.29) + offset, 2.16, 0.1],
          rot: [0, 0, offset === 0 ? 0 : offset > 0 ? -0.16 : 0.16],
        }),
      );
    }
    glow.push(
      piece(new THREE.SphereGeometry(0.02, 6, 6), glowColor, { pos: [px(0.29), 2.3, 0.1] }),
    );
  }

  if (has('chakra')) {
    // Sudaršana čakra — disk s paprsky, vznáší se u ruky
    metal.push(
      piece(new THREE.TorusGeometry(0.13, 0.014, 6, 26), metalColor, {
        pos: [px(0.34), 1.34, 0.02],
        rot: [0.35, 0, 0],
      }),
    );
    for (let spoke = 0; spoke < 8; spoke += 1) {
      const angle = (spoke / 8) * Math.PI * 2;
      metal.push(
        piece(new THREE.BoxGeometry(0.008, 0.12, 0.008), metalColor, {
          pos: [px(0.34) + Math.cos(angle) * 0.065, 1.34 + Math.sin(angle) * 0.065, 0.02],
          rot: [0.35, 0, angle],
        }),
      );
    }
    glow.push(
      piece(new THREE.CircleGeometry(0.05, 16), glowColor, {
        pos: [px(0.34), 1.34, 0.035],
        rot: [0.35, 0, 0],
      }),
    );
  }

  if (has('vajra')) {
    // dorje — dvojitý hrot
    metal.push(
      piece(new THREE.SphereGeometry(0.035, 10, 8), metalColor, { pos: [px(0.32), 1.16, 0.1] }),
    );
    for (const dir of [-1, 1]) {
      metal.push(
        piece(new THREE.ConeGeometry(0.026, 0.16, 6), metalColor, {
          pos: [px(0.32), 1.16 + dir * 0.1, 0.1],
          rot: [0, 0, dir === 1 ? 0 : Math.PI],
        }),
      );
    }
    glow.push(
      piece(new THREE.OctahedronGeometry(0.018, 0), glowColor, { pos: [px(0.32), 1.16, 0.1] }),
    );
  }

  if (has('cross')) {
    metal.push(
      piece(new THREE.BoxGeometry(0.035, 0.42, 0.02), '#d9c27a', {
        pos: [px(0.3), 1.16, 0.16],
        rot: [0, 0, 0.1],
      }),
    );
    metal.push(
      piece(new THREE.BoxGeometry(0.2, 0.032, 0.02), '#d9c27a', {
        pos: [px(0.3), 1.28, 0.16],
        rot: [0, 0, 0.1],
      }),
    );
  }

  if (has('crescent')) {
    metal.push(
      piece(new THREE.TorusGeometry(0.1, 0.016, 6, 20, Math.PI * 1.15), metalColor, {
        pos: [px(0.32), 1.9, 0.02],
        rot: [0.2, 0, 2.4],
      }),
    );
  }

  if (has('ankh')) {
    metal.push(
      piece(new THREE.TorusGeometry(0.045, 0.012, 6, 16), metalColor, { pos: [px(0.31), 1.42, 0.12] }),
    );
    metal.push(
      piece(new THREE.BoxGeometry(0.028, 0.34, 0.022), metalColor, { pos: [px(0.31), 1.2, 0.12] }),
    );
    metal.push(
      piece(new THREE.BoxGeometry(0.17, 0.028, 0.022), metalColor, { pos: [px(0.31), 1.3, 0.12] }),
    );
  }

  if (has('bell')) {
    metal.push(
      piece(new THREE.ConeGeometry(0.06, 0.11, 12, 1, true), metalColor, {
        pos: [px(0.3), 1.28, 0.14],
      }),
    );
    metal.push(
      piece(new THREE.SphereGeometry(0.018, 8, 6), metalColor, { pos: [px(0.3), 1.35, 0.14] }),
    );
    solid.push(
      piece(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 6), '#6b4a2f', { pos: [px(0.3), 1.4, 0.14] }),
    );
  }

  if (has('lantern')) {
    metal.push(
      piece(new THREE.BoxGeometry(0.1, 0.14, 0.1), metalColor, { pos: [px(0.3), 1.06, 0.16] }),
    );
    glow.push(
      piece(new THREE.SphereGeometry(0.045, 10, 8), glowColor, { pos: [px(0.3), 1.06, 0.16] }),
    );
    metal.push(
      piece(new THREE.TorusGeometry(0.045, 0.007, 5, 12), metalColor, {
        pos: [px(0.3), 1.16, 0.16],
        rot: [Math.PI / 2, 0, 0],
      }),
    );
  }

  if (has('feather')) {
    // paví pero — Krišna ho nosí ve vlasech
    const stemX = 0.12;
    solid.push(
      piece(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 5), '#d8d2c6', {
        pos: [stemX, HEAD_Y + 0.2, -0.02],
        rot: [0.2, 0, -0.35],
      }),
    );
    glow.push(
      piece(new THREE.CircleGeometry(0.055, 16), glowColor, {
        pos: [stemX + 0.05, HEAD_Y + 0.3, -0.02],
        rot: [0, -0.3, 0],
      }),
    );
    solid.push(
      piece(new THREE.SphereGeometry(0.014, 8, 6), '#2f6b8a', { pos: [stemX + 0.05, HEAD_Y + 0.29, -0.015] }),
    );
  }

  if (has('mirror')) {
    metal.push(
      piece(new THREE.CircleGeometry(0.09, 20), '#e6eef7', { pos: [px(0.3), 1.34, 0.15] }),
    );
    metal.push(
      piece(new THREE.TorusGeometry(0.09, 0.012, 6, 20), metalColor, { pos: [px(0.3), 1.34, 0.15] }),
    );
    metal.push(
      piece(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6), metalColor, { pos: [px(0.3), 1.24, 0.15] }),
    );
  }

  if (has('hammer')) {
    solid.push(
      piece(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 6), '#6b4a2f', { pos: [px(0.32), 1.2, 0.05] }),
    );
    metal.push(
      piece(new THREE.BoxGeometry(0.16, 0.1, 0.1), metalColor, { pos: [px(0.32), 1.45, 0.05] }),
    );
  }

  if (has('axe')) {
    solid.push(
      piece(new THREE.CylinderGeometry(0.018, 0.018, 0.56, 6), '#6b4a2f', { pos: [px(0.32), 1.22, 0.04] }),
    );
    metal.push(
      piece(new THREE.ConeGeometry(0.1, 0.18, 4), '#cfd6e4', {
        pos: [px(0.32) + 0.08, 1.44, 0.04],
        rot: [0, 0, -Math.PI / 2],
      }),
    );
  }

  if (has('cobra')) {
    // kobra sepnutá kolem ramene (Šiva) — jen náznak, had není model
    for (let segment = 0; segment < 4; segment += 1) {
      solid.push(
        piece(new THREE.SphereGeometry(0.028, 8, 6), '#3f6b4a', {
          pos: [px(0.18) + segment * 0.02, 1.42 - segment * 0.05, 0.12 - segment * 0.02],
        }),
      );
    }
    solid.push(
      piece(new THREE.SphereGeometry(0.04, 10, 8), '#4b7d56', {
        pos: [px(0.15), 1.25, 0.2],
        scale: [1, 1.3, 0.8],
      }),
    );
    glow.push(
      piece(new THREE.SphereGeometry(0.012, 6, 6), '#ffd166', { pos: [px(0.15) + 0.018, 1.28, 0.24] }),
    );
  }

  return {
    solid: merge(solid)!,
    metal: merge(metal),
    glow: merge(glow),
  };
}
