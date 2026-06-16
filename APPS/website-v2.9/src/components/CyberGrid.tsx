'use client';
import { useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export default function CyberGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { currentTheme } = useTheme();
  const themeName = currentTheme.name;

  useEffect(() => {
    if (themeName !== 'cyberpunk') return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const c = canvas;
    const context = ctx;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();

    /* Respect reduced-motion preference */
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let t = 0;
    let raf: number;

    function draw() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      ctx!.strokeStyle = 'rgba(255,0,255,0.25)';
      ctx!.lineWidth = 1;
      const spacing = 40;

      for (let x = 0; x < canvas!.width; x += spacing) {
        ctx!.beginPath();
        ctx!.moveTo(x, 0);
        const wave = Math.sin((x + t) * 0.02) * 10;
        ctx!.lineTo(x + wave, canvas!.height);
        ctx!.stroke();
      }
      for (let y = 0; y < canvas!.height; y += spacing) {
        ctx!.beginPath();
        const wave = Math.cos((y + t) * 0.02) * 10;
        ctx!.moveTo(0, y);
        ctx!.lineTo(canvas!.width, y + wave);
        ctx!.stroke();
      }

      t += 1.5;
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [themeName]);

  return themeName === 'cyberpunk' ? (
    <canvas ref={canvasRef} className="fixed inset-0 -z-20 opacity-60" />
  ) : null;
}
