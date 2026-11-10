/**
 * ZVUK NIRVANY — jeden syntetizér pro všechny hry.
 *
 * V repu není jediný zvukový soubor: každý zvuk je pár oscilátorů a kus šumu.
 * Díky tomu se stahuje nula kilobajtů, zvuk jde měnit číslem a nikde nevisí
 * licence na vzorky. Stejné pravidlo drží aréna, MOBA i pouť — tenhle modul
 * ho jen sjednocuje, aby každá hra neměla vlastní `AudioContext`.
 *
 * Tři pravidla, která se nesmí obejít:
 *  1. **Kontext až po gestu.** Prohlížeč jinak přehrávání zablokuje; `unlock()`
 *     se volá z kliku nebo prvního stisku klávesy.
 *  2. **Zvuk nikdy nerozhoduje o hře.** Hraje se z událostí, které už nastaly.
 *     Když WebAudio chybí nebo selže, hra běží dál.
 *  3. **Strop hlasitosti i počtu hlasů.** Zásah v aréně přichází 15×/s a tři
 *     boti střílí současně; bez stropu by se hromadily nody a zvuk by chrastil.
 *
 * Hlasitost a ztlumení se pamatují v `localStorage` (`nirvana.sound.v1`), takže
 * volba platí napříč hrami a přežije reload.
 */

// ── kontext ────────────────────────────────────────────────────────────────

let context: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let loaded = false;

/** Maximální počet souběžných hlasů. Víc už stejně nikdo nerozezná. */
const MAX_VOICES = 24;

/**
 * Aktivní hlasy jako časy konce v audio hodinách.
 *
 * Nespoléháme jen na `onended`: některé prohlížeče ho u zastaveného nodu
 * nespustí a čítač by se pak zasekl na maximu a zvuk by navždy ztichl.
 * Časové razítko je deterministické a testovatelné.
 */
let voiceEnds: number[] = [];

function takeVoice(duration: number): boolean {
  const ctx = context;
  if (!ctx) return false;
  const now = ctx.currentTime;
  if (voiceEnds.length > 0) voiceEnds = voiceEnds.filter((end) => end > now);
  if (voiceEnds.length >= MAX_VOICES) return false;
  voiceEnds.push(now + duration + 0.06);
  return true;
}

/** Minimální rozestup stejného zvuku v ms — brání chrastění při 60 fps. */
const MIN_GAP: Partial<Record<SoundName, number>> = {
  hit: 45,
  hurt: 120,
  mg: 55,
  punch: 60,
  turn: 120,
  wall: 160,
  impact: 80,
  brick: 35,
  eat: 40,
};

const lastPlayed = new Map<SoundName, number>();

const STORAGE_KEY = 'nirvana.sound.v1';
/** Hlasitost je samostatná volba (0–1); ztlumení zůstává přepínačem. */
const VOLUME_KEY = 'nirvana.volume.v1';

/** Základní zesílení sběrnice — hlasitost se násobí tímhle číslem. */
const MASTER_GAIN = 0.3;

let volume = 1;

function readPrefs(): void {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    muted = window.localStorage.getItem(STORAGE_KEY) === 'off';
  } catch {
    muted = false;
  }
  try {
    // Chybějící klíč NENÍ nula: `Number(null)` je 0, takže by se každému
    // novému hráči hlasitost nastavila na ticho (přesně to se stalo).
    const stored = window.localStorage.getItem(VOLUME_KEY);
    const raw = stored === null ? 1 : Number(stored);
    volume = Number.isFinite(raw) && raw >= 0 ? Math.min(1, raw) : 1;
  } catch {
    volume = 1;
  }
}

function writePrefs(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, muted ? 'off' : 'on');
    window.localStorage.setItem(VOLUME_KEY, String(volume));
  } catch {
    /* soukromý režim — volba prostě nepřežije reload */
  }
}

/** Jediné místo, kde se hlasitost opravdu propíše do sběrnice. */
function applyGain(): void {
  if (master && context) master.gain.value = muted ? 0 : MASTER_GAIN * volume;
}

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  readPrefs();
  if (!context) {
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = muted ? 0 : MASTER_GAIN * volume;
      master.connect(context.destination);
    } catch {
      return null;
    }
  }
  if (context.state === 'suspended') void context.resume();
  return context;
}

/** Otevři zvuk z gesta (klik / klávesa). Volej při vstupu do hry. */
export function unlock(): void {
  ensure();
}

/** Pro komponenty, které chtějí jen vědět, že se smí přehrávat. */
export function isReady(): boolean {
  return context !== null && context.state === 'running';
}

