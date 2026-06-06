import { useEffect, useRef } from "react";

interface Props {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function Sparkline({ data, width = 200, height = 60, color = "#00ffaa" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const max = Math.max(...data, 1);
    const min = Math.min(...data);
    const range = max - min || 1;

    const stepX = width / (data.length - 1);

    // Fill area
    ctx.beginPath();
    ctx.moveTo(0, height);
    data.forEach((val, i) => {
      const x = i * stepX;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = color + "20"; // 12% opacity
    ctx.fill();

    // Line
    ctx.beginPath();
    data.forEach((val, i) => {
      const x = i * stepX;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 5;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [data, width, height, color]);

  return <canvas ref={canvasRef} style={{ width, height }} />;
}
