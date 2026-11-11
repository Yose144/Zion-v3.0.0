/**
 * Texty Pluta — jeden slovník pro celou stránku.
 *
 * Stejné pravidlo jako u Neptunu, Lumi a Pika: v `page.tsx` nesmí zůstat
 * žádné `cs ? '…' : '…'`. `es` je vyplněné, `pt`/`fr` padají na angličtinu.
 */

import type { Localized } from '@/core/i18n';

export const PLUTO_COPY = {
  // ── hlavička a menu ─────────────────────────────────────────────────
  kicker: { cs: 'Pluto · srdce na okraji', en: 'Pluto · the heart at the edge', es: 'Plutón · el corazón en el borde' },
  title: { cs: 'Srdce na okraji', en: 'The Heart at the Edge', es: 'El Corazón en el Borde' },
  subtitle: { cs: 'devět lamp a poslední světlo', en: 'nine lamps and the last light', es: 'nueve lámparas y la última luz' },
  intro: {
    cs: 'Přistál jsi na zmrzlé pláni ve tvaru srdce. Slunce je odsud jen hvězda a teplo drží jen lucerna. Rozsviť devět lamp — každá je nové ohniště — a nezamrzni cestou mezi nimi.',
    en: 'You have landed on a frozen plain shaped like a heart. From here the Sun is only a star and only your lantern holds warmth. Light the nine lamps — each one a new hearth — and do not freeze on the way between them.',
    es: 'Has aterrizado en una llanura helada con forma de corazón. Desde aquí el Sol es solo una estrella y solo tu farol guarda calor. Enciende las nueve lámparas — cada una es un nuevo hogar — y no te congeles en el camino.',
  },
  start: { cs: 'Vyjít', en: 'Set out', es: 'Salir' },
  again: { cs: 'Znovu', en: 'Again', es: 'Otra vez' },
  menu: { cs: 'Menu', en: 'Menu', es: 'Menú' },
  backUniverse: { cs: 'Nirvana', en: 'Nirvana', es: 'Nirvana' },
  backArchive: { cs: 'Dosier planety', en: 'Planet dossier', es: 'Dosier del planeta' },

  // ── ovládání ────────────────────────────────────────────────────────
  keysTitle: { cs: 'Ovládání', en: 'Controls', es: 'Controles' },
  keyMove: { cs: 'chůze po pláni', en: 'walk the plain', es: 'caminar por la llanura' },
  keyLight: { cs: 'u lampy stačí stát — lucerna ji zapálí', en: 'just stand at a lamp — the lantern lights it', es: 'basta con estar junto a una lámpara: el farol la enciende' },
  hint: {
    cs: 'Teplo ubývá podle vzdálenosti od nejbližšího světla a s časem (soumrak). U modulu i u lampy se dobíjí. Zapálená lampa je nové ohniště — hra je o posouvání hranice, ne o běhu na konec mapy.',
    en: 'Warmth drains with distance from the nearest light and with time (dusk). It refills at the shuttle and at any lit lamp. A lit lamp is a new hearth — the game is about pushing the boundary, not running to the far edge.',
    es: 'El calor baja con la distancia a la luz más cercana y con el tiempo (anochecer). Se recarga en el módulo y en cualquier lámpara encendida. Una lámpara encendida es un nuevo hogar: el juego va de mover el límite, no de correr al borde del mapa.',
  },

  // ── HUD ─────────────────────────────────────────────────────────────
  hudWarmth: { cs: 'teplo', en: 'warmth', es: 'calor' },
  hudLamps: { cs: 'lampy', en: 'lamps', es: 'lámparas' },
  hudReach: { cs: 'dosah', en: 'reach', es: 'alcance' },
  hudScore: { cs: 'skóre', en: 'score', es: 'puntos' },
  hudDusk: { cs: 'soumrak', en: 'dusk', es: 'anochecer' },
  compassLamp: { cs: 'nejbližší lampa', en: 'nearest lamp', es: 'lámpara más cercana' },
  channel: { cs: 'zapaluji…', en: 'lighting…', es: 'encendiendo…' },
  nearWarm: { cs: 'u ohně', en: 'by the fire', es: 'junto al fuego' },

  // ── hlášky ──────────────────────────────────────────────────────────
  toastLit: { cs: 'lampa svítí', en: 'lamp lit', es: 'lámpara encendida' },
  toastCold: { cs: 'zima — vrať se k ohni', en: 'cold — go back to a fire', es: 'frío — vuelve al fuego' },
  toastWarm: { cs: 'teplo doplněno', en: 'warmth restored', es: 'calor restaurado' },

  // ── výsledek ────────────────────────────────────────────────────────
  endComplete: {
    cs: 'Srdce svítí. Devět ohňů na konci světa.',
    en: 'The heart is lit. Nine fires at the end of the world.',
    es: 'El corazón brilla. Nueve fuegos al final del mundo.',
  },
  endFrozen: {
    cs: 'Zamrzl jsi. Lucerna zhasla mezi dvěma ohni.',
    en: 'You froze. The lantern went out between two fires.',
    es: 'Te has congelado. El farol se apagó entre dos fuegos.',
  },
  resultLamps: { cs: 'lampy', en: 'lamps', es: 'lámparas' },
  resultWarmth: { cs: 'teplo', en: 'warmth', es: 'calor' },
  resultTime: { cs: 'čas', en: 'time', es: 'tiempo' },
  resultScore: { cs: 'skóre', en: 'score', es: 'puntos' },
  newRecord: { cs: 'rekord', en: 'record', es: 'récord' },

  // ── dosier planety ──────────────────────────────────────────────────
  factsTitle: { cs: 'Planeta', en: 'The planet', es: 'El planeta' },
  factsNote: {
    cs: 'Čísla jsou z fact sheetu NASA/JPL (New Horizons); text o srdci a posledním světle je jazyk Nirvany, ne astronomie.',
    en: 'Numbers come from the NASA/JPL fact sheet (New Horizons); the text about the heart and the last light is Nirvana’s language, not astronomy.',
    es: 'Los números vienen de la ficha de la NASA/JPL (New Horizons); el texto sobre el corazón y la última luz es el lenguaje de Nirvana, no astronomía.',
  },
} satisfies Record<string, Localized>;

export type PlutoCopyKey = keyof typeof PLUTO_COPY;
