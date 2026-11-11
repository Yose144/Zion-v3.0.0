/**
 * DHARMA VALIDATOR — pět pilířů, kterými Nirvana hodnotí dohranou hru.
 *
 * Předloha není herní: v `PoC-lab/poc-verifier` je `DharmaValidator`
 * s pěti testy nad care proofem (Non-harm, Authenticity, Benefit,
 * Consciousness-alignment, Temporal-coherence). Tady se stejná pětice
 * aplikuje na **herní běh** — ne na to, jak jsi dobrý, ale na to, jak
 * hra proběhla: neodešel jsi, hra byla skutečná, něco přinesla, prošel
 * jsi svět a čas dával smysl.
 *
 * Je to **validace, ne trest**: pilíře jen násobí XP (0–50 %) a dávají
 * pečeť. Žádné odečítání, žádné banování — hráč, který si zahraje špatně,
 * má pořád stejné skóre i žetony.
 */

import type { Localized } from '@/core/i18n';

export type DharmaPillarId = 'ahimsa' | 'satya' | 'hita' | 'smriti' | 'kala';

export interface DharmaPillar {
  id: DharmaPillarId;
  /** Jméno v sanskrtu + co znamená. */
  name: Localized;
  /** Otázka, na kterou pilíř odpovídá (do panelu, ne do logu). */
  question: Localized;
  /** Váha v součtu (dohromady 100). */
  weight: number;
}

export const DHARMA_PILLARS: DharmaPillar[] = [
  {
    id: 'ahimsa',
    name: { cs: 'Ahiṃsā — neubližovat', en: 'Ahiṃsā — non-harm', es: 'Ahiṃsā — no dañar' },
    question: {
      cs: 'Nevzdal jsi běh a neopakoval jsi vlastní pád?',
      en: 'Did you stay in the run and not repeat your own fall?',
      es: '¿Seguiste en la partida sin repetir tu propia caída?',
    },
    weight: 20,
  },
  {
    id: 'satya',
    name: { cs: 'Satya — pravda', en: 'Satya — truth', es: 'Satya — verdad' },
    question: {
      cs: 'Byl běh skutečný, nebo to bylo dvě vteřiny pro body?',
      en: 'Was the run real, or two seconds for the points?',
      es: '¿Fue una partida real o dos segundos por los puntos?',
    },
    weight: 20,
  },
  {
    id: 'hita',
    name: { cs: 'Hita — prospěch', en: 'Hita — benefit', es: 'Hita — beneficio' },
    question: {
      cs: 'Přinesla hra něco — cíl, dno, kurz, vítězství?',
      en: 'Did the run bring something — a goal, the bottom, the finish, a win?',
      es: '¿Aportó algo: meta, fondo, meta de carrera, victoria?',
    },
    weight: 20,
  },
  {
    id: 'smriti',
    name: { cs: 'Smṛti — bdělost', en: 'Smṛti — mindfulness', es: 'Smṛti — atención' },
    question: {
      cs: 'Prošel jsi svět, nebo jsi jen stál? Dal jsi něco druhým?',
      en: 'Did you walk the world, or just stand? Did you give something to others?',
      es: '¿Recorriste el mundo o solo estabas? ¿Diste algo a los demás?',
    },
    weight: 20,
  },
  {
    id: 'kala',
    name: { cs: 'Kāla — čas', en: 'Kāla — time', es: 'Kāla — tiempo' },
    question: {
      cs: 'Dával čas smysl — ne pět vteřin a ne půl hodiny?',
      en: 'Did the time make sense — not five seconds, not half an hour?',
      es: '¿Tenía sentido el tiempo: ni cinco segundos ni media hora?',
    },
    weight: 20,
  },
];

/** Co hra o sobě řekne validátoru. Všechno je nepovinné — chybějící údaj je „nevíme". */
export interface RunMetrics {
  /** Simulovaný čas běhu v sekundách. */
  seconds?: number;
  /** Dohráno do konce (výhra, dno, srdce, cíl). */
  completed?: boolean;
  /** Skóre běhu (pro „prospěch", když hra nemá objektivy). */
  score?: number;
  /** Splněné objektivy (světla, lampy, kola, bóje, zabití…). */
  objectives?: number;
  /** Maximální počet objektivů, které hra nabízí. */
  objectivesTotal?: number;
  /** Kolik toho hráč dal druhým (Lumi darování, týmové zabití). */
  given?: number;
  /** Kolikrát zpackal/zemřel. */
  setbacks?: number;
  /** Odešel z běhu před koncem? */
  abandoned?: boolean;
}

export interface DharmaPillarResult {
  id: DharmaPillarId;
  /** 0..1 — jak pilíř dopadl. */
  value: number;
  passed: boolean;
  note: string;
}

export type DharmaGrade = 'seal' | 'pass' | 'partial' | 'thin';

