/**
 * Procedural ambience for the project scenes.
 *
 * The scenes ship without soundtrack files; instead of a dead "sound pending" button,
 * this synthesises a quiet bed from filtered noise plus a slow LFO. No assets, no network,
 * no autoplay — the browser only starts the context after a click.
 *
 * If a real track exists at `/audio/<slug>.mp3`, `SceneSoundToggle` plays that instead.
 */

export type AmbienceProfile = 'surf' | 'wind' | 'forest' | 'desert' | 'space' | 'temple';

interface ProfileSpec {
  filter: BiquadFilterType;
  frequency: number;
  Q: number;
  /** LFO rate in Hz and depth in Hz applied to the filter frequency. */
  lfoRate: number;
  lfoDepth: number;
  /** Adds a low sine drone (space / temple). */
  drone?: number;
  volume: number;
}

const PROFILES: Record<AmbienceProfile, ProfileSpec> = {
  surf: { filter: 'lowpass', frequency: 520, Q: 0.7, lfoRate: 0.09, lfoDepth: 260, volume: 0.22 },
  wind: { filter: 'bandpass', frequency: 700, Q: 0.6, lfoRate: 0.05, lfoDepth: 320, volume: 0.18 },
  forest: { filter: 'highpass', frequency: 1800, Q: 0.4, lfoRate: 0.13, lfoDepth: 800, volume: 0.1 },
  desert: { filter: 'bandpass', frequency: 380, Q: 0.5, lfoRate: 0.04, lfoDepth: 120, volume: 0.16 },
  space: { filter: 'lowpass', frequency: 180, Q: 1.2, lfoRate: 0.02, lfoDepth: 60, drone: 55, volume: 0.2 },
  temple: { filter: 'lowpass', frequency: 900, Q: 0.8, lfoRate: 0.03, lfoDepth: 180, drone: 110, volume: 0.14 },
};

export interface Ambience {
  start: () => Promise<void>;
  stop: () => void;
  dispose: () => void;
}

/** Pink-ish noise: white noise with a one-pole low-pass integrated in place. */
function noiseBuffer(context: AudioContext, seconds = 2): AudioBuffer {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    last = 0.98 * last + 0.02 * white;
    data[i] = last * 3.2;
  }
  return buffer;
}

export function createAmbience(profile: AmbienceProfile): Ambience {
  const spec = PROFILES[profile] ?? PROFILES.wind;
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let stopLfo: (() => void) | null = null;

  const ensure = (): AudioContext => {
    if (!context) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      context = new Ctor();
    }
    return context;
  };

  return {
    async start() {
      const ctx = ensure();
      if (ctx.state === 'suspended') await ctx.resume();
      if (master) return;

      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(ctx);
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = spec.filter;
      filter.frequency.value = spec.frequency;
      filter.Q.value = spec.Q;

      master = ctx.createGain();
      master.gain.value = 0;
      source.connect(filter).connect(master).connect(ctx.destination);

      // Slow swell: the filter opens and closes like a wave set or a gust.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = spec.lfoRate;
      const depth = ctx.createGain();
      depth.gain.value = spec.lfoDepth;
      lfo.connect(depth).connect(filter.frequency);
      lfo.start();

      const nodes: OscillatorNode[] = [lfo];
      if (spec.drone) {
        const drone = ctx.createOscillator();
        drone.type = 'sine';
        drone.frequency.value = spec.drone;
        const droneGain = ctx.createGain();
        droneGain.gain.value = 0.35;
        drone.connect(droneGain).connect(master);
        drone.start();
        nodes.push(drone);
      }

      source.start();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(0, ctx.currentTime);
      master.gain.linearRampToValueAtTime(spec.volume, ctx.currentTime + 2.4);

      stopLfo = () => {
        try {
          source.stop();
          for (const node of nodes) node.stop();
        } catch {
          // Already stopped.
        }
      };
    },

    stop() {
      if (!context || !master) return;
      const gain = master;
      gain.gain.cancelScheduledValues(context.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, context.currentTime);
      gain.gain.linearRampToValueAtTime(0, context.currentTime + 0.8);
      const stop = stopLfo;
      window.setTimeout(() => {
        stop?.();
        master = null;
        stopLfo = null;
      }, 900);
    },

    dispose() {
      stopLfo?.();
      stopLfo = null;
      master = null;
      void context?.close();
      context = null;
    },
  };
}
