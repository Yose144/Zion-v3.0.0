/**
 * Test zvukového enginu — bez prohlížeče.
 *
 * Ověřuje tři věci, které se v UI poznají až po pár minutách hraní:
 *   1. **Kontext nevznikne dřív než po gestu** (prohlížeč by ho zablokoval).
 *   2. **Ztlumení opravdu vyrábí ticho** — ne jen jinou ikonu v HUD.
 *   3. **Throttling drží** — zásah 60×/s nesmí vytvořit 60 hlasů.
 *
 * Falešný `AudioContext` počítá vytvořené nody; nic nepřehrává. Spuštění:
 *   npx tsx apps/nirvana/test/audio.mjs
 */

let created = 0;
let contexts = 0;
/** Hodiny, které test posouvá — v prohlížeči je to skutečný čas kontextu. */
let clockMs = 0;

function makeParam() {
  return {
    value: 0,
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime() {},
  };
}

function makeNode(extra = {}) {
  created += 1;
  return {
    connect(target) {
      return target;
    },
    disconnect() {},
    ...extra,
  };
}

class FakeContext {
  sampleRate = 48000;
  state = 'running';
  destination = makeNode();

  constructor() {
    contexts += 1;
  }

  get currentTime() {
    return clockMs / 1000;
  }

  createGain() {
    return makeNode({ gain: makeParam() });
  }

  createOscillator() {
    return makeNode({ type: 'sine', frequency: makeParam(), start() {}, stop() {}, onended: null });
  }

  createBufferSource() {
    return makeNode({ buffer: null, start() {}, stop() {}, onended: null });
  }

  createBiquadFilter() {
    return makeNode({ type: 'lowpass', frequency: makeParam(), Q: makeParam() });
  }

  createBuffer(channels, length) {
    return { getChannelData: () => new Float32Array(length) };
  }

  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
}

const store = new Map();

globalThis.window = {
  AudioContext: FakeContext,
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
  },
};
globalThis.performance = { now: () => Date.now() };

const audio = await import('../src/core/audio/engine.ts');

let failures = 0;
function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  OK   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// 1) před gestem nic
check('před gestem nevznikl AudioContext', contexts === 0);

// 2) ztlumeno = ticho (i po unlocku)
audio.setMuted(true);
audio.unlock();
const quiet = created;
audio.play('rail');
check('ztlumený engine nevytvoří hlas', created === quiet, `nodů=${created - quiet}`);

// 3) odtlumeno = zvuk
audio.setMuted(false);
const before = created;
audio.play('rail');
const single = created - before;
check('odtlumený rail vytvoří hlasy', single > 0, `nodů=${single}`);

// 4) throttling stejného zvuku: 60 volání za 60 ms smí projít jen ~2×
clockMs += 500;
const burstStart = created;
for (let i = 0; i < 60; i += 1) audio.play('hit', 5000 + i);
const bursts = (created - burstStart) / single;
check('60 volání za 60 ms = nejvýš 3 zvuky', bursts <= 3, `zvuků=${bursts}`);

// 5) po uplynutí rozestupu hraje znovu
const beforeAgain = created;
audio.play('hit', 9000);
check('hit po pauze zahraje znovu', created > beforeAgain);

// 6) každé jméno má implementaci. Mezi zvuky posouváme hodiny, aby se
//    neuplatnil strop souběžných hlasů (v prohlížeči to dělá skutečný čas).
const names = [
  'rail', 'rocket', 'explosion', 'hit', 'mg', 'frag', 'hurt', 'pickup', 'death', 'matchEnd',
  'punch', 'kick', 'block', 'whiff', 'ko', 'bell', 'roundEnd', 'victory', 'defeat',
  'lap', 'wall', 'finish', 'countdown',
  'cannon', 'impact', 'turn',
  'paddle', 'brick', 'eat', 'lock', 'clear', 'shoot', 'target', 'ticket', 'over',
  'click', 'open', 'error',
];
let silent = 0;
clockMs += 20_000; // po předchozích razítkách, ať throttling nic nespolkne
for (const name of names) {
  clockMs += 1000;
  const mark = created;
  audio.play(name, clockMs);
  if (created === mark) silent += 1;
}
check(`${names.length} jmenovaných zvuků hraje`, silent === 0, `tichých=${silent}`);

// 7) strop hlasů: 200 zvuků ve stejný okamžik nesmí otevřít 200 hlasů
clockMs += 5000;
const flood = created;
for (let i = 0; i < 200; i += 1) audio.play('explosion', clockMs);
const floodVoices = (created - flood) / 4; // explosion = ~4 nody
check('200 zvuků naráz respektuje strop hlasů', floodVoices <= 24 + 4, `hlasů≈${Math.round(floodVoices)}`);

// 8) neznámé jméno nesmí shodit hru
let threw = false;
try {
  audio.play('neexistuje');
} catch {
  threw = true;
}
check('neznámý zvuk nic nerozbije', !threw);

// 9) spojitý motor
const engine = audio.startEngineLoop();
check('motor se otevře', engine !== null);
engine?.setIntensity(0.8);
engine?.stop();

// 10) volba ztlumení přežije „reload"
check('zapnutý zvuk se ukládá', store.get('nirvana.sound.v1') === 'on');
audio.setMuted(true);
check('vypnutý zvuk se ukládá', store.get('nirvana.sound.v1') === 'off');

console.log('');
if (failures > 0) {
  console.log(`AUDIO FAILED (${failures})`);
  process.exit(1);
}
console.log('AUDIO OK');