// ── ztlumení ───────────────────────────────────────────────────────────────

const muteListeners = new Set<(muted: boolean) => void>();
const volumeListeners = new Set<(volume: number) => void>();

export function isMuted(): boolean {
  readPrefs();
  return muted;
}

export function setMuted(next: boolean): void {
  readPrefs();
  muted = next;
  writePrefs();
  applyGain();
  for (const listener of muteListeners) listener(muted);
}

export function toggleMuted(): boolean {
  setMuted(!isMuted());
  return isMuted();
}

/** Odhlášení vrací unsubscribe — komponenta ho volá v cleanupu. */
export function subscribeMuted(listener: (muted: boolean) => void): () => void {
  muteListeners.add(listener);
  return () => muteListeners.delete(listener);
}

// ── hlasitost ──────────────────────────────────────────────────────────────

/** Hlasitost 0–1 (1 = plná, násobená základním zesílením sběrnice). */
export function getVolume(): number {
  readPrefs();
  return volume;
}

export function setVolume(next: number): number {
  readPrefs();
  volume = Number.isFinite(next) ? Math.min(1, Math.max(0, next)) : 1;
  // Posuvník na nule je stejně tichý jako ztlumení, ale NEpřepíná `muted` —
  // po vrácení nahoru se zvuk vrátí tam, kde byl.
  if (volume > 0 && muted) {
    muted = false;
  }
  writePrefs();
  applyGain();
  for (const listener of volumeListeners) listener(volume);
  if (muted === false) for (const listener of muteListeners) listener(muted);
  return volume;
}

export function subscribeVolume(listener: (volume: number) => void): () => void {
  volumeListeners.add(listener);
  return () => volumeListeners.delete(listener);
}

// ── primitiva ──────────────────────────────────────────────────────────────

export interface ToneOptions {
  freq: number;
  /** Konečná frekvence (glissando). */
  to?: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  /** Zpoždění startu v sekundách (plánuje se v audio čase, ne timerem). */
  delay?: number;
  /** Kolik z trvání zabere náběh; 0,012 = tupý úder, 0,05 = smyčec. */
  attack?: number;
}

function tone(options: ToneOptions): void {
  const ctx = ensure();
  if (!ctx || !master || muted) return;
  if (!takeVoice(options.duration + (options.delay ?? 0))) return;

  const start = ctx.currentTime + (options.delay ?? 0);
  const attack = Math.min(options.attack ?? 0.012, options.duration * 0.5);
  const peak = options.gain ?? 0.08;

  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = options.type ?? 'sine';
  osc.frequency.setValueAtTime(Math.max(20, options.freq), start);
  if (options.to) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, options.to), start + options.duration);
  }
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + options.duration);

  osc.connect(amp).connect(master);
  osc.start(start);
  osc.stop(start + options.duration + 0.02);

  osc.onended = () => {
    osc.disconnect();
    amp.disconnect();
  };
}

export interface NoiseOptions {
  duration: number;
  gain?: number;
  cutoff?: number;
  type?: BiquadFilterType;
  delay?: number;
  /** Útlumové křivky: 1 = lineární, 2 = rychlý náběh a dlouhý dozvuk. */
  shape?: number;
}

function noise(options: NoiseOptions): void {
  const ctx = ensure();
  if (!ctx || !master || muted) return;
  if (!takeVoice(options.duration + (options.delay ?? 0))) return;

  const start = ctx.currentTime + (options.delay ?? 0);
  const length = Math.max(1, Math.floor(ctx.sampleRate * options.duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const shape = options.shape ?? 2;
  for (let index = 0; index < length; index += 1) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / length) ** shape;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = options.type ?? 'lowpass';
  filter.frequency.value = options.cutoff ?? 1200;

  const amp = ctx.createGain();
  amp.gain.value = options.gain ?? 0.05;

  source.connect(filter).connect(amp).connect(master);
  source.start(start);

  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    amp.disconnect();
  };
}

// ── slovníček zvuků ────────────────────────────────────────────────────────

export type SoundName =
  // aréna (Mars)
  | 'rail'
  | 'rocket'
  | 'explosion'
  | 'hit'
  | 'mg'
  | 'frag'
  | 'hurt'
  | 'pickup'
  | 'death'
  | 'matchEnd'
  // souboj (Merkur)
  | 'punch'
  | 'kick'
  | 'block'
  | 'whiff'
  | 'ko'
  | 'bell'
  | 'roundEnd'
  | 'victory'
  | 'defeat'
  // závod (Venuše)
  | 'lap'
  | 'wall'
  | 'finish'
  | 'countdown'
  // tanky (Saturn)
  | 'cannon'
  | 'impact'
  | 'turn'
  // pouť (Jupiter)
  | 'paddle'
  | 'brick'
  | 'eat'
  | 'lock'
  | 'clear'
  | 'shoot'
  | 'target'
  | 'ticket'
  | 'over'
  // Lumi (Uran — světlo a cesty)
  | 'lanternIgnite'
  | 'lightPickup'
  | 'gust'
  | 'shrineOpen'
  | 'gift'
  // rozhraní
  | 'click'
  | 'open'
  | 'error';

