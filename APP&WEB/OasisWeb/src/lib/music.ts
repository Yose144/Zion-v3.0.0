// Generative music stations for the OASIS music player.
// Built on the Web Audio API — these are oscillator/procedural tracks
// that replace the old low-frequency buzzy ambient drone.

export interface MusicStation {
  id: string;
  name: string;
  color: string;
  build(ctx: AudioContext, destination: AudioNode): MusicRuntime;
}

export interface MusicRuntime {
  stop: () => void;
}

function rnd(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function disconnectNode(n: AudioNode | null) {
  if (!n) return;
  try {
    n.disconnect();
  } catch {}
}

function stopOsc(o: OscillatorNode | null) {
  if (!o) return;
  try {
    o.stop();
  } catch {}
}

// ---------------------------------------------------------------------------
// Station 1: Oasis Drift
// Soft, slow-moving chord pad with occasional glassy chimes.
// ---------------------------------------------------------------------------
function buildOasisDrift(ctx: AudioContext, destination: AudioNode): MusicRuntime {
  const rootGain = ctx.createGain();
  rootGain.gain.value = 0.5;
  rootGain.connect(destination);

  const padFreqs = [261.63, 329.63, 392.0, 523.25, 659.25]; // C add9 / major-ish
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 850;
  filter.Q.value = 0.8;
  filter.connect(rootGain);

  const padOscs: OscillatorNode[] = [];
  const padGains: GainNode[] = [];
  padFreqs.forEach((f) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = 0.03;
    osc.connect(g);
    g.connect(filter);
    osc.start();
    padOscs.push(osc);
    padGains.push(g);
  });

  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.06;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 320;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);
  lfo.start();

  // Pentatonic scale: C4–C6 major pentatonic
  const scale = [
    261.63, 293.66, 329.63, 392.0, 440.0,
    523.25, 587.33, 659.25, 783.99, 880.0, 1046.5,
  ];

  const chimeOscs: OscillatorNode[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;

  const playChime = () => {
    const f = scale[Math.floor(Math.random() * scale.length)];
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.035, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 2.6);

    const delay = ctx.createDelay(1.2);
    delay.delayTime.value = 0.35;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.28;

    osc.connect(g);
    g.connect(rootGain);
    g.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    feedback.connect(rootGain);

    osc.start(t);
    osc.stop(t + 2.8);
    chimeOscs.push(osc);
  };

  timer = setInterval(() => {
    if (Math.random() > 0.5) return;
    playChime();
  }, 6500 + Math.random() * 7000);

  return {
    stop: () => {
      if (timer) clearInterval(timer);
      stopOsc(lfo);
      padOscs.forEach(stopOsc);
      chimeOscs.forEach(stopOsc);
      disconnectNode(lfo);
      disconnectNode(lfoGain);
      disconnectNode(filter);
      padGains.forEach(disconnectNode);
      padOscs.forEach(disconnectNode);
      disconnectNode(rootGain);
    },
  };
}

// ---------------------------------------------------------------------------
// Station 2: Crystal Fields
// Gentle generative arpeggio over a held pad.
// ---------------------------------------------------------------------------
function buildCrystalFields(ctx: AudioContext, destination: AudioNode): MusicRuntime {
  const rootGain = ctx.createGain();
  rootGain.gain.value = 0.55;
  rootGain.connect(destination);

  const padFreqs = [261.63, 392.0]; // C4 / G4
  const padFilter = ctx.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = 600;
  padFilter.Q.value = 0.7;
  padFilter.connect(rootGain);

  const padOscs: OscillatorNode[] = [];
  const padGains: GainNode[] = [];
  padFreqs.forEach((f) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = 0.035;
    osc.connect(g);
    g.connect(padFilter);
    osc.start();
    padOscs.push(osc);
    padGains.push(g);
  });

  const scale = [
    261.63, 293.66, 329.63, 392.0, 440.0,
    523.25, 587.33, 659.25, 783.99, 880.0, 1046.5,
  ];

  const arpOscs: OscillatorNode[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;

  const playNote = (offset = 0) => {
    const f = scale[Math.floor(Math.random() * scale.length)];
    const t = ctx.currentTime + offset;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.045, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

    const delay = ctx.createDelay(0.8);
    delay.delayTime.value = 0.22;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.25;

    osc.connect(g);
    g.connect(rootGain);
    g.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    feedback.connect(rootGain);

    osc.start(t);
    osc.stop(t + 0.7);
    arpOscs.push(osc);
  };

  const step = 0.58;
  timer = setInterval(() => {
    playNote();
    if (Math.random() > 0.55) {
      setTimeout(() => playNote(rnd(0.16, 0.26)), 160);
    }
  }, step * 1000);

  return {
    stop: () => {
      if (timer) clearInterval(timer);
      padOscs.forEach(stopOsc);
      arpOscs.forEach(stopOsc);
      disconnectNode(padFilter);
      padGains.forEach(disconnectNode);
      padOscs.forEach(disconnectNode);
      disconnectNode(rootGain);
    },
  };
}

