/**
 * Texty Venuše (`/venus`) — jeden slovník, tři jazyky (L-10).
 *
 * Závod má krátké HUD popisky (`k` = kolo, `l` = lap), které se v překladu
 * snadno přehlédnou — proto jsou tady jako klíče, ne v JSX.
 */
import type { Localized } from '@/core/i18n';

export const RACE_COPY = {
  gas: { cs: 'PLYN', en: 'GAS', es: 'GAS' },
  brake: { cs: 'BRZDA', en: 'BRAKE', es: 'FRENO' },
  lap: { cs: 'kolo', en: 'lap', es: 'vuelta' },
  lapShort: { cs: 'k', en: 'l', es: 'v' },
  offline: { cs: 'offline', en: 'offline', es: 'sin conexión' },
  start: { cs: 'start!', en: 'go!', es: '¡ya!' },
  finish: { cs: 'cíl — nový závod za chvíli', en: 'finish — new race soon', es: 'meta — otra carrera pronto' },
  best: { cs: 'nej', en: 'best', es: 'mejor' },
  offTrack: { cs: 'mimo trať', en: 'off track', es: 'fuera de pista' },
  throttleToStart: { cs: 'plyn = start', en: 'throttle to start', es: 'acelera para empezar' },
  circuit: { cs: 'okruh · 3 kola · 3 soupeři', en: 'circuit · 3 laps · 3 rivals', es: 'circuito · 3 vueltas · 3 rivales' },
  throttle: { cs: 'plyn', en: 'throttle', es: 'acelerar' },
  brakeLower: { cs: 'brzda', en: 'brake', es: 'frenar' },
  steer: { cs: 'zatáčení', en: 'steer', es: 'girar' },
  toGrid: { cs: 'Na start', en: 'To the grid', es: 'A la parrilla' },
  multiplayer: { cs: 'Multiplayer — proti lidem', en: 'Multiplayer — against people', es: 'Multijugador — contra personas' },
  backToFair: { cs: '← zpět na pouť', en: '← back to the fair', es: '← volver a la feria' },
  menu: { cs: 'Menu', en: 'Menu', es: 'Menú' },
  total: { cs: 'celkem', en: 'total', es: 'total' },
  bestLap: { cs: 'nejlepší kolo', en: 'best lap', es: 'mejor vuelta' },
  score: { cs: 'skóre', en: 'score', es: 'puntos' },
  again: { cs: 'Znovu', en: 'Again', es: 'Otra vez' },
  title: { cs: 'VENUŠE', en: 'VENUS', es: 'VENUS' },
  intro: {
    cs: 'Hovercraft, tři kola a tři soupeři na stejných strojích. Rozhoduje brzdný bod a stopa — kdo jede čistěji, vyhraje. Mimo pás tě to zpomalí a přitáhne zpět.',
    en: 'A hovercraft, three laps and three rivals on identical machines. Braking points and the racing line decide it — the cleaner driver wins. Off the strip you slow down and get pulled back.',
    es: 'Un aerodeslizador, tres vueltas y tres rivales con máquinas idénticas. Deciden los puntos de frenada y la trazada: gana quien conduce más limpio. Fuera de la pista te frenan y te devuelven.',
  },
} as const satisfies Record<string, Localized>;

export type RaceCopyKey = keyof typeof RACE_COPY;
