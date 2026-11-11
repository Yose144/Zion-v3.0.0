/**
 * QUESTY — připraveno pro OASIS, v Nirvaně zatím jen data.
 *
 * Zadání 👤: „příprava pro questy, ale to dáme až do OASIS … ale jako první
 * svět by měla Nirvana obsahovat všechno, co půjde pak do OASIS."
 *
 * Proto je tenhle soubor **kontrakt, ne UI**: quest je posloupnost kroků
 * (`NclGoal` — stejný typ, jaký používají NCL úlohy), má minimální CL
 * a odměnu. Až se questy v OASIS zapnou, tenhle soubor se zkopíruje
 * (nebo naimportuje) a nic se nepřepisuje. `ready: false` znamená
 * „v Nirvaně se jen vypisuje jako Připravujeme" — hráč nemá vidět
 * tlačítko, které nic nedělá.
 */

import type { Localized } from '@/core/i18n';
import type { NclGoal } from './ncl';

export interface QuestStep {
  id: string;
  text: Localized;
  goal: NclGoal;
}

export interface Quest {
  id: string;
  title: Localized;
  note: Localized;
  /** Minimální CL (0–6), od kterého má quest smysl. */
  cl: number;
  steps: QuestStep[];
  reward: { xp: number; tokens: number };
  /** `false` = připraveno pro OASIS, v Nirvaně se jen vypisuje. */
  ready: boolean;
}

export const QUESTS: Quest[] = [
  {
    id: 'first-road',
    title: { cs: 'První cesta', en: 'The First Road', es: 'El Primer Camino' },
    note: {
      cs: 'Nejmenší quest, který jde splnit: jeden dohraný běh a dva světy.',
      en: 'The smallest completable quest: one finished run and two worlds.',
      es: 'La misión más pequeña que se puede completar: una partida y dos mundos.',
    },
    cl: 1,
    steps: [
      { id: 'run', text: { cs: 'Dohraj jednu hru', en: 'Finish one game', es: 'Termina una partida' }, goal: { kind: 'runs', count: 1 } },
      { id: 'worlds', text: { cs: 'Projdi dva světy', en: 'Walk two worlds', es: 'Recorre dos mundos' }, goal: { kind: 'worlds', count: 2 } },
    ],
    reward: { xp: 120, tokens: 2 },
    ready: false,
  },
  {
    id: 'light-and-dark',
    title: { cs: 'Světlo a tma', en: 'Light and Dark', es: 'Luz y Oscuridad' },
    note: {
      cs: 'Tři světy, tři živly: světlo (Lumi), hloubka (Neptun), chlad (Pluto).',
      en: 'Three worlds, three elements: light (Lumi), depth (Neptune), cold (Pluto).',
      es: 'Tres mundos, tres elementos: luz (Lumi), profundidad (Neptuno), frío (Plutón).',
    },
    cl: 2,
    steps: [
      {
        id: 'lumi',
        text: { cs: 'Dones všech sedm světel', en: 'Carry all seven lights', es: 'Lleva las siete luces' },
        goal: { kind: 'best', game: 'lumi', score: 900 },
      },
      {
        id: 'neptune',
        text: { cs: 'Dolet na dno Hlubiny', en: 'Reach the bottom of the Deep', es: 'Llega al fondo de la Profundidad' },
        goal: { kind: 'best', game: 'neptune', score: 900 },
      },
      {
        id: 'pluto',
        text: { cs: 'Rozsviť Srdce na okraji', en: 'Light the Heart at the Edge', es: 'Enciende el Corazón en el Borde' },
        goal: { kind: 'best', game: 'pluto', score: 900 },
      },
    ],
    reward: { xp: 300, tokens: 4 },
    ready: false,
  },
  {
    id: 'heart-of-the-system',
    title: { cs: 'Srdce soustavy', en: 'Heart of the System', es: 'Corazón del Sistema' },
    note: {
      cs: 'Pečeti, ne body: quest chce čisté běhy napříč světy.',
      en: 'Seals, not points: the quest wants clean runs across the worlds.',
      es: 'Sellos, no puntos: la misión pide partidas limpias por los mundos.',
    },
    cl: 3,
    steps: [
      { id: 'seals', text: { cs: 'Získej tři pečeti', en: 'Earn three seals', es: 'Gana tres sellos' }, goal: { kind: 'seals', count: 3 } },
      { id: 'worlds', text: { cs: 'Projdi šest světů', en: 'Walk six worlds', es: 'Recorre seis mundos' }, goal: { kind: 'worlds', count: 6 } },
    ],
    reward: { xp: 500, tokens: 6 },
    ready: false,
  },
  {
    id: 'keeper-of-the-threshold',
    title: { cs: 'Strážce prahu', en: 'Keeper of the Threshold', es: 'Guardián del Umbral' },
    note: {
      cs: 'Poslední připravený quest: celý systém a pět pečetí.',
      en: 'The last prepared quest: the whole system and five seals.',
      es: 'La última misión preparada: todo el sistema y cinco sellos.',
    },
    cl: 4,
    steps: [
      { id: 'worlds', text: { cs: 'Projdi dvanáct světů', en: 'Walk twelve worlds', es: 'Recorre doce mundos' }, goal: { kind: 'worlds', count: 12 } },
      { id: 'seals', text: { cs: 'Získej pět pečetí', en: 'Earn five seals', es: 'Gana cinco sellos' }, goal: { kind: 'seals', count: 5 } },
    ],
    reward: { xp: 900, tokens: 10 },
    ready: false,
  },
];

/** Questy, které se v Nirvaně jen vypisují jako „připravujeme". */
export function preparedQuests(): Quest[] {
  return QUESTS.filter((quest) => !quest.ready);
}
