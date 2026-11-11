/**
 * NCL — úlohy, kterými hráč prochází (analogie NCL marketplace).
 *
 * V Rustu je NCL trh s výpočtem: `V31/L3/ncl` má `NclTaskType`
 * (`llm_inference`, `image_generation`, `model_training`, `embeddings`,
 * `code_analysis`, `custom`) a reputaci
 * `score = base × success_rate × (1 + consciousness_level × 0,05)`.
 *
 * Nirvana používá **stejnou taxonomii a stejný vzorec**, ale na hráče:
 * úloha je herní cíl („dohraj hru", „projdi šest světů", „daruj světlo"),
 * typ jen říká, do které rodiny úloha patří. Není to výpočet a nikde to
 * netvrdí — je to **kurikulum**, kterým hráč projde, než se dostane výš.
 *
 * `score` v Nirvaně = `(splněné / všechny) × 100 × (1 + CL × 0,05)`,
 * zaclampované na 0–100 (stejné jako `ReputationRecord::score`).
 */

import type { Localized } from '@/core/i18n';
import type { ParkGameId } from '@/core/park/games';
import type { ParkProfile } from '@/core/park/profile';
import { clFromXp } from './consciousness';

/** Typy úloh — zrcadlí `NclTaskType` v `V31/L3/ncl/src/types.rs`. */
export type NclTaskType = 'llm_inference' | 'image_generation' | 'model_training' | 'embeddings' | 'code_analysis' | 'custom';

export const NCL_TASK_TYPES: NclTaskType[] = [
  'llm_inference',
  'image_generation',
  'model_training',
  'embeddings',
  'code_analysis',
  'custom',
];

/** Co musí hráč splnit. Deklarativní, aby to šlo testovat bez UI. */
export type NclGoal =
  | { kind: 'runs'; count: number }
  | { kind: 'worlds'; count: number }
  | { kind: 'completions'; count: number }
  | { kind: 'seals'; count: number }
  | { kind: 'gifts'; count: number }
  | { kind: 'best'; game: ParkGameId; score: number };

export interface NclTask {
  id: string;
  type: NclTaskType;
  title: Localized;
  detail: Localized;
  goal: NclGoal;
  /** Kolik XP úloha dá ve chvíli splnění. */
  xp: number;
}

/**
 * Kurikulum: od „vůbec jsi přišel" po „prošel jsi celý systém".
 * Pořadí je záměrně od nejmenšího kroku — hráč má vidět, že první úloha
 * je na dosah, ne že ho čeká stěna.
 */
export const NCL_TASKS: NclTask[] = [
  {
    id: 'first-light',
    type: 'custom',
    title: { cs: 'První světlo', en: 'First light', es: 'Primera luz' },
    detail: { cs: 'Dohraj jednu hru v kterémkoli světě.', en: 'Finish one game in any world.', es: 'Termina una partida en cualquier mundo.' },
    goal: { kind: 'runs', count: 1 },
    xp: 40,
  },
  {
    id: 'two-worlds',
    type: 'embeddings',
    title: { cs: 'Dva světy', en: 'Two worlds', es: 'Dos mundos' },
    detail: { cs: 'Zahraj si ve dvou různých světech.', en: 'Play in two different worlds.', es: 'Juega en dos mundos distintos.' },
    goal: { kind: 'worlds', count: 2 },
    xp: 60,
  },
  {
    id: 'carry-through',
    type: 'llm_inference',
    title: { cs: 'Dotočit do konce', en: 'Carry it through', es: 'Llevarlo hasta el final' },
    detail: { cs: 'Dokonči hru, která má konec (dno, srdce, cíl, výhra).', en: 'Complete a game that has an ending (bottom, heart, finish, win).', es: 'Completa una partida con final (fondo, corazón, meta, victoria).' },
    goal: { kind: 'completions', count: 1 },
    xp: 60,
  },
  {
    id: 'first-seal',
    type: 'custom',
    title: { cs: 'První pečeť', en: 'First seal', es: 'Primer sello' },
    detail: { cs: 'Projdi dharma validací na pečeť.', en: 'Pass the dharma validation for a seal.', es: 'Supera la validación del dharma para un sello.' },
    goal: { kind: 'seals', count: 1 },
    xp: 80,
  },
  {
    id: 'four-worlds',
    type: 'code_analysis',
    title: { cs: 'Čtyři světy', en: 'Four worlds', es: 'Cuatro mundos' },
    detail: { cs: 'Projdi čtyři různé světy.', en: 'Walk through four different worlds.', es: 'Recorre cuatro mundos distintos.' },
    goal: { kind: 'worlds', count: 4 },
    xp: 90,
  },
  {
    id: 'seven-lights',
    type: 'image_generation',
    title: { cs: 'Sedm světel', en: 'Seven lights', es: 'Siete luces' },
    detail: { cs: 'Dones všech sedm světel s Lumi (skóre 900+).', en: 'Carry all seven lights with Lumi (score 900+).', es: 'Lleva las siete luces con Lumi (puntuación 900+).' },
    goal: { kind: 'best', game: 'lumi', score: 900 },
    xp: 90,
  },
  {
    id: 'to-the-bottom',
    type: 'model_training',
    title: { cs: 'Až na dno', en: 'To the bottom', es: 'Hasta el fondo' },
    detail: { cs: 'Dolet na dno Hlubiny (900 m).', en: 'Reach the bottom of the Deep (900 m).', es: 'Llega al fondo de la Profundidad (900 m).' },
    goal: { kind: 'best', game: 'neptune', score: 900 },
    xp: 90,
  },
  {
    id: 'nine-lamps',
    type: 'custom',
    title: { cs: 'Devět lamp', en: 'Nine lamps', es: 'Nueve lámparas' },
    detail: { cs: 'Rozsviť celé Srdce na okraji (skóre 900+).', en: 'Light the whole Heart at the Edge (score 900+).', es: 'Enciende todo el Corazón en el Borde (puntuación 900+).' },
    goal: { kind: 'best', game: 'pluto', score: 900 },
    xp: 90,
  },
  {
    id: 'give-a-light',
    type: 'custom',
    title: { cs: 'Daruj světlo', en: 'Give a light', es: 'Regala una luz' },
    detail: { cs: 'Daruj světlo druhému letci v Lumi.', en: 'Give a light to another flyer in Lumi.', es: 'Regala una luz a otro volador en Lumi.' },
    goal: { kind: 'gifts', count: 1 },
    xp: 100,
  },
  {
    id: 'six-worlds',
    type: 'embeddings',
    title: { cs: 'Šest světů', en: 'Six worlds', es: 'Seis mundos' },
    detail: { cs: 'Projdi šest různých světů.', en: 'Walk through six different worlds.', es: 'Recorre seis mundos distintos.' },
    goal: { kind: 'worlds', count: 6 },
    xp: 120,
  },
  {
    id: 'three-seals',
    type: 'custom',
    title: { cs: 'Tři pečeti', en: 'Three seals', es: 'Tres sellos' },
    detail: { cs: 'Získej tři dharma pečeti.', en: 'Earn three dharma seals.', es: 'Gana tres sellos de dharma.' },
    goal: { kind: 'seals', count: 3 },
    xp: 150,
  },
  {
    id: 'the-whole-system',
    type: 'code_analysis',
    title: { cs: 'Celý systém', en: 'The whole system', es: 'Todo el sistema' },
    detail: { cs: 'Zahraj si ve dvanácti různých světech.', en: 'Play in twelve different worlds.', es: 'Juega en doce mundos distintos.' },
    goal: { kind: 'worlds', count: 12 },
    xp: 250,
  },
];

