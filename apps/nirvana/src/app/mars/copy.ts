/**
 * Texty Mars arény (`/mars`) — jeden slovník, tři jazyky (L-10).
 *
 * HUD arény je hustý, takže se sem přesunula i slova, která vypadají jako
 * zkratky (`fraggy`, `respawN za`) — právě ta se při překladu nejčastěji
 * zapomenou, protože „to přece nikdo nečte".
 */
import type { Localized } from '@/core/i18n';

export const ARENA_COPY = {
  time: { cs: 'čas', en: 'time', es: 'tiempo' },
  frags: { cs: 'fraggy', en: 'frags', es: 'bajas' },
  deaths: { cs: 'smrti', en: 'deaths', es: 'muertes' },
  score: { cs: 'skóre', en: 'score', es: 'puntos' },
  offline: { cs: 'offline', en: 'offline', es: 'sin conexión' },
  matchOver: {
    cs: 'konec zápasu — nový začne za chvíli',
    en: 'match over — new one starts shortly',
    es: 'fin de la partida — empieza otra en un momento',
  },
  respawnIn: { cs: 'respawN za', en: 'respawn in', es: 'reapareces en' },
  mode: { cs: 'deathmatch · Quake-style', en: 'deathmatch · Quake-style', es: 'duelo a muerte · estilo Quake' },
  move: { cs: 'pohyb', en: 'move', es: 'movimiento' },
  jump: { cs: 'skok', en: 'jump', es: 'salto' },
  weapons: { cs: 'rail / rakety / MG', en: 'rail / rockets / MG', es: 'rail / cohetes / MG' },
  fire: { cs: 'střelba', en: 'fire', es: 'disparar' },
  lookSensitivity: { cs: 'citlivost pohledu', en: 'look sensitivity', es: 'sensibilidad de vista' },
  enter: { cs: 'Vstoupit do arény', en: 'Enter the arena', es: 'Entrar en la arena' },
  multiplayer: { cs: 'Multiplayer — proti lidem', en: 'Multiplayer — against people', es: 'Multijugador — contra personas' },
  backToFair: { cs: '← zpět na pouť', en: '← back to the fair', es: '← volver a la feria' },
  rematch: { cs: 'Odveta', en: 'Rematch', es: 'Revancha' },
} as const satisfies Record<string, Localized>;

export type ArenaCopyKey = keyof typeof ARENA_COPY;
