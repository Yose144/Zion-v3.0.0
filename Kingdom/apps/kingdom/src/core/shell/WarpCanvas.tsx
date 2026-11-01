'use client';

/**
 * Warp hvězdné pole — přeneseno z desktop agenta
 * (`apps/desktop-agent/src/ui/renderer.js: initWarpStarfield`), aby klient
 * vypadal stejně jako desktop appka.
 *
 * Zásady, které se nesmí rozbít:
 *   - kreslí se 2D canvasem do pevné vrstvy pod obsahem (`z-index: 0`),
 *     obsah má vlastní vrstvu (`z-index: 1`), takže se nic nepřekrývá;
 *   - strop ~24 fps a DPR max 1.5 — je to dekorace, ne hra;
 *   - `prefers-reduced-motion` snižuje hustotu i rychlost (a nesmí se vypnout
 *     úplně: statické hvězdy jsou pořád pozadí).
 */
import { useEffect, useRef } from 'react';

/** Rasta One Love — zlato, červená, zelená. */
const STAR_COLORS: Array<[number, number, number]> = [
  [252, 209, 22],
  [228, 30, 43],
  [7, 137, 48],
];

interface Star {
  x: number;
  y: number;
  z: number;
  size: number;
  color: [number, number, number];
  px: number;
  py: number;
}

export function WarpCanvas() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const baseDensity = reduced ? 50 : 100;
    const speed = reduced ? 2.4 : 3.2;

    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0;
    let h = 0;
    let density = baseDensity;
    let frameId = 0;
    let last = 0;
    const stars: Star[] = [];
    const FRAME_INTERVAL = 1000 / 24;

    const pick = () => STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = Math.floor(window.innerWidth);
      h = Math.floor(window.innerHeight);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const areaScale = Math.sqrt((w * h) / (1280 * 800));
      density = Math.max(40, Math.min(140, Math.round((baseDensity * areaScale) / Math.sqrt(dpr))));
      seed();
    };

    const seed = () => {
      stars.length = 0;
      for (let i = 0; i < density; i += 1) {
        stars.push({
          x: Math.random() * w - w / 2,
          y: Math.random() * h - h / 2,
          z: Math.random() * w,
          size: Math.random() * 2 + 0.5,
          color: pick(),
          px: 0,
          py: 0,
        });
      }
    };

    const animate = (timestamp: number) => {
      frameId = window.requestAnimationFrame(animate);

      const delta = timestamp - last;
      if (delta < FRAME_INTERVAL) return;
      last = timestamp - (delta % FRAME_INTERVAL);

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';

      for (const star of stars) {
        const prevZ = star.z;
        star.z -= speed;
        if (star.z <= 1) {
          star.z = w;
          star.x = Math.random() * w - w / 2;
          star.y = Math.random() * h - h / 2;
          star.px = 0;
          star.py = 0;
        }

        const k = 128 / star.z;
        const x = star.x * k + w / 2;
        const y = star.y * k + h / 2;
        const prevK = 128 / prevZ;
        const pxs = star.x * prevK + w / 2;
        const pys = star.y * prevK + h / 2;

        if (x < 0 || x > w || y < 0 || y > h) continue;

        const [r, g, b] = star.color;
        const alpha = Math.min(1, (1 - star.z / w) * 1.4);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
        ctx.lineWidth = Math.max(0.4, star.size * (1 - star.z / w) * 1.6);
        ctx.beginPath();
        ctx.moveTo(pxs, pys);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    };

    resize();
    window.addEventListener('resize', resize);
    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className="k-warp" aria-hidden="true" />;
}
