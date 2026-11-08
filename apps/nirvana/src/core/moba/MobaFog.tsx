'use client';

/**
 * VIZUÁLNÍ MLHA VÁLKY.
 *
 * Server už **neposílá** jednotky, které tým nevidí (F1). Chyběla ale druhá
 * půlka: hráč neviděl „černo", takže mapa působila, jako by nic neskrývala.
 *
 * Implementace je záměrně levná: tmavý plán nad zemí s **průhledovými dírami**
 * v místech, kam tým vidí. Maska je CanvasTexture 256×192, překreslovaná
 * 6–7× za sekundu (ne každý frame) — na čitelnost to stačí a nezatíží GPU.
 *
 * Zdroj vidění se bere **ze snapshotu** (vlastní hrdinové, minioni, věže,
 * uzly, wardy), ne z interního stavu sim — online klient stav nemá.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VISION } from './map';
import type { MobaSnapshot } from './sim';

const WIDTH = 256;
const HEIGHT = 192;
/** Jak často se maska překresluje (s). */
const REFRESH = 0.15;
/**
 * Mlha pokrývá i okolí hřiště (lesy a obzor) — kdyby končila na hraně mapy,
 * vypadala by jako tmavý obdélník doprostřed obrazovky (přesně to ukázal
 * screenshot). Světové rozměry plánu, ne mapy.
 */
const FOG_HALF_X = 120;
const FOG_HALF_Z = 100;

export function MobaFog({
  snapshotRef,
  youId,
}: {
  snapshotRef: React.MutableRefObject<MobaSnapshot | null>;
  youId: string;
}) {
  const canvas = useMemo(() => {
    const element = document.createElement('canvas');
    element.width = WIDTH;
    element.height = HEIGHT;
    return element;
  }, []);

  const texture = useMemo(() => {
    const map = new THREE.CanvasTexture(canvas);
    map.minFilter = THREE.LinearFilter;
    map.magFilter = THREE.LinearFilter;
    map.generateMipmaps = false;
    return map;
  }, [canvas]);

  const lastDraw = useRef(-1);

  useFrame((frame) => {
    if (frame.clock.elapsedTime - lastDraw.current < REFRESH) return;
    lastDraw.current = frame.clock.elapsedTime;

    const context = canvas.getContext('2d');
    if (!context) return;
    const snapshot = snapshotRef.current;

    context.globalCompositeOperation = 'source-over';
    context.clearRect(0, 0, WIDTH, HEIGHT);

    const me = snapshot?.heroes.find((hero) => hero.id === youId);
    const team = me?.team;
    // Divák není v týmu. Server mu jednotky posílá; tmavý plán by je schoval.
    if (!snapshot || !team) {
      texture.needsUpdate = true;
      return;
    }

    context.fillStyle = 'rgba(2, 9, 7, 0.66)';
    context.fillRect(0, 0, WIDTH, HEIGHT);

    const sx = (x: number) => ((x + FOG_HALF_X) / (FOG_HALF_X * 2)) * WIDTH;
    // Plane je otočený o −90° kolem X, takže osa Z jde v textuře opačně.
    const sy = (z: number) => ((FOG_HALF_Z - z) / (FOG_HALF_Z * 2)) * HEIGHT;
    const rx = (meters: number) => (meters / (FOG_HALF_X * 2)) * WIDTH;
    const ry = (meters: number) => (meters / (FOG_HALF_Z * 2)) * HEIGHT;

    const reveal = (x: number, z: number, meters: number) => {
      const px = sx(x);
      const py = sy(z);
      const ax = Math.max(2, rx(meters));
      const ay = Math.max(2, ry(meters));
      // Elipsa, protože plán není čtvercový — kruh by se v textuře rozjel.
      const gradient = context.createRadialGradient(px, py, Math.min(ax, ay) * 0.45, px, py, Math.max(ax, ay));
      gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      context.globalCompositeOperation = 'destination-out';
      context.fillStyle = gradient;
      context.save();
      context.translate(px, py);
      context.scale(ax / ay, 1);
      context.beginPath();
      context.arc(0, 0, ay, 0, Math.PI * 2);
      context.fill();
      context.restore();
      context.globalCompositeOperation = 'source-over';
    };

    for (const hero of snapshot.heroes) {
      if (hero.team === team && hero.alive) reveal(hero.x, hero.z, VISION.hero);
    }
    for (const minion of snapshot.minions) {
      if (minion.team === team) reveal(minion.x, minion.z, VISION.minion);
    }
    for (const tower of snapshot.towers) {
      if (tower.team === team && tower.hp > 0) reveal(tower.x, tower.z, VISION.tower);
    }
    for (const node of snapshot.nodes) {
      if (node.owner === team) reveal(node.x, node.z, VISION.node);
    }
    for (const ward of snapshot.wards ?? []) {
      reveal(ward.x, ward.z, 10);
    }

    texture.needsUpdate = true;
  });

  return (
    <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <planeGeometry args={[FOG_HALF_X * 2, FOG_HALF_Z * 2]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
