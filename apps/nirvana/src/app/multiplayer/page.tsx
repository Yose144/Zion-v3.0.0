'use client';

/**
 * LOBBY — jedno místo, kde je vidět, co se právě hraje.
 *
 * Proč samostatná stránka: multiplayer měla každá hra schovaný za svým
 * tlačítkem a člověk neměl jak zjistit, jestli vůbec někdo hraje. Server
 * posílá **živý seznam místností** (`rooms`, protokol 22), takže lobby
 * ukazuje skutečný stav, ne odhad.
 *
 * Lobby nic nesimuluje: jen čte `useNet().rooms` a posílá `join`. Když
 * server mlčí (offline), stránka to řekne a hry jdou hrát dál sólo.
 */

import Link from 'next/link';
import { useI18n } from '@/core/i18n';
import { useNet } from '@/core/net/useNet';
import type { GameId, RoomState } from '@/core/net/protocol';

interface LobbyGame {
  id: GameId;
  href: string;
  title: { cs: string; en: string };
  note: { cs: string; en: string };
  glyph: string;
  tone: string;
  /** Kapacita, když ještě žádná místnost není otevřená. */
  seats: number;
}

const GAMES: LobbyGame[] = [
  {
    id: 'moba',
    href: '/earth',
    title: { cs: 'První svět', en: 'First World' },
    note: { cs: 'MOBA · 5 na 5 · mlha války', en: 'MOBA · 5v5 · fog of war' },
    glyph: '🌍',
    tone: '#7fe3d4',
    seats: 10,
  },
  {
    id: 'arena',
    href: '/mars',
    title: { cs: 'Mars aréna', en: 'Mars arena' },
    note: { cs: 'deathmatch · 10 fragů', en: 'deathmatch · 10 frags' },
    glyph: '🎯',
    tone: '#ff7a6b',
    seats: 8,
  },
  {
    id: 'race',
    href: '/venus',
    title: { cs: 'Venuše', en: 'Venus' },
    note: { cs: 'okruh · 3 kola', en: 'circuit · 3 laps' },
    glyph: '🏁',
    tone: '#c8f56a',
    seats: 8,
  },
  {
    id: 'fight',
    href: '/mercury',
    title: { cs: 'Merkur — souboj', en: 'Mercury — duel' },
    note: { cs: 'best of 3 · 1 na 1', en: 'best of 3 · 1v1' },
    glyph: '⚔',
    tone: '#e8a15c',
    seats: 2,
  },
  {
    id: 'tanks',
    href: '/saturn',
    title: { cs: 'Saturn — tanky', en: 'Saturn — tanks' },
    note: { cs: 'artilerie · 1 na 1', en: 'artillery · 1v1' },
    glyph: '💥',
    tone: '#ffd166',
    seats: 2,
  },
];

const STATE_LABEL: Record<RoomState, { cs: string; en: string }> = {
  waiting: { cs: 'čeká na hráče', en: 'waiting' },
  running: { cs: 'hraje se', en: 'running' },
  ended: { cs: 'do sehrávky', en: 'finished' },
};

export default function MultiplayerPage() {
  const { lang } = useI18n();
  const cs = lang === 'cs';
  const { status, online, rooms, roomId, joinGame, joinRoom, leaveRoom } = useNet();

  const roomsFor = (game: LobbyGame) =>
    rooms.filter((room) => room.game === game.id).sort((a, b) => b.players - a.players);

  const myGame = GAMES.find((game) => rooms.find((room) => room.id === roomId && room.game === game.id));

  return (
    <main className="lobby">
      <header className="lobby-chrome">
        <div>
          <strong>MULTIPLAYER</strong>
          <span>{cs ? 'kdo právě hraje' : 'who is playing right now'}</span>
        </div>
        <Link href="/" className="lobby-back">
          ← Nirvana
        </Link>
      </header>

      <p className="lobby-status">
        <span className={`lobby-dot is-${status}`} aria-hidden />
        {status === 'open'
          ? cs
            ? `připojeno · ${online} ${online === 1 ? 'člověk' : 'lidí'} v parku · ${rooms.length} otevřených místností`
            : `connected · ${online} online · ${rooms.length} open rooms`
          : status === 'connecting'
            ? cs
              ? 'připojuji…'
              : 'connecting…'
            : cs
              ? 'server neodpovídá — hry jdou hrát sólo'
              : 'server offline — games still work solo'}
      </p>

      {roomId && (
        <section className="lobby-mine">
          <strong>{cs ? 'Jsi v místnosti' : 'You are in room'} {roomId}</strong>
          {myGame ? (
            <Link href={myGame.href} className="lobby-btn is-primary">
              {cs ? 'Otevřít hru' : 'Open the game'} →
            </Link>
          ) : null}
          <button type="button" className="lobby-btn" onClick={leaveRoom}>
            {cs ? 'Odejít' : 'Leave'}
          </button>
        </section>
      )}

      <section className="lobby-grid">
        {GAMES.map((game) => {
          const open = roomsFor(game);
          const busiest = open[0];
          return (
            <article key={game.id} className="lobby-card" style={{ ['--tone' as string]: game.tone }}>
              <header>
                <span className="lobby-glyph" aria-hidden>
                  {game.glyph}
                </span>
                <div>
                  <h2>{game.title[lang]}</h2>
                  <p>{game.note[lang]}</p>
                </div>
                <span className="lobby-count">
                  {open.reduce((sum, room) => sum + room.players, 0)}/{busiest?.maxPlayers ?? game.seats}
                </span>
              </header>

              {open.length === 0 ? (
                <p className="lobby-empty">
                  {cs ? 'nikdo nehraje — založ místnost' : 'nobody is playing — start a room'}
                </p>
              ) : (
                <ul className="lobby-rooms">
                  {open.slice(0, 4).map((room) => (
                    <li key={room.id}>
                      <span className="lobby-room-id">{room.id}</span>
                      <span className={`lobby-room-state is-${room.state}`}>
                        {STATE_LABEL[room.state][lang]}
                      </span>
                      <span className="lobby-room-players">
                        {room.players}/{room.maxPlayers}
                      </span>
                      <button
                        type="button"
                        className="lobby-join"
                        disabled={room.players >= room.maxPlayers}
                        onClick={() => joinRoom(game.id, room.id)}
                      >
                        {cs ? 'Připojit' : 'Join'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="lobby-actions">
                <button
                  type="button"
                  className="lobby-btn is-primary"
                  onClick={() => joinGame(game.id)}
                >
                  {busiest && busiest.players < busiest.maxPlayers
                    ? cs
                      ? 'Rychlá hra'
                      : 'Quick match'
                    : cs
                      ? 'Založit místnost'
                      : 'Start a room'}
                </button>
                <Link href={game.href} className="lobby-btn">
                  {cs ? 'Sólo' : 'Solo'}
                </Link>
              </div>
            </article>
          );
        })}
      </section>

      <p className="lobby-note">
        {cs
          ? 'Po připojení otevři hru — server si tě zapamatuje. Prázdná sedla v aréně, MOBA i tancích doplní boti.'
          : 'After joining, open the game — the server remembers you. Empty seats are filled by bots in the arena, MOBA and tanks.'}
      </p>
    </main>
  );
}
