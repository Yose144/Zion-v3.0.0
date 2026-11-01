/** @jsxRuntime classic */
'use client';

/**
 * Śrí jantra jako zlatá linka — jeden zdroj pro scénu i pro orb ve vesmíru.
 *
 * Devět protínajících se trojúhelníků (4 nahoru, 5 dolů), tři kružnice a bindu
 * v jedné rovině XY. Tohle je **stylizace s čitelnou siluetou**; přesná
 * konstrukce (43 malých trojúhelníků, přesné průsečíky) je samostatný úkol
 * s art review — masterplan ji vyžaduje, tenhle modul ji nefalšuje.
 */

import { THREE } from '@genesis/runtime';

export interface SriYantraOptions {
  /** Vnější poloměr v jednotkách scény. */
  radius?: number;
  /** Segmentů na kružnici (96 stačí i na blízko). */
  circleSegments?: number;
}

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
  const triangle = (base: number, halfWidth: number, apex: number) => {
    line(-halfWidth, base, halfWidth, base);
    line(halfWidth, base, 0, apex);
    line(0, apex, -halfWidth, base);
  };

  circle(1.0);
  circle(0.82);
  circle(0.32);

  // Čtyři trojúhelníky špičkou nahoru: [základna, půlšířka, hrot].
  const upward: Array<[number, number, number]> = [
    [-0.95, 0.92, 0.18],
    [-0.62, 0.7, 0.44],
    [-0.32, 0.46, 0.68],
    [-0.08, 0.22, 0.9],
  ];
  // Pět trojúhelníků špičkou dolů.
  const downward: Array<[number, number, number]> = [
    [0.95, 0.92, -0.18],
    [0.62, 0.7, -0.44],
    [0.32, 0.46, -0.68],
    [0.08, 0.22, -0.9],
    [0.5, 0.55, -0.5],
  ];
  for (const [base, halfWidth, apex] of upward) triangle(base, halfWidth, apex);
  for (const [base, halfWidth, apex] of downward) triangle(base, halfWidth, apex);

  // bindu — střed
  circle(0.05, 20);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return geometry.scale(radius, radius, radius);
}
