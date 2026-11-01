/**
 * Zvuk arény — syntéza, ne soubory.
 *
 * WebAudio umí rail, raketu, explozi i zásah vyrobit z pár oscilátorů a šumu.
 * Díky tomu není v repu ani jeden zvukový asset a stahuje se nula kilobajtů.
 * Kontext se otevírá až po prvním gestu (prohlížeče jinak blokují přehrávání).
 */

let context: AudioContext | null = null;
let master: GainNode | null = null;

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!context) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
    master = context.createGain();
    master.gain.value = 0.22;
    master.connect(context.destination);
  }
  if (context.state === 'suspended') void context.resume();
  return context;
}

/** Volat z gesta (klik / vstup do arény), aby prohlížeč dovolil zvuk. */
export function unlockAudio(): void {
  ensure();
}

function noiseBuffer(seconds: number): AudioBuffer | null {
  const ctx = ensure();
  if (!ctx) return null;
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function noise(duration: number, gain: number, filterHz: number, type: BiquadFilterType = 'lowpass'): void {
  const ctx = ensure();
  if (!ctx || !master) return;
  const buffer = noiseBuffer(duration);
  if (!buffer) return;

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = filterHz;

  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(gain, ctx.currentTime);
  envelope.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

  source.connect(filter).connect(envelope).connect(master);
  source.start();
  source.stop(ctx.currentTime + duration);
}

function tone(
  frequency: number,
  duration: number,
  gain: number,
  type: OscillatorType = 'sine',
  slideTo?: number,
): void {
  const ctx = ensure();
  if (!ctx || !master) return;
  const oscillator = ctx.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
  if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);

  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(gain, ctx.currentTime);
  envelope.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

  oscillator.connect(envelope).connect(master);
  oscillator.start();
  oscillator.stop(ctx.currentTime + duration);
}

/** Rail: krátký sykot s klesajícím tónem. */
export function playRail(): void {
  tone(1800, 0.18, 0.5, 'sawtooth', 220);
  noise(0.12, 0.35, 5200, 'highpass');
}

/** Raketa: tupý výstřel + syčení. */
export function playRocket(): void {
  tone(120, 0.22, 0.6, 'square', 60);
  noise(0.35, 0.25, 1200);
}

/** Exploze: šum s nízkým filtrem a dlouhým dozvukem. */
export function playExplosion(): void {
  noise(0.6, 0.75, 420);
  tone(70, 0.5, 0.4, 'triangle', 38);
}

/** Zásah: krátké cvaknutí ve vysoké poloze. */
export function playHit(): void {
  tone(2400, 0.06, 0.35, 'square', 1600);
}

/** Strojní puška: krátká dávka — tři cvaknutí pod sebou. */
export function playMg(): void {
  tone(1500, 0.05, 0.3, 'square', 900);
  window.setTimeout(() => tone(1400, 0.05, 0.28, 'square', 850), 45);
  noise(0.06, 0.12, 2600, 'highpass');
}

/** Zabití bota: dva tóny dolů. */
export function playFrag(): void {
  tone(660, 0.1, 0.4, 'sine', 440);
  window.setTimeout(() => tone(440, 0.16, 0.35, 'sine', 220), 90);
}

/** Hráč dostal zásah. */
export function playHurt(): void {
  tone(220, 0.12, 0.3, 'sawtooth', 120);
  noise(0.1, 0.2, 800);
}

/** Pickup: stoupající ping. */
export function playPickup(): void {
  tone(880, 0.09, 0.25, 'sine', 1320);
}

/** Smrt hráče. */
export function playDeath(): void {
  tone(300, 0.5, 0.4, 'sawtooth', 80);
  noise(0.4, 0.3, 600);
}

/** Konec zápasu. */
export function playMatchEnd(): void {
  tone(523, 0.18, 0.35);
  window.setTimeout(() => tone(659, 0.18, 0.35), 160);
  window.setTimeout(() => tone(784, 0.3, 0.35), 320);
}
