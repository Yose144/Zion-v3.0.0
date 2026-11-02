/**
 * MOBA „PRVNÍ SVĚT" — zvuk.
 *
 * Všechno je **syntéza z oscilátorů a šumu** — v repu není jediný zvukový
 * soubor (stejné pravidlo jako u arény). AudioContext se otevírá až po gestu
 * (klik/klávesa), jinak ho prohlížeč zablokuje.
 *
 * Zvuk nikdy nerozhoduje o hře: hraje se z událostí, které už nastaly
 * (zásah = spadlo HP ve snapshotu). Když zvuk selže, hra běží dál.
 */

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!context) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      context = new Ctor();
    }
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {
    return null;
  }
}

/** Otevři audio po prvním gestu (klik / klávesa). */
export function unlockMobaAudio(): void {
  audio();
}

function tone(options: {
  freq: number;
  to?: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
}): void {
  const ctx = audio();
  if (!ctx) return;
  const start = ctx.currentTime + (options.delay ?? 0);
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = options.type ?? 'sine';
  osc.frequency.setValueAtTime(options.freq, start);
  if (options.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, options.to), start + options.duration);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(options.gain ?? 0.08, start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + options.duration);
  osc.connect(amp).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + options.duration + 0.02);
}

function noise(options: { duration: number; gain?: number; cutoff?: number }): void {
  const ctx = audio();
  if (!ctx) return;
  const length = Math.max(1, Math.floor(ctx.sampleRate * options.duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / length) ** 2;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = options.cutoff ?? 1200;
  const amp = ctx.createGain();
  amp.gain.value = options.gain ?? 0.05;
  source.connect(filter).connect(amp).connect(ctx.destination);
  source.start();
}

export const mobaAudio = {
  /** Zásah — krátký dutý úder. */
  hit(): void {
    tone({ freq: 220, to: 110, duration: 0.09, type: 'square', gain: 0.045 });
    noise({ duration: 0.07, gain: 0.03, cutoff: 900 });
  },
  /** Seslání kouzla — podle barvy postavy. */
  spell(color: string): void {
    const hue = color.replace('#', '');
    const base = 300 + (parseInt(hue.slice(0, 2), 16) % 200);
    tone({ freq: base, to: base * 2.2, duration: 0.22, type: 'triangle', gain: 0.05 });
    tone({ freq: base * 0.5, to: base, duration: 0.18, type: 'sine', gain: 0.035, delay: 0.02 });
  },
  /** Smrt hrdiny. */
  death(): void {
    tone({ freq: 180, to: 60, duration: 0.5, type: 'sawtooth', gain: 0.05 });
    noise({ duration: 0.25, gain: 0.04, cutoff: 500 });
  },
  /** Převzetí uzlu L5. */
  capture(): void {
    [523, 659, 784].forEach((freq, index) => {
      tone({ freq, duration: 0.22, type: 'sine', gain: 0.05, delay: index * 0.09 });
    });
  },
  /** Nová vlna minionů. */
  wave(): void {
    tone({ freq: 320, to: 420, duration: 0.16, type: 'triangle', gain: 0.035 });
  },
  /** Nákup v obchodě. */
  buy(): void {
    tone({ freq: 660, duration: 0.09, type: 'square', gain: 0.04 });
    tone({ freq: 880, duration: 0.12, type: 'square', gain: 0.035, delay: 0.07 });
  },
  /** Konec zápasu. */
  end(win: boolean): void {
    const notes = win ? [523, 659, 784, 1046] : [392, 330, 262, 196];
    notes.forEach((freq, index) => {
      tone({ freq, duration: 0.35, type: 'triangle', gain: 0.055, delay: index * 0.16 });
    });
  },
};