// ---------------------------------------------------------------------------
// Station 3: Nebula Choir
// Slow spectral drone with filter sweeps and rare high sparkles.
// ---------------------------------------------------------------------------
function buildNebulaChoir(ctx: AudioContext, destination: AudioNode): MusicRuntime {
  const rootGain = ctx.createGain();
  rootGain.gain.value = 0.5;
  rootGain.connect(destination);

  const chord = [196.0, 246.94, 293.66, 392.0, 493.88, 587.33]; // G major-ish cluster
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1050;
  filter.Q.value = 1.0;
  filter.connect(rootGain);

  const oscs: OscillatorNode[] = [];
  const gains: GainNode[] = [];
  chord.forEach((f) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = 0.022;
    osc.connect(g);
    g.connect(filter);
    osc.start();
    oscs.push(osc);
    gains.push(g);
  });

  const filterLfo = ctx.createOscillator();
  filterLfo.type = 'sine';
  filterLfo.frequency.value = 0.045;
  const filterLfoGain = ctx.createGain();
  filterLfoGain.gain.value = 400;
  filterLfo.connect(filterLfoGain);
  filterLfoGain.connect(filter.frequency);
  filterLfo.start();

  const ampLfo = ctx.createOscillator();
  ampLfo.type = 'sine';
  ampLfo.frequency.value = 0.035;
  const ampLfoGain = ctx.createGain();
  ampLfoGain.gain.value = 0.06;
  ampLfo.connect(ampLfoGain);
  ampLfoGain.connect(rootGain.gain);
  ampLfo.start();

  const sparkleScale = [
    1046.5, 1174.66, 1318.51, 1567.98, 1760.0, 2093.0,
  ];

  const sparkleOscs: OscillatorNode[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;

  const playSparkle = () => {
    const f = sparkleScale[Math.floor(Math.random() * sparkleScale.length)];
    const t = ctx.currentTime + rnd(0, 0.4);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.02, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 2.0);
    osc.connect(g);
    g.connect(rootGain);
    osc.start(t);
    osc.stop(t + 2.2);
    sparkleOscs.push(osc);
  };

  timer = setInterval(() => {
    if (Math.random() > 0.45) return;
    playSparkle();
  }, 7000 + Math.random() * 8000);

  return {
    stop: () => {
      if (timer) clearInterval(timer);
      stopOsc(filterLfo);
      stopOsc(ampLfo);
      oscs.forEach(stopOsc);
      sparkleOscs.forEach(stopOsc);
      disconnectNode(filterLfo);
      disconnectNode(filterLfoGain);
      disconnectNode(ampLfo);
      disconnectNode(ampLfoGain);
      disconnectNode(filter);
      gains.forEach(disconnectNode);
      oscs.forEach(disconnectNode);
      disconnectNode(rootGain);
    },
  };
}

export const MUSIC_STATIONS: MusicStation[] = [
  { id: 'oasis-drift', name: 'OASIS Drift', color: '#078930', build: buildOasisDrift },
  { id: 'crystal-fields', name: 'Crystal Fields', color: '#e41e2b', build: buildCrystalFields },
  { id: 'nebula-choir', name: 'Nebula Choir', color: '#e41e2b', build: buildNebulaChoir },
];

export class MusicEngine {
  private ctx: AudioContext;
  private destination: AudioNode;
  private gain: GainNode;
  private current: MusicRuntime | null = null;
  private _volume = 0.5;
  private _playing = false;
  private _index = 0;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.destination = destination;
    this.gain = ctx.createGain();
    this.gain.gain.value = this._volume;
    this.gain.connect(destination);
  }

  get index() {
    return this._index;
  }

  get playing() {
    return this._playing;
  }

  get volume() {
    return this._volume;
  }

  setVolume(value: number) {
    this._volume = Math.max(0, Math.min(1, value));
    this.gain.gain.setTargetAtTime(this._volume, this.ctx.currentTime, 0.05);
  }

  play(index: number) {
    this.stop();
    this._index = index % MUSIC_STATIONS.length;
    if (this._index < 0) this._index += MUSIC_STATIONS.length;
    const station = MUSIC_STATIONS[this._index];
    if (!station) return;
    this.current = station.build(this.ctx, this.gain);
    this._playing = true;
  }

  stop() {
    if (this.current) {
      this.current.stop();
      this.current = null;
    }
    this._playing = false;
  }

  next() {
    this.play(this._index + 1);
  }

  prev() {
    this.play(this._index - 1);
  }

  dispose() {
    this.stop();
    disconnectNode(this.gain);
  }
}
