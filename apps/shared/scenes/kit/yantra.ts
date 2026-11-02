/** @jsxRuntime classic */
'use client';

/**
 * Śrí jantra jako zlatá linka — jeden zdroj pro scénu i pro orb ve vesmíru.
 *
 * Devět protínajících se trojúhelníků (4 nahoru, 5 dolů), tři kružnice a bindu
 * v jedné rovině XY. Konstrukce je **matematicky přesná**: všechny troj-
 * průsečíky splňují podmínky konkurrence (i)–(iii) z Chiodo, „On the
 * construction of the Śrī Yantra" (C. R. Math. 359, 2021), bazální přímky
 * t3/t6/t7 dle Hueta, devátá (t9) řešená pro rovnostranný centrální trojúhelník
 * (Newton 13×13, residuum ~1e-15, rovnostrannost ~4e-16).
 *
 * Souřadnice níže jsou na jednotkové kružnici: [apex_y, base_y, halfWidth].
 */

import { THREE } from '@genesis/runtime';

export interface SriYantraOptions {
  /** Vnější poloměr v jednotkách scény. */
  radius?: number;
  /** Segmentů na kružnici (96 stačí i na blízko). */
  circleSegments?: number;
}

/** Devět maximálních trojúhelníků — přesné hodnoty na průměru r=1. */
const YANTRA: ReadonlyArray<readonly [number, number, number]> = [
  [-0.074, 0.72996863, 0.4641715], // t1 ↓
  [-0.63144373, 0.55404752, 0.6615825], // t2 ↓
  [-1, 0.336, 0.94186199], // t3 ↓ (vepsaný)
  [-0.4853454, 0.21601242, 0.3088074], // t4 ↓
  [-0.204, 0.10372162, 0.2230597], // t5 ↓
  [0.55404752, -0.074, 0.31109046], // t6 ↑
  [1, -0.204, 0.97897089], // t7 ↑ (vepsaný)
  [0.72996863, -0.4853454, 0.73021391], // t8 ↑
  [0.336, -0.63144373, 0.42736264], // t9 ↑
];

export function sriYantraGeometry({ radius = 1, circleSegments = 96 }: SriYantraOptions = {}): THREE.BufferGeometry {
  const points: number[] = [];
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    points.push(x1, y1, 0, x2, y2, 0);
  };
  const circle = (r: number, segments = circleSegments) => {
    for (let i = 0; i < segments; i++) {
      const a1 = (i / segments) * Math.PI * 2;
      const a2 = ((i + 1) / segments) * Math.PI * 2;
      line(Math.cos(a1) * r, Math.sin(a1) * r, Math.cos(a2) * r, Math.sin(a2) * r);
    }
  };

  circle(1.0);
  circle(0.82);
  circle(0.32);

  for (const [apex, base, halfWidth] of YANTRA) {
    line(-halfWidth, base, halfWidth, base);
    line(halfWidth, base, 0, apex);
    line(0, apex, -halfWidth, base);
  }

  // bindu — střed
  circle(0.05, 20);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return geometry.scale(radius, radius, radius);
}
