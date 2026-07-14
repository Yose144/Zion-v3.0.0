import { useEffect, useRef } from 'react';

export default function WarpStarfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const starColor = [200, 118, 255];
    const baseDensity = prefersReducedMotion ? 50 : 100;
    const speed = prefersReducedMotion ? 2.4 : 3.2;
    const trailOpacity = prefersReducedMotion ? 0.06 : 0.045;

    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0;
    let h = 0;
    let density = baseDensity;
    const stars: {
      x: number;
      y: number;
      z: number;
      size: number;
      px: number;
      py: number;
    }[] = [];

    let frameId = 0;
    let running = true;
    const FRAME_INTERVAL = 1000 / 24;
    let lastFrameTime = 0;

    const rebuildGradient = () => {
      const g = ctx.createRadialGradient(w * 0.4, h * 0.6, 0, w * 0.4, h * 0.6, Math.max(w, h));
      g.addColorStop(0, 'rgba(22, 8, 32, 0.90)');
      g.addColorStop(1, 'rgba(4, 2, 12, 0.98)');
      return g;
    };

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
      density = Math.max(40, Math.min(140, Math.round(baseDensity * areaScale / Math.sqrt(dpr))));
      seed();
    };

    const seed = () => {
      stars.length = 0;
      for (let i = 0; i < density; i++) {
        stars.push({
          x: Math.random() * w - w / 2,
          y: Math.random() * h - h / 2,
          z: Math.random() * w,
          size: Math.random() * 2 + 0.5,
          px: 0,
          py: 0,
        });
      }
    };

    const gradient = () => {
      const g = ctx.createRadialGradient(w * 0.4, h * 0.6, 0, w * 0.4, h * 0.6, Math.max(w, h));
      g.addColorStop(0, 'rgba(22, 8, 32, 0.90)');
      g.addColorStop(1, 'rgba(4, 2, 12, 0.98)');
      return g;
    };

    const animate = (timestamp: number) => {
      if (!running) return;
      frameId = window.requestAnimationFrame(animate);
      const delta = timestamp - lastFrameTime;
      if (delta < FRAME_INTERVAL) return;
      lastFrameTime = timestamp - (delta % FRAME_INTERVAL);

      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(Math.max(trailOpacity, 0.02), 0.3)})`;
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = rebuildGradient();
      ctx.globalAlpha = 0.22;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;

      const hw = w / 2;
      const hh = h / 2;

      for (const star of stars) {
        const prevX = star.px || (star.x / star.z) * w + hw;
        const prevY = star.py || (star.y / star.z) * h + hh;
        star.z -= speed;
        if (star.z <= 0) {
          star.z = w;
          star.x = Math.random() * w - hw;
          star.y = Math.random() * h - hh;
          star.px = (star.x / star.z) * w + hw;
          star.py = (star.y / star.z) * h + hh;
          continue;
        }
        const x = (star.x / star.z) * w + hw;
        const y = (star.y / star.z) * h + hh;
        const size = (1 - star.z / w) * star.size * 2;
        const brightness = 1 - star.z / w;
        const alpha = Math.min(1, 0.08 + brightness * 0.92);

        ctx.strokeStyle = `rgba(${starColor[0]}, ${starColor[1]}, ${starColor[2]}, ${alpha})`;
        ctx.lineWidth = Math.max(0.5, (size * 0.5) / Math.sqrt(dpr));
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(x, y);
        ctx.stroke();

        ctx.fillStyle = `rgba(${starColor[0]}, ${starColor[1]}, ${starColor[2]}, ${Math.min(1, alpha + 0.15)})`;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(size * 0.65, 0.55), 0, Math.PI * 2);
        ctx.fill();

        star.px = x;
        star.py = y;
      }
    };

    resize();
    frameId = window.requestAnimationFrame(animate);

    window.addEventListener('resize', resize);

    return () => {
      running = false;
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="warp-starfield" aria-hidden="true" />;
}
