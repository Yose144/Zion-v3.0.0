/**
 * Režim diváka — „dívat se na rozehranou místnost".
 *
 * Pozvánka i hlediště jsou **URL**, ne stav v paměti: `/mars?watch=arena-2`
 * projde chatem, přežije reload a dá se poslat kamarádovi. Server podle
 * `spectate: true` pozná, že nemá přidělit sedlo.
 *
 * Odkaz se přijímá jen ve tvaru `<hra>-<číslo>` — cokoli jiného by posílalo
 * nesmyslné id do serveru a hráč by skončil v místnosti, která neexistuje.
 */

import type { GameId } from './protocol';

/** Stránka, na které se daná hra hraje (divák tam má dojít). */
export const GAME_ROUTES: Record<GameId, string> = {
  arena: '/mars',
  race: '/venus',
  fight: '/mercury',
  moba: '/earth',
  tanks: '/saturn',
  lumi: '/lumi',
};

/** Id místnosti z `?watch=` — nebo `null`, když tam nic rozumného není. */
export function watchRoom(search?: string): string | null {
  const query =
    search ?? (typeof window === 'undefined' ? '' : window.location.search);
  const value = new URLSearchParams(query).get('watch');
  if (!value) return null;
  return /^(arena|race|fight|moba|tanks)-\d{1,4}$/.test(value) ? value : null;
}

/** Odkaz na hlediště — jedno místo, kde se skládá. */
export function watchHref(game: GameId, roomId: string): string {
  return `${GAME_ROUTES[game]}?watch=${encodeURIComponent(roomId)}`;
}

/** Na které hře místnost je, podle prefixu id (pro odkazy z lobby). */
export function gameOfRoom(roomId: string): GameId | null {
  const prefix = roomId.split('-')[0];
  return (prefix as GameId) in GAME_ROUTES ? (prefix as GameId) : null;
}