type Voice = () => void;

/** Krátký tón jako „blip" — používá se na UI a arkádové hity. */
function blip(freq: number, duration = 0.08, gain = 0.1, type: OscillatorType = 'square'): void {
  tone({ freq, to: freq * 1.6, duration, type, gain });
}

/** Tupý úder: nízký tón + krátký šum. Tělo zásahu. */
function thud(freq: number, gain = 0.12, duration = 0.14, cutoff = 700): void {
  tone({ freq, to: freq * 0.55, duration, type: 'triangle', gain });
  noise({ duration: duration * 0.8, gain: gain * 0.5, cutoff });
}

/** Kovové cvaknutí — blok, náraz do zdi, dopad střely. */
function clank(freq = 1800, gain = 0.06): void {
  tone({ freq, to: freq * 0.7, duration: 0.07, type: 'square', gain });
  noise({ duration: 0.05, gain: gain * 0.6, cutoff: 4200, type: 'highpass' });
}

/** Výbuch: dlouhý šum s nízkým filtrem a klesající tón. */
function boom(gain = 0.16, duration = 0.55): void {
  noise({ duration, gain, cutoff: 420 });
  tone({ freq: 72, to: 34, duration: duration * 0.9, type: 'triangle', gain: gain * 0.6 });
}

/** Zvonek / gong — kola, kapitoly, vstup do místnosti. */
function chime(freqs: number[], gain = 0.07, step = 0.09, duration = 0.3): void {
  freqs.forEach((freq, index) => {
    tone({ freq, duration, type: 'sine', gain, delay: index * step });
  });
}

/** Stoupající nebo klesající stupnice — konec hry. */
function scale(freqs: number[], gain = 0.075, step = 0.14, duration = 0.32): void {
  freqs.forEach((freq, index) => {
    tone({ freq, duration, type: 'triangle', gain, delay: index * step });
  });
}

