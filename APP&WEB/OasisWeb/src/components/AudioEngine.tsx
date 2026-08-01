'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

// Minimal deterministic ambient audio using Web Audio API.
// Browser autoplay policies require a user gesture before audio can start.

class AmbientAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private noiseNode: AudioBufferSourceNode | null = null;
  private muted = true;

  isMuted() {
    return this.muted;
  }

  setMuted(value: boolean) {
    this.muted = value;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(value ? 0 : 0.18, this.ctx?.currentTime ?? 0, 0.15);
    }
  }

  start() {
    if (this.ctx) return; // already started
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;

    this.ctx = new Ctx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.18;
    this.masterGain.connect(this.ctx.destination);

    // Deep drone oscillators
    const freqs = [55, 82.4, 110]; // A1, E2, A2 (fifths)
    const types: OscillatorType[] = ['sine', 'triangle', 'sine'];
    freqs.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = types[i];
      osc.frequency.value = f;
      const gain = this.ctx!.createGain();
      gain.gain.value = 1 / freqs.length;
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start();
      this.oscillators.push(osc);
    });

    // Subtle noise wind layer
    const bufferSize = 2 * this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastNoise + 0.02 * white) / 1.02;
      lastNoise = data[i];
      data[i] *= 3.5;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 200;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.value = 0.08;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain!);
    noise.start();
    this.noiseNode = noise;
  }

  playWarp() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 2.8);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 3.2);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, t);
    filter.frequency.exponentialRampToValueAtTime(4000, t + 2.5);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 3.3);
  }

  dispose() {
    this.oscillators.forEach((o) => o.stop());
    this.noiseNode?.stop();
    this.ctx?.close();
    this.ctx = null;
    this.masterGain = null;
    this.oscillators = [];
    this.noiseNode = null;
  }
}

let lastNoise = 0;

export function useAudio() {
  const audio = useRef(new AmbientAudio());
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('oasis-muted') : null;
    const initial = saved === null ? false : saved === 'true';
    setMutedState(initial);
    audio.current.setMuted(initial);
    return () => audio.current.dispose();
  }, []);

  const setMuted = useCallback((value: boolean) => {
    setMutedState(value);
    localStorage.setItem('oasis-muted', String(value));
    audio.current.setMuted(value);
  }, []);

  const toggle = useCallback(() => setMuted(!muted), [muted, setMuted]);

  const start = useCallback(() => audio.current.start(), []);
  const playWarp = useCallback(() => audio.current.playWarp(), []);

  return { muted, toggle, start, playWarp, setMuted };
}

export function AudioToggle({
  muted,
  onToggle,
}: {
  muted: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="rounded-full border border-white/10 bg-black/60 p-2.5 text-white/80 backdrop-blur-md transition hover:bg-white/10 hover:text-white"
      aria-label={muted ? 'Unmute' : 'Mute'}
    >
      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
    </button>
  );
}
