/**
 * Texty lobby (`/multiplayer`) — jeden slovník, tři jazyky (L-10).
 *
 * Lobby je rozcestník celé Nirvany, takže jde do španělštiny mezi prvními.
 * Názvy her a jména hráčů zůstávají v datech, tady jsou jen popisky.
 */
import type { Localized } from '@/core/i18n';

export const LOBBY_COPY = {
  whoPlays: { cs: 'kdo právě hraje', en: 'who is playing right now', es: 'quién está jugando ahora' },
  inRoom: { cs: 'Jsi v místnosti', en: 'You are in room', es: 'Estás en la sala' },
  openGame: { cs: 'Otevřít hru', en: 'Open the game', es: 'Abrir el juego' },
  codeCopied: { cs: 'kód ✓', en: 'code ✓', es: 'código ✓' },
  code: { cs: 'Kód', en: 'Code', es: 'Código' },
  leave: { cs: 'Odejít', en: 'Leave', es: 'Salir' },
  invite: { cs: 'pozvánka', en: 'invite', es: 'invitación' },
  newRoomMode: { cs: 'režim nových místností', en: 'new room mode', es: 'modo de salas nuevas' },
  newRooms: { cs: 'Nové místnosti', en: 'New rooms', es: 'Salas nuevas' },
  withBots: { cs: 's boty', en: 'with bots', es: 'con bots' },
  humansOnly: { cs: 'jen lidé', en: 'humans only', es: 'solo personas' },
  nobody: {
    cs: 'nikdo nehraje — založ místnost',
    en: 'nobody is playing — start a room',
    es: 'nadie está jugando — crea una sala',
  },
  copyInvite: { cs: 'zkopírovat pozvánku', en: 'copy invite', es: 'copiar invitación' },
  join: { cs: 'Připojit', en: 'Join', es: 'Unirse' },
  watch: { cs: 'Dívat se', en: 'Watch', es: 'Ver' },
  solo: { cs: 'Sólo', en: 'Solo', es: 'Solo' },
  chat: { cs: 'chat', en: 'chat', es: 'chat' },
} as const satisfies Record<string, Localized>;

export type LobbyCopyKey = keyof typeof LOBBY_COPY;
