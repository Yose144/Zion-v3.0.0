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

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/core/i18n';
import { useNet } from '@/core/net/useNet';
import { watchHref } from '@/core/net/watch';
import { ChatPanel } from '@/core/net/ChatPanel';
import { InviteButton } from '@/core/net/InviteButton';
import type { GameId, RoomMode, RoomState } from '@/core/net/protocol';

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
  const { status, you, online, rooms, roomId, joinGame, joinRoom, leaveRoom, lastError } = useNet();
  const [invite, setInvite] = useState<string | null>(null);
  const [inviteHandled, setInviteHandled] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Pozvánka je v URL (`/multiplayer?room=tanks-1`), ne v nějakém stavu —
  // odkaz tak jde poslat chatem a funguje i po reloadu.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setInvite(params.get('room'));
  }, []);

  useEffect(() => {
    /**
     * `status === 'open'` znamená otevřený socket, ale server ještě nemusel
     * zpracovat `hello` — join by pak skončil na `bad_frame`. Identita
     * (`you`) je důkaz, že handshake proběhl.
     */
    if (!invite || inviteHandled || status !== 'open' || !you) return;
    const game = invite.split('-')[0] as GameId;
    if (!GAMES.some((entry) => entry.id === game)) {
      setInviteHandled(true);
      return;
    }
    joinRoom(game, invite);
    setInviteHandled(true);
  }, [invite, inviteHandled, status, you, joinRoom]);

  const [manual, setManual] = useState<string | null>(null);
  /**
   * Režim nových místností. `humans` je pro hraní s pozvaným: prázdná sedla
   * nedoplní boti, takže se dá počkat. Ukládá se, aby volba nezmizela.
   */
  const [mode, setMode] = useState<RoomMode>('bots');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('nirvana.lobby.mode');
      if (saved === 'humans' || saved === 'bots') setMode(saved);
    } catch {
      /* privátní režim */
    }
  }, []);

  const pickMode = useCallback((next: RoomMode) => {
    setMode(next);
    try {
      window.localStorage.setItem('nirvana.lobby.mode', next);
    } catch {
      /* nic */
    }
  }, []);

  const copy = useCallback(async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setManual(null);
    } catch {
      // Bez oprávnění ke schránce se **nesmí** otevřít `window.prompt`
      // (blokuje stránku). Ukážeme pole, ze kterého jde text označit.
      setManual(text);
    }
    setCopied(what);
    window.setTimeout(() => setCopied(null), 1600);
  }, []);

  const inviteLink = (id: string) =>
    typeof window === 'undefined' ? '' : `${window.location.origin}/multiplayer?room=${encodeURIComponent(id)}`;

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
          <InviteButton
            roomId={roomId}
            className="lobby-btn is-invite"
            label={{ cs: 'Pozvat odkazem', en: 'Copy invite link' }}
          />
          <button type="button" className="lobby-btn" onClick={() => copy(roomId, 'code')}>
            {copied === 'code' ? (cs ? 'kód ✓' : 'code ✓') : cs ? 'Kód' : 'Code'}
          </button>
          <button type="button" className="lobby-btn" onClick={leaveRoom}>
            {cs ? 'Odejít' : 'Leave'}
          </button>
        </section>
      )}

      {lastError && <p className="lobby-error">{lastError}</p>}

      {manual && (
        <div className="lobby-manual">
          <input
            readOnly
            value={manual}
            aria-label={cs ? 'pozvánka' : 'invite'}
            onFocus={(event) => event.currentTarget.select()}
          />
          <button type="button" className="lobby-btn" onClick={() => setManual(null)}>
            ×
          </button>
        </div>
      )}

      <div className="lobby-mode" role="group" aria-label={cs ? 'režim nových místností' : 'new room mode'}>
        <span>{cs ? 'Nové místnosti' : 'New rooms'}</span>
        <button
          type="button"
          className={mode === 'bots' ? 'is-active' : ''}
          aria-pressed={mode === 'bots'}
          onClick={() => pickMode('bots')}
        >
          🤖 {cs ? 's boty' : 'with bots'}
        </button>
        <button
          type="button"
          className={mode === 'humans' ? 'is-active' : ''}
          aria-pressed={mode === 'humans'}
          onClick={() => pickMode('humans')}
        >
          👤 {cs ? 'jen lidé' : 'humans only'}
        </button>
        <em>
          {mode === 'humans'
            ? cs
              ? 'počká na pozvané — žádní boti'
              : 'waits for invitees — no bots'
            : cs
              ? 'prázdná sedla doplní boti hned'
              : 'empty seats filled by bots'}
        </em>
      </div>

      <div className="lobby-body">
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
                      <span className="lobby-room-id">
                        {room.mode === 'humans' ? '👤' : '🤖'} {room.id}
                      </span>
                      <span className={`lobby-room-state is-${room.state}`}>
                        {STATE_LABEL[room.state][lang]}
                      </span>
                      <span className="lobby-room-players">
                        {room.players}/{room.maxPlayers}
                      </span>
                      <button
                        type="button"
                        className="lobby-link"
                        title={cs ? 'zkopírovat pozvánku' : 'copy invite'}
                        aria-label={cs ? 'zkopírovat pozvánku' : 'copy invite'}
                        onClick={() => copy(inviteLink(room.id), room.id)}
                      >
                        {copied === room.id ? '✓' : '🔗'}
                      </button>
                      <button
                        type="button"
                        className="lobby-join"
                        disabled={room.players >= room.maxPlayers}
                        onClick={() => joinRoom(game.id, room.id)}
                      >
                        {cs ? 'Připojit' : 'Join'}
                      </button>
                      {/* Dívat se dá i na plnou místnost — divák nezabírá sedlo. */}
                      <a className="lobby-watch" href={watchHref(game.id, room.id)}>
                        {cs ? 'Dívat se' : 'Watch'}
                      </a>
                    </li>
                  ))}
                </ul>
              )}

              <div className="lobby-actions">
                <button
                  type="button"
                  className="lobby-btn is-primary"
                  onClick={() => joinGame(game.id, undefined, undefined, mode)}
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

      {/* Chat je tady, ne jen v plovoucím doku: v lobby se domlouváš,
          než do hry vůbec vstoupíš. Stejná komponenta jako dok. */}
      <section className="lobby-chat" aria-label={cs ? 'chat' : 'chat'}>
        <ChatPanel variant="inline" />
      </section>
      </div>

      <p className="lobby-note">
        {cs
          ? 'Po připojení otevři hru — server si tě zapamatuje. Prázdná sedla v aréně, MOBA i tancích doplní boti.'
          : 'After joining, open the game — the server remembers you. Empty seats are filled by bots in the arena, MOBA and tanks.'}
      </p>
    </main>
  );
}