const SOUNDS: Record<SoundName, Voice> = {
  // ── aréna ────────────────────────────────────────────────────────────
  rail: () => {
    tone({ freq: 1800, to: 220, duration: 0.18, type: 'sawtooth', gain: 0.14 });
    noise({ duration: 0.12, gain: 0.1, cutoff: 5200, type: 'highpass' });
  },
  rocket: () => {
    tone({ freq: 120, to: 60, duration: 0.22, type: 'square', gain: 0.16 });
    noise({ duration: 0.35, gain: 0.08, cutoff: 1200 });
  },
  explosion: () => boom(0.2, 0.6),
  hit: () => clank(2400, 0.08),
  mg: () => {
    tone({ freq: 1500, to: 900, duration: 0.05, type: 'square', gain: 0.1 });
    tone({ freq: 1400, to: 850, duration: 0.05, type: 'square', gain: 0.09, delay: 0.045 });
    noise({ duration: 0.06, gain: 0.04, cutoff: 2600, type: 'highpass' });
  },
  frag: () => chime([660, 440, 220], 0.1, 0.09, 0.2),
  hurt: () => {
    tone({ freq: 220, to: 120, duration: 0.12, type: 'sawtooth', gain: 0.1 });
    noise({ duration: 0.1, gain: 0.06, cutoff: 800 });
  },
  pickup: () => tone({ freq: 880, to: 1320, duration: 0.09, type: 'sine', gain: 0.08 }),
  death: () => {
    tone({ freq: 300, to: 80, duration: 0.5, type: 'sawtooth', gain: 0.11 });
    noise({ duration: 0.4, gain: 0.08, cutoff: 600 });
  },
  matchEnd: () => chime([523, 659, 784], 0.09, 0.16, 0.3),

  // ── souboj (Merkur) ──────────────────────────────────────────────────
  punch: () => {
    thud(150, 0.13, 0.11, 900);
    noise({ duration: 0.05, gain: 0.05, cutoff: 1800, type: 'bandpass' });
  },
  kick: () => {
    thud(95, 0.17, 0.18, 600);
    noise({ duration: 0.08, gain: 0.07, cutoff: 1200 });
  },
  block: () => clank(1200, 0.09),
  whiff: () => noise({ duration: 0.14, gain: 0.05, cutoff: 2400, type: 'bandpass' }),
  ko: () => {
    boom(0.2, 0.7);
    tone({ freq: 260, to: 60, duration: 0.6, type: 'sawtooth', gain: 0.1 });
  },
  bell: () => chime([784, 1175], 0.09, 0.02, 0.5),
  roundEnd: () => chime([660, 440], 0.09, 0.12, 0.32),
  victory: () => scale([523, 659, 784, 1046], 0.08, 0.13, 0.34),
  defeat: () => scale([392, 330, 262, 196], 0.08, 0.15, 0.4),

  // ── závod (Venuše) ───────────────────────────────────────────────────
  lap: () => chime([880, 1320], 0.09, 0.07, 0.18),
  wall: () => {
    noise({ duration: 0.18, gain: 0.09, cutoff: 900 });
    thud(110, 0.1, 0.12, 500);
  },
  finish: () => scale([659, 784, 988, 1318], 0.09, 0.12, 0.5),
  countdown: () => tone({ freq: 660, duration: 0.12, type: 'square', gain: 0.08 }),

  // ── tanky (Saturn) ───────────────────────────────────────────────────
  cannon: () => {
    tone({ freq: 90, to: 45, duration: 0.3, type: 'square', gain: 0.18 });
    noise({ duration: 0.4, gain: 0.12, cutoff: 1000 });
  },
  impact: () => boom(0.16, 0.45),
  turn: () => blip(520, 0.05, 0.05, 'sine'),

  // ── pouť (Jupiter) ───────────────────────────────────────────────────
  paddle: () => blip(440, 0.06, 0.09, 'square'),
  brick: () => blip(880, 0.045, 0.07, 'square'),
  eat: () => blip(700, 0.05, 0.07, 'triangle'),
  lock: () => thud(180, 0.07, 0.07, 700),
  clear: () => chime([784, 1046, 1318], 0.07, 0.06, 0.18),
  shoot: () => {
    tone({ freq: 1200, to: 400, duration: 0.08, type: 'sawtooth', gain: 0.09 });
    noise({ duration: 0.05, gain: 0.05, cutoff: 3000, type: 'highpass' });
  },
  target: () => chime([1046, 1568], 0.08, 0.05, 0.16),
  ticket: () => chime([880, 1108, 1320], 0.08, 0.07, 0.24),
  over: () => scale([440, 370, 294, 220], 0.075, 0.13, 0.34),

  // ── Lumi ─────────────────────────────────────────────────────────────
  // Zapálení lucerny: teplý nádech, ne klik.
  lanternIgnite: () => {
    chime([392, 523, 659], 0.06, 0.06, 0.5);
    noise({ duration: 0.5, gain: 0.05, cutoff: 900 });
  },
  // Světlo: krátký zvonivý tón. Výšku určuje stránka podle pořadí (viz `playNote`).
  lightPickup: () => chime([1046, 1568], 0.07, 0.05, 0.25),
  // Proud vzduchu: tichý nádech větru.
  gust: () => noise({ duration: 0.9, gain: 0.06, cutoff: 1400, type: 'bandpass' }),
  // Svatyně se otevřela: hluboký souzvuk, ne fanfára.
  shrineOpen: () => chime([262, 392, 523, 784], 0.07, 0.14, 0.9),
  // Darování: teplý zvon, který dozní.
  gift: () => {
    chime([659, 880, 1318], 0.075, 0.1, 0.8);
    noise({ duration: 0.6, gain: 0.03, cutoff: 700 });
  },

  // ── rozhraní ─────────────────────────────────────────────────────────
  click: () => tone({ freq: 620, to: 820, duration: 0.045, type: 'sine', gain: 0.05 }),
  open: () => chime([587, 880], 0.06, 0.06, 0.2),
  error: () => {
    tone({ freq: 220, duration: 0.12, type: 'square', gain: 0.07 });
    tone({ freq: 180, duration: 0.16, type: 'square', gain: 0.07, delay: 0.1 });
  },
};

/**
 * Zahraj zvuk podle jména. Neznámé jméno nic nedělá (typová ochrana je
 * v `SoundName`, ale data ze serveru přicházejí jako string).
 *
 * `now` je volitelný čas v ms — používá se pro rozestup stejného zvuku.
 * V `useFrame` se předává `performance.now()`, aby throttling nezávisel na
 * tom, kolik zvuků se přehrálo jinde.
 */
