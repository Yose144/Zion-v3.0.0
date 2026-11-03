'use client';

/**
 * MINIMAPA „Prvního světa".
 *
 * Kreslí se z **jednoho snapshotu** (žádný vlastní stav): linky, věže, Nexy,
 * uzly L5, minioni a hrdinové. Aktualizuje se 5×/s spolu s HUD — na mapu to
 * stačí a nezatěžuje to herní smyčku.
 */

import { useEffect, useRef } from 'react';
import type { MobaSnapshot } from './sim';
import { BUSHES, LANES, MAP_HALF_X, MAP_HALF_Z, NODE_SITES, RIVER, isStructureProtected } from './map';

const WIDTH = 216;
const HEIGHT = 156;

const COLORS = {
  blue: '#7fe3d4',
  red: '#ff7a6b',
  neutral: '#94a3b8',
  /** Nedobytná struktura — šedá, ať je vidět, že do ní nemá cenu mlátit. */
  shielded: '#64748b',
  ground: '#0a1712',
  lane: '#1f5a45',
  edge: 'rgba(127,227,212,0.18)',
};

export function MobaMinimap({
  snapshot,
  youId,
  label,
}: {
  snapshot: MobaSnapshot | null;
  youId: string | null;
  label: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const context = element.getContext('2d');
    if (!context) return;

    const sx = (x: number) => ((x + MAP_HALF_X) / (MAP_HALF_X * 2)) * WIDTH;
    const sz = (z: number) => ((z + MAP_HALF_Z) / (MAP_HALF_Z * 2)) * HEIGHT;

    context.clearRect(0, 0, WIDTH, HEIGHT);
    context.fillStyle = COLORS.ground;
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.strokeStyle = COLORS.edge;
    context.lineWidth = 1;
    context.strokeRect(0.5, 0.5, WIDTH - 1, HEIGHT - 1);

    // linky
    context.strokeStyle = COLORS.lane;
    context.lineWidth = 4;
    for (const lane of LANES) {
      context.beginPath();
      context.moveTo(sx(-32), sz(lane.z));
      context.lineTo(sx(32), sz(lane.z));
      context.stroke();
    }

    // řeka
    context.fillStyle = 'rgba(47, 111, 143, 0.55)';
    context.fillRect(sx(RIVER.x - RIVER.halfWidth), 0, (sx(RIVER.x + RIVER.halfWidth) - sx(RIVER.x - RIVER.halfWidth)), HEIGHT);

    // bushe — v nich soupeře nevidíš, takže je musíš vidět na mapě
    context.fillStyle = 'rgba(31, 107, 69, 0.85)';
    for (const bush of BUSHES) {
      context.beginPath();
      context.arc(sx(bush.x), sz(bush.z), Math.max(2, (bush.r / (MAP_HALF_X * 2)) * WIDTH), 0, Math.PI * 2);
      context.fill();
    }

    if (!snapshot) return;

    // uzly L5
    for (const site of NODE_SITES) {
      const owner = snapshot.nodes.find((node) => node.key === site.key)?.owner ?? null;
      context.fillStyle = owner === 'blue' ? COLORS.blue : owner === 'red' ? COLORS.red : COLORS.neutral;
      context.globalAlpha = owner ? 0.95 : 0.5;
      const cx = sx(site.x);
      const cz = sz(site.z);
      context.beginPath();
      context.moveTo(cx, cz - 5);
      context.lineTo(cx + 5, cz);
      context.lineTo(cx, cz + 5);
      context.lineTo(cx - 5, cz);
      context.closePath();
      context.fill();
      context.globalAlpha = 1;
    }

    // věže a Nexy
    for (const tower of snapshot.towers) {
      if (tower.hp <= 0 && tower.kind !== 'nexus') continue;
      // Nedobytná struktura (krytá vnější věží / Nexa krytá lajnou) je šedá —
      // hráč musí vidět, do čeho nemá cenu mlátit.
      const shielded = isStructureProtected(snapshot.towers, tower.id);
      context.fillStyle = shielded ? COLORS.shielded : tower.team === 'blue' ? COLORS.blue : COLORS.red;
      context.globalAlpha = tower.hp > 0 ? 1 : 0.25;
      const cx = sx(tower.x);
      const cz = sz(tower.z);
      if (tower.kind === 'nexus') {
        context.beginPath();
        context.arc(cx, cz, 7, 0, Math.PI * 2);
        context.fill();
      } else if (tower.kind === 'inhibitor') {
        // inhibitor je kosočtverec — pozná se na první pohled od věže
        context.beginPath();
        context.moveTo(cx, cz - 4.5);
        context.lineTo(cx + 4.5, cz);
        context.lineTo(cx, cz + 4.5);
        context.lineTo(cx - 4.5, cz);
        context.closePath();
        context.fill();
      } else {
        context.fillRect(cx - 2.5, cz - 2.5, 5, 5);
      }
      context.globalAlpha = 1;
    }

    // minioni
    for (const minion of snapshot.minions) {
      context.fillStyle = minion.team === 'blue' ? COLORS.blue : COLORS.red;
      context.globalAlpha = minion.super ? 0.95 : 0.55;
      const size = minion.super ? 3.5 : 2;
      context.fillRect(sx(minion.x) - size / 2, sz(minion.z) - size / 2, size, size);
    }
    context.globalAlpha = 1;

    // hrdinové
    for (const hero of snapshot.heroes) {
      if (!hero.alive) continue;
      const cx = sx(hero.x);
      const cz = sz(hero.z);
      context.beginPath();
      context.fillStyle = hero.team === 'blue' ? COLORS.blue : COLORS.red;
      context.arc(cx, cz, hero.id === youId ? 4.5 : 3.5, 0, Math.PI * 2);
      context.fill();
      if (hero.id === youId) {
        context.strokeStyle = '#ffffff';
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(cx, cz, 6.5, 0, Math.PI * 2);
        context.stroke();
      }
    }
  }, [snapshot, youId]);

  return (
    <figure className="moba-minimap">
      <canvas ref={canvas} width={WIDTH} height={HEIGHT} aria-label={label} role="img" />
    </figure>
  );
}
