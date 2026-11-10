'use client';

/**
 * MERKUR — plovoucí čísla, jiskry a hlášky.
 *
 * Sim neposílá damage eventy do sítě, takže v online duelu vznikají čísla
 * **rozdílem HP mezi snapshoty** (stejný trik jako v MOBě). V sólu je zdroj
 * přesný (`hit` event). Kreslí se do 2D canvasu nad scénou; DOM element pro
 * každé číslo by při 15 snímcích/s zabil výkon.
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type DuelFxKind = 'out' | 'in' | 'ko' | 'guard' | 'combo' | 'hill';

export interface DuelFloater {
  id: number;
  /** Světové souřadnice (z = 0, scéna je 2D). */
  x: number;
  y: number;
  amount: number;
  kind: DuelFxKind;
  born: number;
  /** Vodorovný rozptyl, aby se čísla nepřekrývala. */
  drift: number;
  text?: string;
}

/** Čísla poškození žijí krátce, hlášky déle. */
export const DUEL_FX_TTL = 950;
export const DUEL_TEXT_TTL = 1500;
const MAX_FX = 36;

let nextId = 1;

export function pushHitFx(
  list: DuelFloater[],
  x: number,
  y: number,
  amount: number,
  kind: 'out' | 'in',
  now: number,
): void {
  if (amount < 1) return;
  list.push({
    id: nextId++,
    x,
    y,
    amount: Math.round(amount),
    kind,
    born: now,
    // deterministický rozptyl podle id (žádný Math.random ve smyčce)
    drift: ((nextId % 7) - 3) * 10,
  });
  if (list.length > MAX_FX) list.splice(0, list.length - MAX_FX);
}

export function pushTextFx(
  list: DuelFloater[],
  x: number,
  y: number,
  text: string,
  kind: DuelFxKind,
  now: number,
): void {
  list.push({ id: nextId++, x, y, amount: 0, kind, born: now, drift: 0, text });
  if (list.length > MAX_FX) list.splice(0, list.length - MAX_FX);
}

export function clearFx(list: DuelFloater[]): void {
  list.length = 0;
}

function ttlOf(kind: DuelFxKind): number {
  return kind === 'out' || kind === 'in' ? DUEL_FX_TTL : DUEL_TEXT_TTL;
}

function colorOf(kind: DuelFxKind): string {
  switch (kind) {
    case 'in':
      return '#ff8b7b';
    case 'ko':
      return '#ffd166';
    case 'guard':
      return '#7fd1e3';
    case 'combo':
      return '#ffb46a';
    case 'hill':
      return '#c8f56a';
    default:
      return '#ffe9a8';
  }
}

export function DuelFxOverlay({
  floaters,
  cameraRef,
}: {
  floaters: React.MutableRefObject<DuelFloater[]>;
  cameraRef: React.MutableRefObject<THREE.Camera | null>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const vector = useRef(new THREE.Vector3());

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const element = canvas.current;
      const camera = cameraRef.current;
      if (!element) return;

      const width = element.clientWidth;
      const height = element.clientHeight;
      if (element.width !== width || element.height !== height) {
        element.width = width;
        element.height = height;
      }
      const context = element.getContext('2d');
      if (!context) return;
      context.clearRect(0, 0, width, height);
      if (!camera) return;

      const now = performance.now();
      const list = floaters.current;
      for (let index = list.length - 1; index >= 0; index -= 1) {
        const floater = list[index]!;
        const ttl = ttlOf(floater.kind);
        const age = now - floater.born;
        if (age > ttl) {
          list.splice(index, 1);
          continue;
        }
        const progress = age / ttl;
        vector.current.set(floater.x, floater.y + progress * 1.5, 0);
        vector.current.project(camera);
        if (vector.current.z > 1) continue;
        const sx = (vector.current.x * 0.5 + 0.5) * width + floater.drift;
        const sy = (-vector.current.y * 0.5 + 0.5) * height;
        const alpha = 1 - progress * progress;
        const color = colorOf(floater.kind);

        if (floater.kind === 'out' || floater.kind === 'in') {
          // jiskra: rozpínající se prstenec pod číslem
          context.globalAlpha = alpha * 0.6;
          context.strokeStyle = color;
          context.lineWidth = 2.5;
          context.beginPath();
          context.arc(sx, sy + 6, 6 + progress * 26, 0, Math.PI * 2);
          context.stroke();

          const size = 17 + (1 - progress) * 8;
          context.globalAlpha = alpha;
          context.font = `800 ${size}px system-ui, sans-serif`;
          context.textAlign = 'center';
          context.lineWidth = 3;
          context.strokeStyle = 'rgba(0,0,0,0.75)';
          context.strokeText(String(floater.amount), sx, sy);
          context.fillStyle = color;
          context.fillText(String(floater.amount), sx, sy);
        } else {
          const scale = floater.kind === 'ko' ? 1.25 : floater.kind === 'combo' ? 1.1 : 1;
          const size = (floater.kind === 'ko' ? 34 : floater.kind === 'combo' ? 22 : 18) * scale;
          context.globalAlpha = alpha;
          context.font = `900 ${size}px system-ui, sans-serif`;
          context.textAlign = 'center';
          context.lineWidth = 4;
          context.strokeStyle = 'rgba(0,0,0,0.8)';
          const label = floater.text ?? '';
          context.strokeText(label, sx, sy);
          context.fillStyle = color;
          context.fillText(label, sx, sy);
        }
      }
      context.globalAlpha = 1;
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [cameraRef, floaters]);

  return <canvas ref={canvas} className="duel-fx" aria-hidden="true" />;
}