export function play(name: SoundName, now = 0): void {
  const sound = SOUNDS[name];
  if (!sound) return;
  if (muted) return;
  const stamp = now || (typeof performance === 'undefined' ? 0 : performance.now());
  const gap = MIN_GAP[name];
  if (gap) {
    const last = lastPlayed.get(name) ?? -Infinity;
    if (stamp - last < gap) return;
    lastPlayed.set(name, stamp);
  }
  sound();
}

/**
 * Volný tón pro zvuky, které nejdou pojmenovat předem (např. kouzlo obarvené
 * postavou). Drží stejný kontext i strop hlasů jako `play()` — nikdo si
 * nesmí vytvořit vlastní `AudioContext`.
 */
export function playTone(options: ToneOptions): void {
  tone(options);
}

/** Volný šum — stejná pravidla jako `playTone`. */
export function playNoise(options: NoiseOptions): void {
  noise(options);
}

// ── spojité zvuky (motor, ambient) ─────────────────────────────────────────

/** Vítr ve Křídlech/Lumi: jemný šum s pomalým dýcháním. */
export function startWindLoop(): LoopHandle | null {
  const ctx = ensure();
  if (!ctx || !master || muted) return null;
  try {
    const length = Math.max(1, Math.floor(ctx.sampleRate * 2));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      // růžový šum: integrace bílého — zní jako vzduch, ne jako televize
      last = 0.985 * last + 0.015 * white;
      data[i] = last * 2.4;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 620;
    filter.Q.value = 0.6;

    const amp = ctx.createGain();
    amp.gain.value = 0.0001;

    // pomalé dýchání větru: LFO na frekvenci filtru
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    source.start();
    source.connect(filter).connect(amp).connect(master);
    amp.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 1.2);

    let stopped = false;
    return {
      setIntensity(value: number) {
        if (stopped) return;
        const clamped = Math.max(0, Math.min(1, value));
        amp.gain.setTargetAtTime(0.045 + clamped * 0.05, ctx.currentTime, 0.25);
        lfo.frequency.setTargetAtTime(0.06 + clamped * 0.12, ctx.currentTime, 0.4);
      },
      stop() {
        if (stopped) return;
        stopped = true;
        amp.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15);
        window.setTimeout(() => {
          try {
            source.stop();
            lfo.stop();
          } catch {
            /* už zastaveno */
          }
          source.disconnect();
          filter.disconnect();
          amp.disconnect();
          lfo.disconnect();
          lfoGain.disconnect();
        }, 500);
      },
    };
  } catch {
    return null;
  }
}

export interface LoopHandle {
  /** 0..1 — plyn, rychlost, intenzita. */
  setIntensity: (value: number) => void;
  stop: () => void;
}

/**
 * Motor hovercraftu: dva pilové oscilátory přes dolní propust. Výška a jas
 * jdou s rychlostí, takže hráč slyší, jak zrychluje, aniž by koukal na HUD.
 *
 * Spojitý zvuk drží vlastní nody mimo `tone()` — kdyby se každý frame
 * vytvářel nový, WebAudio by se udusil. Kdo ho používá, musí zavolat `stop()`
 * v cleanupu (jinak hučí i po odchodu ze závodu).
 */
export function startEngineLoop(): LoopHandle | null {
  const ctx = ensure();
  if (!ctx || !master || muted) return null;
  try {
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();

    osc.type = 'sawtooth';
    sub.type = 'triangle';
    osc.frequency.value = 70;
    sub.frequency.value = 35;
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 3;
    amp.gain.value = 0.0001;

    osc.connect(filter);
    sub.connect(filter);
    filter.connect(amp).connect(master);
    osc.start();
    sub.start();
    amp.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.4);

    let stopped = false;
    return {
      setIntensity(value: number) {
        if (stopped) return;
        const clamped = Math.max(0, Math.min(1, value));
        const now = ctx.currentTime;
        osc.frequency.setTargetAtTime(70 + clamped * 120, now, 0.08);
        sub.frequency.setTargetAtTime(35 + clamped * 55, now, 0.08);
        filter.frequency.setTargetAtTime(380 + clamped * 900, now, 0.1);
        amp.gain.setTargetAtTime(0.03 + clamped * 0.05, now, 0.12);
      },
      stop() {
        if (stopped) return;
        stopped = true;
        amp.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08);
        window.setTimeout(() => {
          try {
            osc.stop();
            sub.stop();
          } catch {
            /* už zastaveno */
          }
          osc.disconnect();
          sub.disconnect();
          filter.disconnect();
          amp.disconnect();
        }, 320);
      },
    };
  } catch {
    return null;
  }
}
