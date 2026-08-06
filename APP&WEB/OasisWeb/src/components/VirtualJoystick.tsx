'use client';

import { useRef, useState, useCallback } from 'react';

interface JoystickValue {
  x: number;
  y: number;
}

interface VirtualJoystickProps {
  onChange: (value: JoystickValue) => void;
  onEnd?: () => void;
  label?: string;
  size?: number;
}

export default function VirtualJoystick({ onChange, onEnd, label, size = 96 }: VirtualJoystickProps) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const activeRef = useRef(false);

  const handleTouch = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      if (!zoneRef.current) return;
      const rect = zoneRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const touch = e.touches[0];
      const dx = touch.clientX - centerX;
      const dy = touch.clientY - centerY;
      const radius = rect.width / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const clamped = dist > radius ? radius : dist;
      const nx = dist > 0 ? (dx / dist) * clamped : 0;
      const ny = dist > 0 ? (dy / dist) * clamped : 0;

      setPos({ x: nx, y: ny });
      onChange({ x: nx / radius, y: ny / radius });
    },
    [onChange]
  );

  const start = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      activeRef.current = true;
      handleTouch(e);
    },
    [handleTouch]
  );

  const end = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      activeRef.current = false;
      setPos({ x: 0, y: 0 });
      onChange({ x: 0, y: 0 });
      onEnd?.();
    },
    [onChange, onEnd]
  );

  return (
    <div
      ref={zoneRef}
      className="relative flex items-center justify-center rounded-full border border-white/10 bg-black/40 backdrop-blur-sm touch-none select-none"
      style={{ width: size, height: size }}
      onTouchStart={start}
      onTouchMove={handleTouch}
      onTouchEnd={end}
      onTouchCancel={end}
    >
      {label && (
        <span className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-wider text-white/50">
          {label}
        </span>
      )}
      <div
        className="rounded-full bg-oasis-cyan/80 shadow-[0_0_12px_rgba(7,137,48,0.6)] transition-transform"
        style={{
          width: size * 0.36,
          height: size * 0.36,
          transform: `translate(${pos.x}px, ${pos.y}px)`,
        }}
      />
    </div>
  );
}
