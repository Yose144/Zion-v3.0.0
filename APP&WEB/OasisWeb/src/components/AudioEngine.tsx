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
  private engineOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private padNodes: { osc: OscillatorNode; gain: GainNode; filter: BiquadFilterNode }[] = [];
  private padLfo: OscillatorNode | null = null;
  private padLfoGain: GainNode | null = null;
  private chimeTimer: ReturnType<typeof setInterval> | null = null;
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

    // Chord pad: Am(add9) with slow filter sweep
    const chordFreqs = [55, 110, 130.81, 164.81, 196]; // A1 A2 C3 E3 G3
    chordFreqs.forEach((f) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const filter = this.ctx!.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600;
      filter.Q.value = 1.5;
      const gain = this.ctx!.createGain();
      gain.gain.value = 0.04;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);
      osc.start();
      this.padNodes.push({ osc, gain, filter });
    });

    // LFO slowly sweeping the pad filter 200-1000 Hz
    this.padLfo = this.ctx.createOscillator();
    this.padLfo.type = 'sine';
    this.padLfo.frequency.value = 0.05;
    this.padLfoGain = this.ctx.createGain();
    this.padLfoGain.gain.value = 400; // +/- 400 Hz around base
    this.padLfo.connect(this.padLfoGain);
    this.padLfoGain.connect(this.padNodes[0].filter.frequency);
    this.padLfo.start();

    // Random space chimes
    this.scheduleChimes();
  }

  private scheduleChimes() {
    if (this.chimeTimer) clearInterval(this.chimeTimer);
    this.chimeTimer = setInterval(() => {
      if (this.muted || Math.random() > 0.4) return;
      this.playChime();
    }, 7000 + Math.random() * 8000);
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

  startEngine() {
    if (!this.ctx || this.muted || this.engineOsc) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 60;

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 180;
    this.engineFilter.Q.value = 0.7;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;

    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain!);
    this.engineOsc.start();
  }

  stopEngine() {
    try {
      this.engineOsc?.stop();
    } catch {}
    this.engineOsc?.disconnect();
    this.engineFilter?.disconnect();
    this.engineGain?.disconnect();
    this.engineOsc = null;
    this.engineFilter = null;
    this.engineGain = null;
  }

  setEngine(speed: number) {
    if (!this.ctx || !this.engineOsc || !this.engineFilter || !this.engineGain || this.muted) return;
    const t = this.ctx.currentTime;
    const targetFreq = 60 + Math.min(speed, 12) * 18;
    const targetFilter = 180 + Math.min(speed, 12) * 120;
    const targetGain = 0.01 + Math.min(speed / 12, 1) * 0.08;

    this.engineOsc.frequency.setTargetAtTime(targetFreq, t, 0.12);
    this.engineFilter.frequency.setTargetAtTime(targetFilter, t, 0.12);
    this.engineGain.gain.setTargetAtTime(targetGain, t, 0.12);
  }

  private playChime() {
    if (!this.ctx || this.muted) return;
    const scale = [261.63, 311.13, 392, 466.16, 523.25, 622.25, 784, 932.33]; // C pentatonic-ish
    const f = scale[Math.floor(Math.random() * scale.length)];
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.035, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 2.5);
    const delay = this.ctx.createDelay(1);
    delay.delayTime.value = 0.3;
    const feedback = this.ctx.createGain();
    feedback.gain.value = 0.25;
    osc.connect(gain);
    gain.connect(this.masterGain!);
    gain.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    feedback.connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 3);
  }

  playQuestComplete() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.5]; // C major arpeggio
    freqs.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0, t + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.05, t + i * 0.12 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 1.2);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + i * 0.12);
      osc.stop(t + i * 0.12 + 1.5);
    });
  }

  playScanComplete() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.6);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.05, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1);
    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 1.2);
  }

  playApproach() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 1.2);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.06, t + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, t);
    filter.frequency.exponentialRampToValueAtTime(120, t + 1.5);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 2);
  }

  playBoost() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.8);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, t);
    filter.frequency.exponentialRampToValueAtTime(5000, t + 0.7);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 1.3);
  }

  dispose() {
    this.stopEngine();
    this.oscillators.forEach((o) => o.stop());
    this.padNodes.forEach((p) => p.osc.stop());
    this.padLfo?.stop();
    if (this.chimeTimer) clearInterval(this.chimeTimer);
    this.noiseNode?.stop();
    this.ctx?.close();
    this.ctx = null;
    this.masterGain = null;
    this.oscillators = [];
    this.padNodes = [];
    this.noiseNode = null;
    this.padLfo = null;
    this.padLfoGain = null;
    this.chimeTimer = null;
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
  const playBoost = useCallback(() => audio.current.playBoost(), []);
  const playQuestComplete = useCallback(() => audio.current.playQuestComplete(), []);
  const playScanComplete = useCallback(() => audio.current.playScanComplete(), []);
  const playApproach = useCallback(() => audio.current.playApproach(), []);
  const startEngine = useCallback(() => audio.current.startEngine(), []);
  const stopEngine = useCallback(() => audio.current.stopEngine(), []);
  const setEngine = useCallback((speed: number) => audio.current.setEngine(speed), []);

  return { muted, toggle, start, playWarp, playBoost, playQuestComplete, playScanComplete, playApproach, startEngine, stopEngine, setEngine, setMuted };
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
