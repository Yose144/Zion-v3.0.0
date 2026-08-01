'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronUp, ChevronDown, Zap, X } from 'lucide-react';
import VirtualJoystick from './VirtualJoystick';

export interface MobileInput {
  move: { x: number; y: number };
  look: { x: number; y: number };
  up: boolean;
  down: boolean;
  boost: boolean;
}

interface MobileControlsProps {
  inputRef: React.RefObject<MobileInput | null>;
  onExit: () => void;
}

export default function MobileControls({ inputRef, onExit }: MobileControlsProps) {
  const [boost, setBoost] = useState(false);

  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.boost = boost;
  }, [boost, inputRef]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pointer-events-none fixed inset-0 z-50"
    >
      {/* Crosshair */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-4 w-4 rounded-full border border-white/40" />
        <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/60" />
      </div>

      {/* Movement joystick */}
      <div className="pointer-events-auto absolute bottom-6 left-6">
        <VirtualJoystick
          label="Move"
          size={90}
          onChange={(v) => {
            if (inputRef.current) inputRef.current.move = v;
          }}
          onEnd={() => {
            if (inputRef.current) inputRef.current.move = { x: 0, y: 0 };
          }}
        />
      </div>

      {/* Look joystick */}
      <div className="pointer-events-auto absolute bottom-6 right-6">
        <VirtualJoystick
          label="Look"
          size={90}
          onChange={(v) => {
            if (inputRef.current) inputRef.current.look = v;
          }}
          onEnd={() => {
            if (inputRef.current) inputRef.current.look = { x: 0, y: 0 };
          }}
        />
      </div>

      {/* Vertical + boost controls */}
      <div className="pointer-events-auto absolute right-6 top-20 flex flex-col gap-2">
        <button
          onTouchStart={() => {
            if (inputRef.current) inputRef.current.up = true;
          }}
          onTouchEnd={() => {
            if (inputRef.current) inputRef.current.up = false;
          }}
          onMouseDown={() => {
            if (inputRef.current) inputRef.current.up = true;
          }}
          onMouseUp={() => {
            if (inputRef.current) inputRef.current.up = false;
          }}
          onMouseLeave={() => {
            if (inputRef.current) inputRef.current.up = false;
          }}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white/80 backdrop-blur-sm active:bg-white/20"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
        <button
          onTouchStart={() => {
            if (inputRef.current) inputRef.current.down = true;
          }}
          onTouchEnd={() => {
            if (inputRef.current) inputRef.current.down = false;
          }}
          onMouseDown={() => {
            if (inputRef.current) inputRef.current.down = true;
          }}
          onMouseUp={() => {
            if (inputRef.current) inputRef.current.down = false;
          }}
          onMouseLeave={() => {
            if (inputRef.current) inputRef.current.down = false;
          }}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white/80 backdrop-blur-sm active:bg-white/20"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>

      {/* Boost and exit */}
      <div className="pointer-events-auto absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3">
        <button
          onTouchStart={() => setBoost(true)}
          onTouchEnd={() => setBoost(false)}
          onMouseDown={() => setBoost(true)}
          onMouseUp={() => setBoost(false)}
          onMouseLeave={() => setBoost(false)}
          className={`flex h-12 w-12 items-center justify-center rounded-full border backdrop-blur-sm transition ${
            boost ? 'border-oasis-gold bg-oasis-gold/30 text-oasis-gold' : 'border-oasis-gold/30 bg-black/60 text-oasis-gold'
          }`}
        >
          <Zap className="h-5 w-5" />
        </button>
        <button
          onClick={onExit}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white backdrop-blur-sm"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </motion.div>
  );
}
