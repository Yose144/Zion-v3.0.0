'use client';

import { useEffect, useRef } from 'react';

/**
 * StarfieldCanvas — rasta gold warp-star animation, lite version.
 *
 * Renders a fixed full-viewport <canvas> at z-index 0 with a neutral
 * dark haze and ~280 warm gold stars streaking toward the viewer.
 */
export default function StarfieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const STAR_COLOR = [252, 209, 22]; // rasta gold
    const DENSITY = 280;
    const SPEED = 1.4;
    const TRAIL_OPACITY = 0.08;
    const FPS_LIMIT = 24;
    const GRADIENT_ALPHA = 0.22;

    let stars: { x: number; y: number; z: number; size: number; px: number; py: number }[] = [];
    let cachedGradient: CanvasGradient | null = null;
    let lastFrameTime = 0;
    let rafId = 0;

    const rebuildGradient = () => {
      const g = ctx.createRadialGradient(
        canvas.width * 0.5, canvas.height * 0.7, 0,
        canvas.width * 0.5, canvas.height * 0.7, Math.max(canvas.width, canvas.height),
      );
      g.addColorStop(0, 'rgba(26, 26, 26, 1)');
      g.addColorStop(1, 'rgba(8, 8, 8, 1)');
      cachedGradient = g;
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      rebuildGradient();
    };

    const seedStars = () => {
      stars = [];
      for (let i = 0; i < DENSITY; i++) {
        stars.push({
          x: Math.random() * canvas.width - canvas.width / 2,
          y: Math.random() * canvas.height - canvas.height / 2,
          z: Math.random() * canvas.width,
          size: Math.random() * 2 + 0.5,
          px: 0,
          py: 0,
        });
      }
    };

    const animate = (timestamp: number) => {
      rafId = requestAnimationFrame(animate);
      const frameInterval = 1000 / FPS_LIMIT;
      const delta = timestamp - lastFrameTime;
      if (delta < frameInterval) return;
      lastFrameTime = timestamp - (delta % frameInterval);

      ctx.fillStyle =
        'rgba(0, 0, 0, ' + Math.min(Math.max(TRAIL_OPACITY * 0.5, 0.01), 0.15) + ')';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (cachedGradient) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = cachedGradient;
        ctx.globalAlpha = GRADIENT_ALPHA;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
      }

      const hw = canvas.width / 2;
      const hh = canvas.height / 2;

      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        const prevX = (star.x / star.z) * canvas.width + hw;
        const prevY = (star.y / star.z) * canvas.height + hh;
        star.z -= SPEED;
        if (star.z <= 0) {
          star.z = canvas.width;
          star.x = Math.random() * canvas.width - hw;
          star.y = Math.random() * canvas.height - hh;
          star.px = prevX;
          star.py = prevY;
          continue;
        }
        const x = (star.x / star.z) * canvas.width + hw;
        const y = (star.y / star.z) * canvas.height + hh;
        const size = (1 - star.z / canvas.width) * star.size * 2;
        const brightness = 1 - star.z / canvas.width;
        const alpha = Math.min(1, 0.08 + brightness * 0.92);
        ctx.strokeStyle =
          'rgba(' + STAR_COLOR[0] + ',' + STAR_COLOR[1] + ',' + STAR_COLOR[2] + ',' + alpha + ')';
        ctx.lineWidth = Math.max(0.5, size * 0.5);
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.fillStyle =
          'rgba(' +
          STAR_COLOR[0] +
          ',' +
          STAR_COLOR[1] +
          ',' +
          STAR_COLOR[2] +
          ',' +
          Math.min(1, alpha + 0.15) +
          ')';
        ctx.beginPath();
        ctx.arc(x, y, Math.max(size * 0.65, 0.55), 0, Math.PI * 2);
        ctx.fill();
        star.px = x;
        star.py = y;
      }
    };

    const onResize = () => {
      resize();
      seedStars();
    };

    resize();
    seedStars();
    rafId = requestAnimationFrame(animate);
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="starfield-canvas" aria-hidden="true" />;
}