export interface DharmaVerdict {
  pillars: DharmaPillarResult[];
  /** 0..100. */
  score: number;
  grade: DharmaGrade;
  /** Násobek XP navíc (0, 0,1, 0,25, 0,5). */
  bonus: number;
  /** Splněné pilíře (pro HUD `3/5`). */
  passed: number;
}

const GRADE_BONUS: Record<DharmaGrade, number> = { seal: 0.5, pass: 0.25, partial: 0.1, thin: 0 };

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Podíl splněných objektivů, nebo `null` když je hra neposílá. */
function objectiveRatio(metrics: RunMetrics): number | null {
  if (!metrics.objectives || !metrics.objectivesTotal) return null;
  return clamp01(metrics.objectives / Math.max(1, metrics.objectivesTotal));
}

/**
 * Spustí pět pilířů nad jedním během.
 *
 * Chybějící údaj **není nula**: hra, která o sobě nic neřekne, dostane
 * neutrální 0,7–0,85, takže se z nezměřeného běhu nestane „špatný hráč".
 */
export function validateRun(metrics: RunMetrics = {}): DharmaVerdict {
  const seconds = metrics.seconds;
  const setbacks = Math.max(0, metrics.setbacks ?? 0);
  const ratio = objectiveRatio(metrics);

  const ahimsa = metrics.abandoned
    ? 0
    : clamp01(1 - setbacks * 0.15);

  // pod tři vteřiny to není běh, ale omyl — satya padá na nulu
  const satya = seconds === undefined ? 0.85 : seconds < 3 ? 0 : clamp01(seconds / 12);

  // „nevíme" (score chybí) je neutrální, „víme nulu" je 0,3 — rozdíl je
  // v tom, jestli hra údaj neposlala, nebo poslala nulu
  const hita = metrics.completed
    ? 1
    : ratio !== null
      ? clamp01(ratio)
      : metrics.score === undefined
        ? 0.6
        : metrics.score > 0
          ? 0.7
          : 0.3;

  // smriti = kolik světa jsi opravdu prošel (bez umělého dna — jinak by
  // i běh s jedním objektivem z deseti vypadal „skoro hotový")
  const smriti = (metrics.given ?? 0) > 0 ? 1 : ratio !== null ? clamp01(ratio) : 0.7;

  const kala =
    seconds === undefined ? 0.85 : seconds < 8 ? 0 : seconds > 1800 ? 0.2 : 1;

  const values: Record<DharmaPillarId, number> = { ahimsa, satya, hita, smriti, kala };
  const notes: Record<DharmaPillarId, string> = {
    ahimsa: metrics.abandoned
      ? 'běh opuštěn'
      : setbacks > 0
        ? `${setbacks}× pád`
        : 'bez pádu',
    satya: seconds === undefined ? 'čas neznámý' : `${Math.round(seconds)} s`,
    hita: metrics.completed ? 'dokončeno' : ratio !== null ? `${Math.round((ratio ?? 0) * 100)} % cílů` : 'bez cíle',
    smriti: (metrics.given ?? 0) > 0 ? `darováno ${metrics.given}×` : ratio !== null ? `${Math.round((ratio ?? 0) * 100)} % světa` : 'neznámo',
    kala: seconds === undefined ? 'neznámý' : seconds < 8 ? 'příliš krátké' : seconds > 1800 ? 'příliš dlouhé' : 'v pořádku',
  };

  const pillars = DHARMA_PILLARS.map((pillar) => {
    const value = clamp01(values[pillar.id]);
    return { id: pillar.id, value, passed: value >= 0.5, note: notes[pillar.id] };
  });

  const score = Math.round(
    pillars.reduce((sum, result) => {
      const pillar = DHARMA_PILLARS.find((item) => item.id === result.id);
      return sum + result.value * (pillar?.weight ?? 20);
    }, 0),
  );
  const passed = pillars.filter((result) => result.passed).length;
  const grade: DharmaGrade =
    passed === pillars.length && score >= 90
      ? 'seal'
      : score >= 70
        ? 'pass'
        : score >= 45
          ? 'partial'
          : 'thin';

  return { pillars, score, grade, bonus: GRADE_BONUS[grade], passed };
}

export interface DharmaSealState {
  /** Kolik pečetí hráč získal (grade === 'seal'). */
  seals: number;
  /** Kolik běhů prošlo validací. */
  validations: number;
  /** Poslední verdikt (pro panel). */
  last: { grade: DharmaGrade; score: number; pillars: { id: DharmaPillarId; passed: boolean }[] } | null;
}

export const EMPTY_DHARMA: DharmaSealState = { seals: 0, validations: 0, last: null };

/** Zapiš verdikt do stavu (jedno místo, kde se počítají pečeti). */
export function applyVerdict(state: DharmaSealState, verdict: DharmaVerdict): DharmaSealState {
  return {
    seals: state.seals + (verdict.grade === 'seal' ? 1 : 0),
    validations: state.validations + 1,
    last: {
      grade: verdict.grade,
      score: verdict.score,
      pillars: verdict.pillars.map((pillar) => ({ id: pillar.id, passed: pillar.passed })),
    },
  };
}
