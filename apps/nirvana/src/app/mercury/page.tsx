'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import { useI18n, tx } from '@/core/i18n';
import { MercurySolo, type DuelStats } from '@/core/fight/MercurySolo';
import { MercuryDuel, type DuelMpStats } from '@/core/fight/MercuryDuel';
import { MAX_HP, type BotDifficulty } from '@/core/fight/duel';
import { describeRun, nickname as pickNickname, recordRun } from '@/core/progress/run';
import { GameBoard } from '@/core/games/GameBoard';
import { watchRoom } from '@/core/net/watch';
import { SpectatorBar } from '@/core/net/SpectatorBar';
import { unlock } from '@/core/audio/engine';
import { useNet } from '@/core/net/useNet';
import { useXr } from '@/core/xr';
import { VrButton } from '@/core/xr/VrButton';
import { XR } from '@react-three/xr';
import { canvasDpr } from '@/core/design/dpr';
import { DUEL_COPY, type DuelCopyKey } from './copy';

/**
 * MERKUR — souboj bok po boku. Sólo cvičení proti botovi i online duel
 * (best of 3). Skóre z online zápasu jde do stejné tabule jako aréna/závod.
 */

type Phase = 'idle' | 'playing';
type Mode = 'solo' | 'online';

const EMPTY_SOLO: DuelStats = {
  round: 1,
  phase: 'countdown',
  timer: 60,
  countdown: 3,
  selfHp: MAX_HP,
  foeHp: MAX_HP,
  selfWins: 0,
  foeWins: 0,
  winner: null,
};

const EMPTY_MP: DuelMpStats = {
  connected: false,
  ping: null,
  round: 1,
  state: null,
  countdown: 0,
  secondsLeft: 0,
  selfId: '',
  selfName: '…',
  foeName: '…',
  selfHp: MAX_HP,
  foeHp: MAX_HP,
  selfWins: 0,
  foeWins: 0,
  foeIsBot: true,
  matchWinner: null,
  lastRoundReason: null,
};

/** Body za výhru: 2:0 = 200, 2:1 = 170; prohra počítá body taky (100×vyhraná_kola − 30×soupeřova). */
function duelScore(selfWins: number, foeWins: number): number {
  return selfWins * 100 - foeWins * 30;
}

function TouchButton({
  code,
  label,
  ariaLabel = label,
}: {
  code: string;
  label: string;
  ariaLabel?: string;
}) {
  // syntetické klávesové události → `useFightKeys` má jeden vstupní tok
  const send = useCallback(
    (down: boolean) => {
      window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
    },
    [code],
  );
  return (
    <button
      type="button"
      className="duel-touch-btn"
      onPointerDown={(event) => {
        event.preventDefault();
        send(true);
      }}
      onPointerUp={() => send(false)}
      onPointerLeave={() => send(false)}
      onPointerCancel={() => send(false)}
      onLostPointerCapture={() => send(false)}
      onContextMenu={(event) => event.preventDefault()}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {label}
    </button>
  );
}

