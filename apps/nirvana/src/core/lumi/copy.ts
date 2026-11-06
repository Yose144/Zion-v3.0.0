/**
 * Texty obrazovky Lumi — jeden slovník, tři jazyky (L-10).
 *
 * Proč samostatný soubor: do 2026-11-05 byly texty **rozsekané jako ternární
 * výrazy** přímo v `page.tsx` (`cs ? 'Vzlétnout' : 'Take off'`), takže třetí
 * jazyk by znamenal přepsat každé místo znovu a půlka by jich zůstala
 * nedotčená. Tady je jedno místo, kde se překlad hledá, a `Localized` z i18n
 * dohlídne, že čeština a angličtina nechybí (u `es` padá na `en`).
 *
 * Co do tohohle souboru **nepatří:** texty světa (úlomky světel, jména cest,
 * kapitoly) — ty jsou data v `world.ts` vedle pozic, protože se čtou i mimo UI
 * (deník, testy). A jména vlastních světů (Uran, Uran) — ta se nepřekládají.
 */
import { fill, type Localized } from '@/core/i18n';

export const LUMI_COPY = {
  // ── hlavička ────────────────────────────────────────────────────────
  kicker: { cs: 'Uran · vnější soustava', en: 'Uranus · outer system', es: 'Urano · sistema exterior' },
  subtitle: { cs: 'děvčátko s lucernou', en: 'the girl with the lantern', es: 'la niña con la linterna' },
  backToPlanet: { cs: 'Uran', en: 'Uranus', es: 'Urano' },

  // ── HUD ─────────────────────────────────────────────────────────────
  lightsAria: { cs: 'Sebraná světla', en: 'Lights gathered', es: 'Luces recogidas' },
  energyTitle: { cs: 'světlo lucerny', en: 'lantern light', es: 'luz de la linterna' },
  toShrine: { cs: 'Do svatyně zbývá {n} světel', en: '{n} lights to the shrine', es: 'Faltan {n} luces para el santuario' },
  shrineOpen: {
    cs: 'Svatyně je otevřená — doleť k ní',
    en: 'The shrine is open — fly to it',
    es: 'El santuario está abierto — vuela hacia él',
  },
  touchUp: { cs: 'VZHŮRU', en: 'UP', es: 'ARRIBA' },

  // ── foto mód ────────────────────────────────────────────────────────
  photoTitle: {
    cs: 'foto mód — schová HUD (Esc vrátí)',
    en: 'photo mode — hides the HUD (Esc returns)',
    es: 'modo foto — oculta el HUD (Esc vuelve)',
  },
  photoAria: { cs: 'foto mód', en: 'photo mode', es: 'modo foto' },
  photoExit: { cs: 'zpět', en: 'exit', es: 'salir' },
  photoExitHint: { cs: 'nebo Esc', en: 'or Esc', es: 'o Esc' },

  // ── předání světla (L-6) ────────────────────────────────────────────
  handoffTitle: {
    cs: 'předat světlo nejbližšímu spolulentci',
    en: 'hand a light to the nearest flyer',
    es: 'entregar una luz al volador más cercano',
  },
  handoffAria: { cs: 'předat světlo', en: 'hand a light off', es: 'entregar una luz' },
  giftedTitle: { cs: 'darovaná světla', en: 'gifted lights', es: 'luces regaladas' },
  giftFrom: { cs: 'Světlo od {name}', en: 'A light from {name}', es: 'Una luz de {name}' },
  giftGiven: { cs: 'Světlo předáno — {name}', en: 'Light passed on — {name}', es: 'Luz entregada — {name}' },

  // ── intro ───────────────────────────────────────────────────────────
  rules1: {
    cs: 'Lucerna svítí a nese, ale dohořívá. Klouzání ji dobíjí.',
    en: 'The lantern shines and carries you, but it burns down. Gliding refills it.',
    es: 'La linterna brilla y te sostiene, pero se consume. Planear la recarga.',
  },
  rules2: {
    cs: 'Proudy vzduchu nesou a dobíjí — hledej je.',
    en: 'Air currents carry you and refill you — look for them.',
    es: 'Las corrientes de aire te llevan y te recargan — búscalas.',
  },
  rules3: {
    cs: 'Svatyně se otevře, až když máš všech sedm.',
    en: 'The shrine opens only when you have all seven.',
    es: 'El santuario se abre solo cuando tienes las siete.',
  },
  pathsAria: { cs: 'Cesta', en: 'Path', es: 'Camino' },
  pathLockedTitle: {
    cs: 'Odemkne se po dohrání obou cest',
    en: 'Unlocks after finishing both paths',
    es: 'Se desbloquea al terminar ambos caminos',
  },
  pathLockedNote: {
    cs: 'nejdřív doleť obě předchozí cesty',
    en: 'finish the two earlier paths first',
    es: 'primero termina los dos caminos anteriores',
  },
  coopAria: { cs: 'S kým letět', en: 'Fly with', es: 'Volar con' },
  solo: { cs: 'Sólo', en: 'Solo', es: 'Solo' },
  withFriend: { cs: 'S kamarádem', en: 'With a friend', es: 'Con un amigo' },
  serverDown: { cs: 'server není dostupný', en: 'server unavailable', es: 'servidor no disponible' },
  start: { cs: 'Vzlétnout', en: 'Take off', es: 'Despegar' },
  journal: { cs: 'Deník', en: 'Journal', es: 'Diario' },
  lookingForOthers: { cs: 'hledám další…', en: 'looking for others…', es: 'buscando a otros…' },
  flyingWith: { cs: 's tebou letí {n}', en: '{n} flying with you', es: 'vuelan contigo {n}' },

  // ── deník ───────────────────────────────────────────────────────────
  journalAria: { cs: 'Deník světel', en: 'Journal of lights', es: 'Diario de luces' },
  journalTitle: { cs: 'Deník světel', en: 'Journal of lights', es: 'Diario de luces' },
  close: { cs: 'Zavřít', en: 'Close', es: 'Cerrar' },
  notFound: { cs: '— ještě nenalezeno —', en: '— not found yet —', es: '— aún no encontrada —' },

  // ── panel po doletu ─────────────────────────────────────────────────
  done: { cs: 'Světlo se vrátilo', en: 'The light returned', es: 'La luz volvió' },
  scoreLights: { cs: 'světla', en: 'lights', es: 'luces' },
  scoreTime: { cs: 'čas', en: 'time', es: 'tiempo' },
  scorePath: { cs: 'cesta', en: 'path', es: 'camino' },
  compassShrineAria: { cs: 'kompas ke svatyni', en: 'compass to the shrine', es: 'brújula al santuario' },
  compassLightAria: {
    cs: 'kompas k nejbližšímu světlu',
    en: 'compass to the nearest light',
    es: 'brújula a la luz más cercana',
  },
  compassShrineTitle: { cs: 'svatyně · {n}', en: 'shrine · {n}', es: 'santuario · {n}' },
  compassLightTitle: { cs: 'světlo · {n}', en: 'light · {n}', es: 'luz · {n}' },
  giftAria: { cs: 'Co uděláš se světlem', en: 'What you do with the light', es: 'Qué haces con la luz' },
  points: { cs: 'bodů', en: 'points', es: 'puntos' },
  given: { cs: 'darováno', en: 'given', es: 'regalado' },
  again: { cs: 'Znovu', en: 'Again', es: 'Otra vez' },
  coopBonus: { cs: 'koop podíl', en: 'co-op share', es: 'parte coop' },
  backToUranus: { cs: 'zpět na Uran', en: 'back to Uranus', es: 'volver a Urano' },
  journalStats: {
    cs: '{found}/7 nalezeno · {runs} cest · darováno {given}×',
    en: '{found}/7 found · {runs} journeys · given {given}×',
    es: '{found}/7 encontradas · {runs} viajes · regaladas {given}×',
  },
  journalNote: {
    cs: 'Deník se ukládá v prohlížeči. Cesty jsou dvě a světla jsou v obou stejná — jde o to je donést.',
    en: 'The journal lives in your browser. There are two paths and the lights are the same in both — carrying them is the point.',
    es: 'El diario vive en tu navegador. Hay dos caminos y las luces son las mismas en ambos: llevarlas es lo importante.',
  },
} as const satisfies Record<string, Localized>;

export type LumiCopyKey = keyof typeof LUMI_COPY;

/** `fill` bydlí v i18n vedle `tx` — ostatní slovníky ho mají taky. */
export { fill };
