/**
 * Texty Neptunu — jeden slovník pro celou stránku.
 *
 * Stejné pravidlo jako u Lumi a Te Pīko Ora: v `page.tsx` nesmí zůstat
 * žádné `cs ? '…' : '…'`. `es` je vyplněné, `pt`/`fr` padají na angličtinu
 * (`tx()` to dělá samo).
 */

import type { Localized } from '@/core/i18n';

export const NEPTUN_COPY = {
  // ── hlavička a menu ─────────────────────────────────────────────────
  kicker: { cs: 'Neptun · vnější soustava', en: 'Neptune · outer system', es: 'Neptuno · sistema exterior' },
  title: { cs: 'Hlubina', en: 'The Deep', es: 'La Profundidad' },
  subtitle: { cs: 'sestup atmosférou', en: 'a descent through the atmosphere', es: 'un descenso por la atmósfera' },
  intro: {
    cs: 'Zvon visí na draku nad modrým oparem a klesá. Neptun nemá pevninu — pod tebou jsou jen vrstvy větru, ledu a tmy. Drž se uličky, sbírej světla, doleť na dno.',
    en: 'The bell hangs from a kite above the blue haze and sinks. Neptune has no ground — below you are only layers of wind, ice and dark. Hold the lane, gather the lights, reach the bottom.',
    es: 'La campana cuelga de una cometa sobre la bruma azul y desciende. Neptuno no tiene suelo: bajo ti solo hay capas de viento, hielo y oscuridad. Mantén el carril, recoge las luces y llega al fondo.',
  },
  start: { cs: 'Sestoupit', en: 'Descend', es: 'Descender' },
  again: { cs: 'Znovu', en: 'Again', es: 'Otra vez' },
  menu: { cs: 'Menu', en: 'Menu', es: 'Menú' },
  backUniverse: { cs: 'Nirvana', en: 'Nirvana', es: 'Nirvana' },
  backArchive: { cs: 'Dosier planety', en: 'Planet dossier', es: 'Dosier del planeta' },

  // ── ovládání ────────────────────────────────────────────────────────
  keysTitle: { cs: 'Ovládání', en: 'Controls', es: 'Controles' },
  keySteer: { cs: 'kormidlo proti větru', en: 'steer against the wind', es: 'timón contra el viento' },
  keyDive: { cs: 'rychlejší sestup', en: 'dive faster', es: 'descender más rápido' },
  keyBrake: { cs: 'přibrzdit', en: 'slow down', es: 'frenar' },
  hint: {
    cs: 'Lucerna svítí, dokud má energii — hloubka ji žere rychleji. Světla ji dobíjí, víry berou. Plášť praskne o stěnu proudu.',
    en: 'The lantern burns while it has energy — depth eats it faster. Lights refill it, vortices drain it. The hull cracks against the jet wall.',
    es: 'El farol arde mientras tiene energía — la profundidad la consume más rápido. Las luces la recargan, los vórtices la drenan. El casco se agrieta contra la pared del chorro.',
  },

  // ── HUD ─────────────────────────────────────────────────────────────
  hudDepth: { cs: 'hloubka', en: 'depth', es: 'profundidad' },
  hudEnergy: { cs: 'lucerna', en: 'lantern', es: 'farol' },
  hudHull: { cs: 'plášť', en: 'hull', es: 'casco' },
  hudLights: { cs: 'světla', en: 'lights', es: 'luces' },
  hudWind: { cs: 'vítr', en: 'wind', es: 'viento' },
  hudScore: { cs: 'skóre', en: 'score', es: 'puntos' },
  compassMote: { cs: 'světlo', en: 'light', es: 'luz' },
  compassBottom: { cs: 'dno', en: 'bottom', es: 'fondo' },
  compassBelow: { cs: 'níž', en: 'below', es: 'abajo' },
  compassAbove: { cs: 'výš', en: 'above', es: 'arriba' },

  // ── hlášky ──────────────────────────────────────────────────────────
  toastMote: { cs: 'světlo sebrané', en: 'light gathered', es: 'luz recogida' },
  toastVortex: { cs: 'vír tě táhne', en: 'the vortex pulls', es: 'el vórtice tira' },
  toastWall: { cs: 'náraz do proudu', en: 'hit the jet wall', es: 'choque con el chorro' },
  toastDeck: { cs: 'vrstva', en: 'layer', es: 'capa' },

  // ── výsledek ────────────────────────────────────────────────────────
  endBottom: { cs: 'Dno. Ticho, které není mír.', en: 'The bottom. A silence that is not peace.', es: 'El fondo. Un silencio que no es paz.' },
  endLantern: {
    cs: 'Lucerna zhasla. Zvon stoupá zpátky nahoru.',
    en: 'The lantern went out. The bell rises back up.',
    es: 'El farol se apagó. La campana sube de nuevo.',
  },
  endHull: {
    cs: 'Plášť to nevydržel. Tlak tě vrátil do oparu.',
    en: 'The hull gave out. Pressure returned you to the haze.',
    es: 'El casco cedió. La presión te devolvió a la bruma.',
  },
  resultDepth: { cs: 'hloubka', en: 'depth', es: 'profundidad' },
  resultLights: { cs: 'světla', en: 'lights', es: 'luces' },
  resultTime: { cs: 'čas', en: 'time', es: 'tiempo' },
  resultScore: { cs: 'skóre', en: 'score', es: 'puntos' },
  newRecord: { cs: 'rekord', en: 'record', es: 'récord' },

  // ── dosier planety (původní svět zůstává) ───────────────────────────
  factsTitle: { cs: 'Planeta', en: 'The planet', es: 'El planeta' },
  factsNote: {
    cs: 'Čísla jsou z fact sheetu NASA/JPL; text o hlubině a tichu je jazyk Nirvany, ne astronomie.',
    en: 'Numbers come from the NASA/JPL fact sheet; the text about the deep and silence is Nirvana’s language, not astronomy.',
    es: 'Los números vienen de la ficha de la NASA/JPL; el texto sobre la profundidad y el silencio es el lenguaje de Nirvana, no astronomía.',
  },
  deckLabel: { cs: 'vrstva', en: 'layer', es: 'capa' },
} satisfies Record<string, Localized>;

export type NeptunCopyKey = keyof typeof NEPTUN_COPY;
