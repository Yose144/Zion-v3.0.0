/**
 * Texty Te Pīko Ora — jeden slovník pro celou stránku.
 *
 * Stejné pravidlo jako u Lumi: v `page.tsx` nesmí zůstat žádné
 * `cs ? '…' : '…'`, jinak se třetí jazyk doplňuje na dvaceti místech
 * a polovina zůstane česky. `es` je vyplněné, `pt`/`fr` padají na `en`.
 */

import type { Localized } from '@/core/i18n';

export const PIKO_COPY = {
  // ── hlavička a menu ─────────────────────────────────────────────────
  kicker: { cs: 'Raiatea · laguna', en: 'Raiatea · lagoon', es: 'Raiatea · laguna' },
  subtitle: { cs: 'kánoe a surf', en: 'canoe & surf', es: 'canoa y surf' },
  title: { cs: 'Te Pīko Ora', en: 'Te Pīko Ora', es: 'Te Pīko Ora' },
  intro: {
    cs: 'Vesnice na břehu laguny. Vypluj na kánoi mezi bóje, nebo chyť vlnu a jeď po její stěně. Dvě hry, jeden svět.',
    en: 'A village on the lagoon shore. Paddle a canoe between the buoys, or catch a wave and ride its face. Two games, one world.',
    es: 'Una aldea en la orilla de la laguna. Rema en canoa entre las boyas o coge una ola y surfea su pared. Dos juegos, un mundo.',
  },
  backToFair: { cs: 'Zpět do pouti', en: 'Back to the fair', es: 'Volver a la feria' },
  backToUniverse: { cs: 'Nirvana', en: 'Nirvana', es: 'Nirvana' },

  // ── volba hry ───────────────────────────────────────────────────────
  modeCanoe: { cs: "Va'a — kánoe", en: "Va'a — canoe", es: "Va'a — canoa" },
  modeCanoeNote: {
    cs: 'Šest bójí od břehu k útesu a zpátky. Záběry v rytmu, otočka je půlka hry.',
    en: 'Six buoys from the shore to the reef and back. Strokes in rhythm; the turn is half the game.',
    es: 'Seis boyas de la orilla al arrecife y vuelta. Remadas con ritmo; el giro es medio juego.',
  },
  modeSurf: { cs: 'Nalu — surf', en: 'Nalu — surf', es: 'Nalu — surf' },
  modeSurfNote: {
    cs: 'Tři vlny. Drž se kapsy, pumpuj a nepřežeň řez — balanc drží jen klidná jízda.',
    en: 'Three waves. Stay in the pocket, pump, and do not overcook the carve — balance only holds on a calm line.',
    es: 'Tres olas. Mantente en el bolsillo, bombea y no fuerces el giro — el equilibrio solo aguanta una línea tranquila.',
  },
  startCanoe: { cs: 'Vyplout', en: 'Paddle out', es: 'Salir a remar' },
  startSurf: { cs: 'Do vody', en: 'Into the water', es: 'Al agua' },
  chooseMode: { cs: 'Vyber hru', en: 'Pick a game', es: 'Elige un juego' },

  // ── ovládání ────────────────────────────────────────────────────────
  keysTitle: { cs: 'Ovládání', en: 'Controls', es: 'Controles' },
  keyPaddle: { cs: 'záběr pádlem', en: 'paddle stroke', es: 'remada' },
  keyPump: { cs: 'dopumpovat vlnu', en: 'pump the wave', es: 'bombear la ola' },
  keyBrace: { cs: 'přibrzdit / srovnat', en: 'brace / slow down', es: 'frenar / estabilizar' },
  keySteer: { cs: 'kormidlo', en: 'steer', es: 'timón' },
  hintCanoe: {
    cs: 'Drž pádlo — záběry jdou v rytmu. K otočce potřebuješ rychlost.',
    en: 'Hold the paddle — strokes come in rhythm. You need speed to turn.',
    es: 'Mantén el remo — las remadas van con ritmo. Necesitas velocidad para girar.',
  },
  hintSurf: {
    cs: 'Vlna tě veze. V kapse jsi rychlejší, tvrdý řez bere balanc.',
    en: 'The wave carries you. The pocket is faster; a hard carve costs balance.',
    es: 'La ola te lleva. El bolsillo es más rápido; un giro fuerte cuesta equilibrio.',
  },

  // ── HUD ─────────────────────────────────────────────────────────────
  menu: { cs: 'Menu', en: 'Menu', es: 'Menú' },
  speed: { cs: 'rychlost', en: 'speed', es: 'velocidad' },
  gates: { cs: 'bóje', en: 'buoys', es: 'boyas' },
  time: { cs: 'čas', en: 'time', es: 'tiempo' },
  wave: { cs: 'vlna', en: 'wave', es: 'ola' },
  waveOf: { cs: 'vlna {n}/{total}', en: 'wave {n}/{total}', es: 'ola {n}/{total}' },
  balance: { cs: 'balanc', en: 'balance', es: 'equilibrio' },
  pocket: { cs: 'kapsa', en: 'pocket', es: 'bolsillo' },
  score: { cs: 'skóre', en: 'score', es: 'puntuación' },
  distance: { cs: 'vzdálenost', en: 'distance', es: 'distancia' },
  best: { cs: 'rekord', en: 'best', es: 'récord' },
  waitingWave: { cs: 'vlna přichází…', en: 'wave incoming…', es: 'ola en camino…' },
  paddleNow: { cs: 'zaber pádlem', en: 'paddle now', es: 'rema ahora' },
  takeoff: { cs: 'Vlna tě veze', en: 'The wave has you', es: 'La ola te lleva' },
  wipeout: { cs: 'Pád!', en: 'Wipeout!', es: '¡Caída!' },
  bogged: { cs: 'Ztratil jsi vlnu', en: 'You lost the wave', es: 'Perdiste la ola' },
  cleanWave: { cs: 'Čistá jízda', en: 'Clean ride', es: 'Ola limpia' },
  gateHit: { cs: 'Bóje projetá', en: 'Buoy passed', es: 'Boya pasada' },

  // ── výsledek ────────────────────────────────────────────────────────
  finishedCanoe: { cs: 'Kurz dokončen', en: 'Course complete', es: 'Recorrido completado' },
  finishedSurf: { cs: 'Sada dojetá', en: 'Set finished', es: 'Set terminado' },
  resultScore: { cs: 'skóre', en: 'score', es: 'puntuación' },
  resultTime: { cs: 'čas', en: 'time', es: 'tiempo' },
  resultGates: { cs: 'bóje', en: 'buoys', es: 'boyas' },
  resultWaves: { cs: 'vlny', en: 'waves', es: 'olas' },
  resultWipes: { cs: 'pády', en: 'wipeouts', es: 'caídas' },
  resultDistance: { cs: 'ujeto', en: 'ridden', es: 'recorrido' },
  again: { cs: 'Znovu', en: 'Again', es: 'Otra vez' },
  switchMode: { cs: 'Druhá hra', en: 'Other game', es: 'Otro juego' },

  // ── dotyk ───────────────────────────────────────────────────────────
  touchPaddle: { cs: 'ZÁBĚR', en: 'STROKE', es: 'REMAR' },
  touchBrace: { cs: 'BRZDA', en: 'BRACE', es: 'FRENO' },
  touchLeft: { cs: 'VLEVO', en: 'LEFT', es: 'IZQ' },
  touchRight: { cs: 'VPRAVO', en: 'RIGHT', es: 'DER' },
  canvasAria: { cs: 'Vodní hra v laguně', en: 'Water game in the lagoon', es: 'Juego acuático en la laguna' },
} satisfies Record<string, Localized>;

export type PikoCopyKey = keyof typeof PIKO_COPY;
