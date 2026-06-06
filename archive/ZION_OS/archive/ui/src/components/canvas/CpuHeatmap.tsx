import { useEffect, useRef } from "react";

interface Props {
  cores: number[]; // 0-100 per core
  size?: number;
}

export function CpuHeatmap({ cores, size = 120 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, size, size);

    const cols = Math.ceil(Math.sqrt(cores.length));
    const cellSize = size / cols;
    const gap = 3;

    cores.forEach((val, i) => {
      const x = (i % cols) * cellSize + gap / 2;
      const y = Math.floor(i / cols) * cellSize + gap / 2;
      const w = cellSize - gap;
      const h = cellSize - gap;

      // Color based on usage
      const r = Math.round((val / 100) * 255);
      const g = Math.round((1 - val / 100) * 200);
      const color = `rgb(${r + 50}, ${g}, 50)`;

      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = val > 50 ? 8 : 0;
      ctx.fillRect(x, y, w, h);
      ctx.shadowBlur = 0;

      // Border
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x, y, w, h);
    });
  }, [cores, size]);

  return <canvas ref={canvasRef} style={{ width: size, height: size }} />;
}
