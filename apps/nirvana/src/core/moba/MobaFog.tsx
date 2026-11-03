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
import { MAP_HALF_X, MAP_HALF_Z, VISION } from './map';
import type { MobaSnapshot } from './sim';

const WIDTH = 256;
const HEIGHT = 192;
/** Jak často se maska překresluje (s). */
const REFRESH = 0.15;

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
    // tma nad neviděným územím
    context.fillStyle = 'rgba(2, 9, 7, 0.66)';
    context.fillRect(0, 0, WIDTH, HEIGHT);

    const me = snapshot?.heroes.find((hero) => hero.id === youId);
    const team = me?.team;
    if (!snapshot || !team) {
      texture.needsUpdate = true;
      return;
    }

    const sx = (x: number) => ((x + MAP_HALF_X) / (MAP_HALF_X * 2)) * WIDTH;
    // Plane je otočený o −90° kolem X, takže osa Z jde v textuře opačně.
    const sy = (z: number) => ((MAP_HALF_Z - z) / (MAP_HALF_Z * 2)) * HEIGHT;
    const radius = (meters: number) => (meters / (MAP_HALF_X * 2)) * WIDTH;

    const reveal = (x: number, z: number, meters: number) => {
      const px = sx(x);
      const py = sy(z);
      const pr = Math.max(2, radius(meters));
      const gradient = context.createRadialGradient(px, py, pr * 0.45, px, py, pr);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      context.globalCompositeOperation = 'destination-out';
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(px, py, pr, 0, Math.PI * 2);
      context.fill();
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
      <planeGeometry args={[MAP_HALF_X * 2, MAP_HALF_Z * 2]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