export default function MercuryPage() {
  const { lang } = useI18n();
  /** Texty obrazovky jdou přes `./copy` — žádné `cs ? :` v JSX. */
  const l = useCallback((key: DuelCopyKey) => tx(DUEL_COPY[key], lang), [lang]);
  const cs = lang === 'cs';
  const { you } = useNet();
  const [phase, setPhase] = useState<Phase>('idle');
  const [mode, setMode] = useState<Mode>('solo');
  const [difficulty, setDifficulty] = useState<BotDifficulty>('standard');
  const [soloStats, setSoloStats] = useState<DuelStats>(EMPTY_SOLO);
  const [mpStats, setMpStats] = useState<DuelMpStats>(EMPTY_MP);
  const [notice, setNotice] = useState<string | null>(null);
  const recorded = useRef(false);
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(hover: none) and (pointer: coarse)');
    setCoarse(query.matches);
    const onChange = () => setCoarse(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // během duelu na mobilu schovej navigaci a chat (celá obrazovka pro hru)
  useEffect(() => {
    if (!coarse) return;
    document.body.dataset.playing = phase === 'playing' ? '1' : '';
    return () => {
      document.body.dataset.playing = '';
    };
  }, [coarse, phase]);

  // výsledek online duelu — zapíše se NA JEDNOU po `duel_end`, příští zápas resetuje guard
  useEffect(() => {
    if (mode !== 'online' || phase !== 'playing') return;
    if (mpStats.matchWinner === null) {
      recorded.current = false;
      return;
    }
    if (recorded.current) return;
    recorded.current = true;

    const won = mpStats.matchWinner === mpStats.selfId;
    const score = duelScore(mpStats.selfWins, mpStats.foeWins);
    if (score <= 0 || mpStats.foeIsBot) {
      setNotice(
        mpStats.foeIsBot
          ? l('botOpponent')
          : l('noPoints'),
      );
      return;
    }

    const result = recordRun({
      game: 'fight',
      score,
      nickname: pickNickname(you?.name || 'hrac'),
      bonus: won ? 2 : 0,
    });
    setNotice(describeRun(result, cs, won ? [l('win')] : []));
  }, [mode, phase, mpStats, cs, you?.name]);

  const top = mode === 'online' ? mpStats : soloStats;
  const selfHp = mode === 'online' ? mpStats.selfHp : soloStats.selfHp;
  const foeHp = mode === 'online' ? mpStats.foeHp : soloStats.foeHp;
  const selfName = mode === 'online' ? mpStats.selfName : l('you');
  const foeName = mode === 'online' ? mpStats.foeName : l('practiceShadow');
  const round = mode === 'online' ? mpStats.round : soloStats.round;
  const countdown = mode === 'online' ? mpStats.countdown : soloStats.countdown;
  const secondsLeft = mode === 'online' ? mpStats.secondsLeft : soloStats.timer;
  const { store: xrStore, presenting } = useXr();
  /** `?watch=<room>` = hlediště. Čte se v efektu (SSR `window` nemá). */
  const [watch, setWatch] = useState<string | null>(null);
  useEffect(() => {
    const room = watchRoom();
    if (!room) return;
    setWatch(room);
    setMode('online');
    setPhase('playing');
  }, []);
  const state = mode === 'online' ? mpStats.state : soloStats.phase;
  const selfWins = mode === 'online' ? mpStats.selfWins : soloStats.selfWins;
  const foeWins = mode === 'online' ? mpStats.foeWins : soloStats.foeWins;

  return (
    <main className="arena is-mercury">
      <div className="arena-stage">
        <Canvas
          dpr={canvasDpr(1.5)}
          camera={{ position: [0, 2, 12], fov: 50, near: 0.05, far: 200 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        >
          <XR store={xrStore}>
            {phase === 'playing' && mode === 'online' ? (
              <MercuryDuel running xr={presenting} watch={watch} onStats={setMpStats} />
            ) : (
              <MercurySolo
                key={phase}
                running={phase === 'playing'}
                xr={presenting}
                selfAvatarId={you?.avatarId ?? null}
                foeAvatarId={mode === 'solo' ? 42 : null}
                botDifficulty={difficulty}
                onStats={setSoloStats}
              />
            )}
          </XR>
        </Canvas>
      </div>

      {watch && <SpectatorBar room={watch} />}

      {phase === 'playing' && (
        <>
          <button
            type="button"
            className="duel-exit"
            aria-label={l('leaveDuel')}
            onClick={() => {
              setPhase('idle');
              setMpStats(EMPTY_MP);
              setNotice(null);
            }}
          >
            {l('menu')}
          </button>
          <div className="duel-vr">
            <VrButton xr={{ store: xrStore, presenting }} className="arena-vr" />
          </div>

          {!(mode === 'online' && (!mpStats.connected || mpStats.state === null)) && <div className="duel-top" aria-hidden>
            <div className="duel-fighter is-self">
              <div className="duel-name">{selfName}</div>
              <div className="duel-bar">
                <i style={{ width: `${(selfHp / MAX_HP) * 100}%` }} className={selfHp <= 30 ? 'is-low' : undefined} />
              </div>
              <div className="duel-pips">
                {Array.from({ length: 2 }, (_, index) => (
                  <span key={index} className={index < selfWins ? 'is-on' : undefined} />
                ))}
              </div>
            </div>
            <div className="duel-clock">
              <div>{l('round')} {round}</div>
              <strong>{state === 'countdown' ? `…${countdown}` : `${secondsLeft}s`}</strong>
              <div className="duel-clock-sub">
                {mode === 'online'
                  ? mpStats.foeIsBot
                    ? l('waiting')
                    : mpStats.connected
                      ? `${mpStats.ping ?? 0} ms`
                      : l('offline')
                  : l('practice')}
              </div>
            </div>
            <div className="duel-fighter is-foe">
              <div className="duel-name">{foeName}</div>
              <div className="duel-bar">
                <i style={{ width: `${(foeHp / MAX_HP) * 100}%` }} className={foeHp <= 30 ? 'is-low' : undefined} />
              </div>
              <div className="duel-pips">
                {Array.from({ length: 2 }, (_, index) => (
                  <span key={index} className={index < foeWins ? 'is-on' : undefined} />
                ))}
              </div>
            </div>
          </div>}

          {mode === 'online' && (!mpStats.connected || mpStats.state === null) && (
            <div className="duel-status" role="status" aria-live="polite">
              <strong>{l('connecting')}</strong>
              <span>{mpStats.connected ? (l('findingRing')) : (l('reconnecting'))}</span>
            </div>
          )}

          {state === 'countdown' && <div className="duel-flash is-count">{countdown > 0 ? countdown : '…'}</div>}
          {top && state === 'roundEnd' && (
            <div className="duel-flash is-round">
              {mode === 'online' && mpStats.lastRoundReason === 'ko' ? 'K.O.' : l('round')}
            </div>
          )}
          {mode === 'online' && mpStats.matchWinner !== null && (
            <div className="arena-respawn">
              {duelScore(mpStats.selfWins, mpStats.foeWins) > 0 && mpStats.matchWinner === mpStats.selfId
                ? l('youWon')
                : l('youLost')}
              {notice ? ` · ${notice}` : ''}
            </div>
          )}
          {mode === 'solo' && soloStats.phase === 'matchEnd' && (
            <div className="duel-result" role="status" aria-live="polite">
              <strong>{soloStats.winner === 'self' ? (l('victory')) : (l('defeat'))}</strong>
              <span>{l('practiceResets')}</span>
            </div>
          )}

          <div className="arena-tip">
            {cs
              ? 'A/D pohyb · W skok · J pěst · K kop · S blok'
              : 'A/D move · W jump · J punch · K kick · S block'}
          </div>

          <div className="duel-touch" aria-label="ovládání">
            <div className="duel-touch-row">
              <TouchButton code="KeyA" label="←" ariaLabel={l('left')} />
              <TouchButton code="KeyD" label="→" ariaLabel={l('right')} />
            </div>
            <div className="duel-touch-row">
              <TouchButton code="KeyJ" label="J" ariaLabel={l('punch')} />
              <TouchButton code="KeyK" label="K" ariaLabel={l('kick')} />
              <TouchButton code="KeyS" label={l('blockShort')} ariaLabel={l('block')} />
              <TouchButton code="Space" label={l('jumpShort')} ariaLabel={l('jump')} />
            </div>
          </div>
        </>
      )}

      {phase === 'idle' && (
        <section className="arena-panel" aria-label="Merkur">
          <header>
            <strong>{l('title')}</strong>
            <span>best of 3 · 60 s</span>
          </header>
          <p>
            {l('intro')}
          </p>
          <div className="arena-keys">
            <kbd>A/D</kbd> {l('moveShort')} · <kbd>W</kbd> {l('jumpShort')} · <kbd>J</kbd>{' '}
            {l('punchShort')} · <kbd>K</kbd> {l('kickShort')} · <kbd>S</kbd> {l('blockShort')}
          </div>
          <section className="duel-difficulty" aria-label={l('difficulty')}>
            <strong>{l('shadowSkill')}</strong>
            <div className="duel-difficulty-options">
              {([
                { id: 'gentle' as const, name: { cs: 'Klidný', en: 'Gentle', es: 'Tranquilo' }, note: { cs: 'pomalejší reakce', en: 'slower reactions', es: 'reacciones más lentas' } },
                { id: 'standard' as const, name: { cs: 'Vyrovnaný', en: 'Balanced', es: 'Equilibrado' }, note: { cs: 'doporučeno', en: 'recommended', es: 'recomendado' } },
                { id: 'champion' as const, name: { cs: 'Mistr', en: 'Champion', es: 'Maestro' }, note: { cs: 'rychlý blok a kop', en: 'quick guards & kicks', es: 'bloqueo y patada rápidos' } },
              ]).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="duel-difficulty-option"
                  aria-pressed={difficulty === option.id}
                  onClick={() => setDifficulty(option.id)}
                >
                  <strong>{tx(option.name, lang)}</strong>
                  <span>{tx(option.note, lang)}</span>
                </button>
              ))}
            </div>
          </section>
          <p className="duel-coach-tip">
            {l('coachTip')}
          </p>
          <div className="arena-actions">
            <button
              type="button"
              className="park-btn"
              onClick={() => {
                unlock();
                setMode('solo');
                setNotice(null);
                setPhase('playing');
              }}
            >
              {l('practiceVsBot')}
            </button>
            <button
              type="button"
              className="park-btn park-btn-mp"
              onClick={() => {
                unlock();
                setMode('online');
                setMpStats(EMPTY_MP);
                setNotice(null);
                setPhase('playing');
              }}
            >
              {l('online')}
            </button>
          </div>
          {notice && <div className="arena-result">{notice}</div>}
          <GameBoard game="fight" className="duel-board-panel" />
          <Link href="/mars" className="arena-link arena-small">
            {l('backToMars')}
          </Link>
          <Link href="/venus" className="arena-link arena-small">
            {l('toVenus')}
          </Link>
        </section>
      )}
    </main>
  );
}
