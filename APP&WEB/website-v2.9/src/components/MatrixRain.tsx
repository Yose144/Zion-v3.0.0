'use client';
import { useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export default function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { currentTheme } = useTheme();
  const themeName = currentTheme.name;

  useEffect(() => {
    if (themeName !== 'matrix') return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();

    /* Respect reduced-motion preference */
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const chars = '01Ƶ∴✶✧※';
    const fontSize = 16;
    const columns = Math.floor(canvas.width / fontSize);
    const drops: number[] = new Array(columns).fill(1);
    let raf: number;

    function draw() {
      ctx!.fillStyle = 'rgba(0,0,0,0.08)';
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height);
      ctx!.fillStyle = '#00ff41';
      ctx!.font = fontSize + 'px monospace';
      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx!.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas!.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [themeName]);

  return themeName === 'matrix' ? (
    <canvas ref={canvasRef} className="fixed inset-0 -z-20 opacity-70" />
  ) : null;
}
