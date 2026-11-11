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
  map: { cs: 'Mapa (sólo)', en: 'Map (solo)', es: 'Mapa (solo)' },
  mapNote: {
    cs: 'Q3DM3 a Q3DM6 jsou stylizované půdorysy podle Quake 3 — most a komory, věž a křídla. Multiplayer jede na Marsu.',
    en: 'Q3DM3 and Q3DM6 are stylised layouts after Quake 3 — bridge and chambers, tower and wings. Multiplayer stays on Mars.',
    es: 'Q3DM3 y Q3DM6 son diseños estilizados de Quake 3: puente y cámaras, torre y alas. El multijugador sigue en Marte.',
  },
  enter: { cs: 'Vstoupit do arény', en: 'Enter the arena', es: 'Entrar en la arena' },
  multiplayer: { cs: 'Multiplayer — proti lidem', en: 'Multiplayer — against people', es: 'Multijugador — contra personas' },
  backToFair: { cs: '← zpět na pouť', en: '← back to the fair', es: '← volver a la feria' },
  menu: { cs: 'Menu', en: 'Menu', es: 'Menú' },
  rematch: { cs: 'Odveta', en: 'Rematch', es: 'Revancha' },
  intro: {
    cs: 'Rail a rakety, tři boti, frag limit 10 nebo tři minuty. Mapa je z krabic — žádné modely, jen fyzika a světlo.',
    en: 'Rail and rockets, three bots, frag limit 10 or three minutes. The map is made of boxes — no models, just physics and light.',
    es: 'Rail y cohetes, tres bots, límite de 10 bajas o tres minutos. El mapa son cajas: sin modelos, solo física y luz.',
  },
  mpNote: {
    cs: 'Multiplayer: server počítá pohyb i zásahy, ty posíláš jen vstup. Chat (T) je pro přihlášené.',
    en: 'Multiplayer: the server computes movement and hits, you only send input. Chat (T) is for signed-in users.',
    es: 'Multijugador: el servidor calcula el movimiento y los impactos, tú solo envías la entrada. El chat (T) es para usuarios registrados.',
  },
  vrNote: {
    cs: 'Myš se zamkne kliknutím do plátna. Ve VR (tlačítko VR) míříš pravým ovladačem a střílíš spouští — hráč ale stojí, pohyb ovladačem ještě není.',
    en: 'The mouse locks when you click the canvas. In VR (VR button) you aim with the right controller and fire with the trigger — the player stands still, controller movement is not implemented yet.',
    es: 'El ratón se bloquea al hacer clic en el lienzo. En VR (botón VR) apuntas con el mando derecho y disparas con el gatillo: el jugador está quieto, mover con el mando aún no existe.',
  },
} as const satisfies Record<string, Localized>;

export type ArenaCopyKey = keyof typeof ARENA_COPY;
