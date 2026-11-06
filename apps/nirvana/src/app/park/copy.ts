/**
 * Texty Jupiter Station (`/park`) — jeden slovník, tři jazyky (L-10).
 *
 * Stejné pravidlo jako u Lumi: obrazovka nesmí mít `cs ? '…' : '…'` v JSX,
 * jinak se třetí jazyk doplňuje na desítkách míst a polovina zůstane stranou.
 * Texty her samotných (`game.title`, `game.hint`) zůstávají v datech her.
 */
import type { Localized } from '@/core/i18n';

export const PARK_COPY = {
  kicker: { cs: 'pouť · hry · ruské kolo', en: 'fair · games · ferris wheel', es: 'feria · juegos · noria' },
  tokens: { cs: 'Žetony', en: 'Tokens', es: 'Fichas' },
  getOff: { cs: 'Sesednout', en: 'Get off', es: 'Bajar' },
  rideStart: { cs: 'Jízda začíná', en: 'Ride starts', es: 'El viaje empieza' },
  rideEnd: { cs: 'Jízda ukončena', en: 'Ride ended', es: 'Viaje terminado' },
  pickCabinet: { cs: 'vyber si skříň', en: 'pick a cabinet', es: 'elige una cabina' },
  pickCabinetTitle: { cs: 'VYBER SI SKŘÍŇ', en: 'PICK A CABINET', es: 'ELIGE UNA CABINA' },
  gallery: { cs: 'STŘELNICE', en: 'GALLERY', es: 'GALERÍA' },
  galleryStart: { cs: 'Střelnice · 25 sekund', en: 'Gallery · 25 seconds', es: 'Galería · 25 segundos' },
  galleryHint: { cs: 'Střelnice · 25 s · 3D terče', en: 'Shooting gallery · 25 s · 3D targets', es: 'Galería · 25 s · dianas 3D' },
  pointsShort: { cs: 'b.', en: 'pts', es: 'pts' },
  seconds: { cs: 's', en: 's', es: 's' },
  action: { cs: 'AKCE', en: 'ACTION', es: 'ACCIÓN' },
  quit: { cs: 'Ukončit', en: 'Quit', es: 'Salir' },
  quitGame: { cs: 'Ukončit hru', en: 'Quit game', es: 'Salir del juego' },
  playAgain: { cs: 'Hrát znovu', en: 'Play again', es: 'Jugar otra vez' },
  score: { cs: 'skóre', en: 'score', es: 'puntos' },
  best: { cs: 'rekord', en: 'best', es: 'récord' },
  daily: { cs: 'DENNÍ VÝZVA', en: 'DAILY CHALLENGE', es: 'RETO DIARIO' },
  target: { cs: 'cíl', en: 'target', es: 'objetivo' },
  board: { cs: 'TABULE', en: 'BOARD', es: 'TABLA' },
  nickname: { cs: 'Přezdívka', en: 'Nickname', es: 'Apodo' },
  noToken: { cs: 'Chybí žeton — dohraj hru', en: 'No token left — finish a game', es: 'Falta una ficha — termina una partida' },
} as const satisfies Record<string, Localized>;

export type ParkCopyKey = keyof typeof PARK_COPY;