export interface NclTaskState {
  task: NclTask;
  done: boolean;
  /** 0..1 */
  progress: number;
  current: number;
  target: number;
}

/** Kolik toho hráč v daném cíli už má (jedno místo pro všechny druhy). */
export function goalProgress(goal: NclGoal, profile: ParkProfile): number {
  const plays = profile.plays ?? {};
  switch (goal.kind) {
    case 'runs':
      return profile.runs;
    case 'worlds':
      return Object.values(plays).filter((count) => (count ?? 0) > 0).length;
    case 'completions':
      return profile.completions ?? 0;
    case 'seals':
      return profile.dharma?.seals ?? 0;
    case 'gifts':
      return profile.gifts ?? 0;
    case 'best':
      return profile.best?.[goal.game] ?? 0;
    default:
      return 0;
  }
}

export function goalTarget(goal: NclGoal): number {
  return goal.kind === 'best' ? goal.score : goal.count;
}

/** Stav kurikula: splněné úlohy, skóre a první nesplněná. */
export interface NclState {
  tasks: NclTaskState[];
  done: string[];
  /** 0..100 — `(splněné / všechny) × 100 × (1 + CL × 0,05)`, clamp 0–100. */
  score: number;
  next: NclTask | null;
  /** Kolik úloh zbývá. */
  remaining: number;
}

export function nclState(profile: ParkProfile): NclState {
  const tasks = NCL_TASKS.map((task) => {
    const target = Math.max(1, goalTarget(task.goal));
    const current = Math.max(0, goalProgress(task.goal, profile));
    const done = current >= target;
    return { task, done, progress: Math.min(1, current / target), current, target };
  });
  const done = tasks.filter((entry) => entry.done).map((entry) => entry.task.id);
  const cl = clFromXp(profile.xp ?? 0);
  const ratio = tasks.length === 0 ? 0 : done.length / tasks.length;
  const score = Math.max(0, Math.min(100, Math.round(ratio * 100 * (1 + cl * 0.05))));
  const next = tasks.find((entry) => !entry.done)?.task ?? null;
  return { tasks, done, score, next, remaining: tasks.length - done.length };
}

/**
 * Které úlohy se právě splnily (pro `recordRun`) — vrací jen nové,
 * aby se XP za úlohu nedalo připsat dvakrát.
 */
export function newlyCompleted(profile: ParkProfile): NclTask[] {
  const state = nclState(profile);
  const before = new Set(profile.nclDone ?? []);
  return state.tasks.filter((entry) => entry.done && !before.has(entry.task.id)).map((entry) => entry.task);
}
