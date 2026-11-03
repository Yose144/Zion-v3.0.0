'use client';

/**
 * PLOVOUCÍ ČÍSLA POŠKOZENÍ.
 *
 * Sim posílá jen snapshoty (bez damage eventů), takže čísla vznikají
 * **rozdílem HP mezi dvěma snímky** — funguje to v sólu i online a nepotřebuje
 * změnu protokolu.
 *
 * Vykresluje se do 2D canvasu nad scénou: DOM element pro každé číslo by při
 * 15 snímcích za sekundu zabil výkon. Světové souřadnice se projektují
 * kamerou z r3f, kterou `MobaStage` předává přes `cameraRef`.
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export interface DamageFloater {
  id: number;
  x: number;
  y: number;
  z: number;
  amount: number;
  /** `out` = poškození nepříteli (světlé), `in` = dostané (červené). */
  kind: 'out' | 'in';
  born: number;
}

export const DAMAGE_TTL = 900;

let nextId = 1;
export function pushDamage(
  list: DamageFloater[],
  x: number,
  y: number,
  z: number,
  amount: number,
  kind: 'out' | 'in',
  now: number,
) {
  if (amount < 1) return;
  list.push({ id: nextId++, x, y, z, amount: Math.round(amount), kind, born: now });
  // strop, aby se při AoE nedělaly stovky čísel
  if (list.length > 40) list.splice(0, list.length - 40);
}

export function MobaFxOverlay({
  floaters,
  cameraRef,
}: {
  floaters: React.MutableRefObject<DamageFloater[]>;
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

      // plátno přes celou scénu
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
        const age = now - floater.born;
        if (age > DAMAGE_TTL) {
          list.splice(index, 1);
          continue;
        }
        const progress = age / DAMAGE_TTL;
        vector.current.set(floater.x, floater.y + progress * 1.6, floater.z);
        vector.current.project(camera);
        if (vector.current.z > 1) continue;
        const sx = (vector.current.x * 0.5 + 0.5) * width;
        const sy = (-vector.current.y * 0.5 + 0.5) * height;
        const alpha = 1 - progress * progress;
        const size = 15 + (1 - progress) * 5;
        context.globalAlpha = alpha;
        context.font = `800 ${size}px system-ui, sans-serif`;
        context.textAlign = 'center';
        context.lineWidth = 3;
        context.strokeStyle = 'rgba(0,0,0,0.75)';
        context.strokeText(String(floater.amount), sx, sy);
        context.fillStyle = floater.kind === 'in' ? '#ff8b7b' : '#ffe9a8';
        context.fillText(String(floater.amount), sx, sy);
      }
      context.globalAlpha = 1;
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [cameraRef, floaters]);

  return <canvas ref={canvas} className="moba-fx" aria-hidden="true" />;
}
