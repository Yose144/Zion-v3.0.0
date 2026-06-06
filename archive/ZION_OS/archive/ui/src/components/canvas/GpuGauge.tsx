import { useEffect, useRef } from "react";

interface Props {
  value: number; // 0-100
  label: string;
  sublabel?: string;
  color?: string;
  size?: number;
}

export function GpuGauge({ value, label, sublabel, color = "#00ffaa", size = 140 }: Props) {
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

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size * 0.38;
    const startAngle = Math.PI * 0.8;
    const endAngle = Math.PI * 2.2;
    const totalAngle = endAngle - startAngle;

    // Clear
    ctx.clearRect(0, 0, size, size);

    // Background arc
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.stroke();

    // Glow arc (value)
    const valueAngle = startAngle + (totalAngle * Math.min(value, 100) / 100);
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, valueAngle);
    ctx.strokeStyle = color;
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Ticks
    for (let i = 0; i <= 10; i++) {
      const angle = startAngle + (totalAngle * i / 10);
      const innerR = radius - 16;
      const outerR = radius - 8;
      ctx.beginPath();
      ctx.moveTo(centerX + Math.cos(angle) * innerR, centerY + Math.sin(angle) * innerR);
      ctx.lineTo(centerX + Math.cos(angle) * outerR, centerY + Math.sin(angle) * outerR);
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Value text
    ctx.font = `bold ${size * 0.22}px "JetBrains Mono", monospace`;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${Math.round(value)}%`, centerX, centerY);

    // Label
    ctx.font = `${size * 0.09}px "Inter", sans-serif`;
    ctx.fillStyle = color;
    ctx.fillText(label, centerX, centerY - size * 0.28);

    // Sublabel
    if (sublabel) {
      ctx.font = `${size * 0.07}px "JetBrains Mono", monospace`;
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.fillText(sublabel, centerX, centerY + size * 0.28);
    }
  }, [value, label, sublabel, color, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="inline-block"
    />
  );
}
