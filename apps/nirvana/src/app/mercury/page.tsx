'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import type * as THREE from 'three';
import { useI18n, tx } from '@/core/i18n';
import { MercurySolo, type DuelStats, type SoloFinish } from '@/core/fight/MercurySolo';
import { MercuryDuel, type DuelMpStats } from '@/core/fight/MercuryDuel';
import { MAX_HP, HILL_TARGET, type BotDifficulty, type FightMode } from '@/core/fight/ragdoll';
import { DuelFxOverlay, clearFx, type DuelFloater } from '@/core/fight/DuelFx';
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
 * MERKUR — ragdoll souboj ve čtyřech módech.
 *
 * `duel` (1v1 best of 3), `ball` (ragdoll fotbal), `survival` (vlny botů)
 * a `practice` (trénink proti figuríně). Všechny jedou na stejném enginu
 * `core/fight/ragdoll.ts`; solo proti botovi, duel navíc online.
 */

type Phase = 'idle' | 'playing';
type Source = 'solo' | 'online';

const MODES: { id: FightMode; title: DuelCopyKey; desc: DuelCopyKey }[] = [
  { id: 'duel', title: 'modeDuel', desc: 'modeDuelDesc' },
  { id: 'ball', title: 'modeBall', desc: 'modeBallDesc' },
  { id: 'survival', title: 'modeSurvival', desc: 'modeSurvivalDesc' },
  { id: 'practice', title: 'modePractice', desc: 'modePracticeDesc' },
  { id: 'koth', title: 'modeKoth', desc: 'modeKothDesc' },
];

const EMPTY_SOLO: DuelStats = {
  mode: 'duel',
  round: 1,
  phase: 'countdown',
  timer: 60,
  countdown: 3,
  selfHp: MAX_HP,
  foeHp: MAX_HP,
  selfWins: 0,
  foeWins: 0,
  winner: null,
  scoreSelf: 0,
  scoreFoe: 0,
  wave: 1,
  hits: 0,
  bestHit: 0,
  selfGuard: 1,
  foeGuard: 1,
  selfCombo: 0,
  foeCombo: 0,
  selfHill: 0,
  foeHill: 0,
  kickoff: null,
  contested: false,
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
  selfGuard: 1,
  foeGuard: 1,
  selfCombo: 0,
  foeCombo: 0,
};

/** Body za výhru: 2:0 = 200, 2:1 = 170; prohra počítá taky (100×kola − 30×soupeřova). */
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
  const [source, setSource] = useState<Source>('solo');
  const [selectedMode, setSelectedMode] = useState<FightMode>('duel');
  const [difficulty, setDifficulty] = useState<BotDifficulty>('standard');
  const [soloStats, setSoloStats] = useState<DuelStats>(EMPTY_SOLO);
  const [mpStats, setMpStats] = useState<DuelMpStats>(EMPTY_MP);
  const [notice, setNotice] = useState<string | null>(null);
  const recorded = useRef(false);
  /** Plovoucí čísla a kamera pro 2D overlay nad plátnem. */
  const fx = useRef<DuelFloater[]>([]);
  const cameraRef = useRef<THREE.Camera | null>(null);
  /** `?watch=<room>` = hlediště. Čte se v efektu (SSR `window` nemá). */
  const [watch, setWatch] = useState<string | null>(null);

  // během zápasu schovej globální dok a chat — na počítači i na mobilu
  useEffect(() => {
    document.body.dataset.playing = phase === 'playing' ? '1' : '';
    return () => {
      document.body.dataset.playing = '';
    };
  }, [phase]);

  // sólo výsledek (survival / ball / koth) — jednou za zápas
  const handleSoloFinish = useCallback(
    (result: SoloFinish) => {
      if (result.mode === 'duel' || result.mode === 'practice') return;
      const score =
        result.mode === 'survival'
          ? Math.max(0, (result.wave - 1) * 150 + result.hits * 4)
          : result.mode === 'koth'
            ? Math.max(
                0,
                Math.round(result.selfHill * 40 + result.hits * 3 + (result.winner === 'self' ? 150 : 0)),
              )
            : Math.max(0, result.scoreSelf * 120 - result.scoreFoe * 40);
      if (score <= 0) {
        setNotice(l('noPoints'));
        return;
      }
      const outcome = recordRun({
        game: 'fight',
        score,
        nickname: pickNickname(you?.name || 'hrac'),
        bonus: result.winner === 'self' ? 2 : 0,
      });
      setNotice(describeRun(outcome, cs, result.winner === 'self' ? [l('win')] : []));
    },
    [cs, l, you?.name],
  );

  // výsledek online duelu — zapíše se NA JEDNOU po `duel_end`
  useEffect(() => {
    if (watch) return;
    if (source !== 'online' || phase !== 'playing') return;
    if (mpStats.matchWinner === null) {
      recorded.current = false;
      return;
    }
    if (recorded.current) return;
    recorded.current = true;

    const won = mpStats.matchWinner === mpStats.selfId;
    const score = duelScore(mpStats.selfWins, mpStats.foeWins);
    if (score <= 0 || mpStats.foeIsBot) {
      setNotice(mpStats.foeIsBot ? l('botOpponent') : l('noPoints'));
      return;
    }

    const result = recordRun({
      game: 'fight',
      score,
      nickname: pickNickname(you?.name || 'hrac'),
      bonus: won ? 2 : 0,
    });
    setNotice(describeRun(result, cs, won ? [l('win')] : []));
  }, [source, phase, mpStats, cs, you?.name, watch, l]);

  const { store: xrStore, presenting } = useXr();
  useEffect(() => {
    const room = watchRoom();
    if (!room?.startsWith('fight-')) return;
    setWatch(room);
    setSource('online');
    setSelectedMode('duel');
    setPhase('playing');
  }, []);

  const mode: FightMode = source === 'online' ? 'duel' : selectedMode;
  const isBall = mode === 'ball';
  const isSurvival = mode === 'survival';
  const isPractice = mode === 'practice';
  const isKoth = mode === 'koth';
  const solo = source !== 'online';
  const state = solo ? soloStats.phase : mpStats.state;
  const countdown = solo ? soloStats.countdown : mpStats.countdown;
  const secondsLeft = solo ? soloStats.timer : mpStats.secondsLeft;
  const selfHp = solo ? soloStats.selfHp : mpStats.selfHp;
  const foeHp = solo ? soloStats.foeHp : mpStats.foeHp;
  const selfWins = solo ? soloStats.selfWins : mpStats.selfWins;
  const foeWins = solo ? soloStats.foeWins : mpStats.foeWins;
  const selfGuard = solo ? soloStats.selfGuard : mpStats.selfGuard;
  const foeGuard = solo ? soloStats.foeGuard : mpStats.foeGuard;
  const selfCombo = solo ? soloStats.selfCombo : mpStats.selfCombo;
  const foeCombo = solo ? soloStats.foeCombo : mpStats.foeCombo;
  const selfHill = solo ? soloStats.selfHill : 0;
  const foeHill = solo ? soloStats.foeHill : 0;
  const selfName = solo ? l('you') : mpStats.selfName;
  const foeName = solo ? (isPractice ? l('practiceShadow') : l('opponent')) : mpStats.foeName;
  const round = solo ? soloStats.round : mpStats.round;

  return (
    <main className="arena is-mercury">
      <div className="arena-stage">
        <Canvas
          dpr={canvasDpr(1.5)}
          camera={{ position: [0, 2, 12], fov: 50, near: 0.05, far: 200 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        >
          <XR store={xrStore}>
            {phase === 'playing' && source === 'online' ? (
              <MercuryDuel
                running
                xr={presenting}
                watch={watch}
                onStats={setMpStats}
                floaters={fx}
                cameraRef={cameraRef}
              />
            ) : (
              <MercurySolo
                key={`${selectedMode}-${phase}`}
                running={phase === 'playing'}
                xr={presenting}
                mode={selectedMode}
                selfAvatarId={you?.avatarId ?? null}
                foeAvatarId={42}
                botDifficulty={difficulty}
                onStats={setSoloStats}
                onFinish={handleSoloFinish}
                floaters={fx}
                cameraRef={cameraRef}
                goalLabel={l('goal')}
              />
            )}
          </XR>
        </Canvas>
        <DuelFxOverlay floaters={fx} cameraRef={cameraRef} />
      </div>

      {watch && <SpectatorBar room={watch} />}

      {phase === 'playing' && (
        <>
          {/* V hledišti exit není — odchod řeší SpectatorBar. */}
          {!watch && (
            <button
              type="button"
              className="duel-exit"
              aria-label={l('leaveDuel')}
              onClick={() => {
                setPhase('idle');
                setMpStats(EMPTY_MP);
                setSoloStats(EMPTY_SOLO);
                clearFx(fx.current);
                setNotice(null);
              }}
            >
              {l('menu')}
            </button>
          )}
          <div className="duel-vr">
            <VrButton xr={{ store: xrStore, presenting }} className="arena-vr" />
          </div>

          {!(source === 'online' && (!mpStats.connected || mpStats.state === null)) && (
            <div className="duel-top" aria-hidden>
              <div className="duel-fighter is-self">
                <div className="duel-name">{selfName}</div>
                {selfCombo >= 2 ? <span className="duel-combo">×{selfCombo}</span> : null}
                {isBall ? (
                  <div className="duel-score-big">{soloStats.scoreSelf}</div>
                ) : (
                  <>
                    <div className="duel-bar">
                      <i style={{ width: `${(selfHp / MAX_HP) * 100}%` }} className={selfHp <= 30 ? 'is-low' : undefined} />
                    </div>
                    <div className={`duel-guard${selfGuard <= 0.02 ? ' is-broken' : selfGuard < 0.3 ? ' is-low' : ''}`}>
                      <i style={{ width: `${Math.max(0, selfGuard) * 100}%` }} />
                    </div>
                    {isKoth && (
                      <div className="duel-hill-bar">
                        <i style={{ width: `${(selfHill / HILL_TARGET) * 100}%` }} />
                      </div>
                    )}
                    <div className="duel-pips">
                      {Array.from({ length: 2 }, (_, index) => (
                        <span key={index} className={index < selfWins ? 'is-on' : undefined} />
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="duel-clock">
                <div>
                  {isBall
                    ? l('modeBall')
                    : isSurvival
                      ? `${l('wave')} ${soloStats.wave}`
                      : isPractice
                        ? l('modePractice')
                        : isKoth
                          ? l('hill')
                          : `${l('round')} ${round}`}
                </div>
                <strong>
                  {state === 'countdown'
                    ? `…${countdown}`
                    : isBall || isSurvival || isPractice || isKoth
                      ? `${secondsLeft}s`
                      : `${secondsLeft}s`}
                </strong>
                <div className="duel-clock-sub">
                  {source === 'online'
                    ? mpStats.foeIsBot
                      ? l('waiting')
                      : mpStats.connected
                        ? `${mpStats.ping ?? 0} ms`
                        : l('offline')
                    : isBall
                      ? soloStats.kickoff
                        ? l('kickoff')
                        : l('ballHint')
                      : isSurvival
                        ? `${l('hits')}: ${soloStats.hits}`
                        : isPractice
                          ? `${l('bestHit')}: ${Math.round(soloStats.bestHit)} m/s`
                          : isKoth
                            ? soloStats.contested
                              ? l('contested')
                              : `${selfHill.toFixed(1)} : ${foeHill.toFixed(1)} · ${l('hillHold')}`
                            : l('vsBot')}
                </div>
              </div>
              <div className="duel-fighter is-foe">
                <div className="duel-name">{foeName}</div>
                {foeCombo >= 2 ? <span className="duel-combo">×{foeCombo}</span> : null}
                {isBall ? (
                  <div className="duel-score-big">{soloStats.scoreFoe}</div>
                ) : (
                  <>
                    <div className="duel-bar">
                      <i style={{ width: `${(foeHp / MAX_HP) * 100}%` }} className={foeHp <= 30 ? 'is-low' : undefined} />
                    </div>
                    <div className={`duel-guard${foeGuard <= 0.02 ? ' is-broken' : foeGuard < 0.3 ? ' is-low' : ''}`}>
                      <i style={{ width: `${Math.max(0, foeGuard) * 100}%` }} />
                    </div>
                    {isKoth && (
                      <div className="duel-hill-bar">
                        <i style={{ width: `${(foeHill / HILL_TARGET) * 100}%` }} />
                      </div>
                    )}
                    <div className="duel-pips">
                      {Array.from({ length: 2 }, (_, index) => (
                        <span key={index} className={index < foeWins ? 'is-on' : undefined} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {source === 'online' && (!mpStats.connected || mpStats.state === null) && (
            <div className="duel-status" role="status" aria-live="polite">
              <strong>{l('connecting')}</strong>
              <span>{mpStats.connected ? l('findingRing') : l('reconnecting')}</span>
            </div>
          )}

          {state === 'countdown' && <div className="duel-flash is-count">{countdown > 0 ? countdown : '…'}</div>}
          {state === 'roundEnd' && (
            <div className="duel-flash is-round">
              {source === 'online' && mpStats.lastRoundReason === 'ko' ? 'K.O.' : l('round')}
            </div>
          )}

          {source === 'online' && !watch && mpStats.matchWinner !== null && (
            <div className="arena-respawn">
              {duelScore(mpStats.selfWins, mpStats.foeWins) > 0 && mpStats.matchWinner === mpStats.selfId
                ? l('youWon')
                : l('youLost')}
              {notice ? ` · ${notice}` : ''}
            </div>
          )}

          {solo && soloStats.phase === 'matchEnd' && (
            <div className="duel-result" role="status" aria-live="polite">
              <strong>
                {isSurvival
                  ? `${l('survivalOver')} · ${l('wave')} ${soloStats.wave}`
                  : isBall
                    ? `${l('ballOver')} · ${soloStats.scoreSelf}:${soloStats.scoreFoe}`
                    : isKoth
                      ? `${l('hillWin')} · ${soloStats.selfHill.toFixed(1)}:${soloStats.foeHill.toFixed(1)}`
                      : soloStats.winner === 'self'
                        ? l('victory')
                        : l('defeat')}
              </strong>
              <span>{isBall || isSurvival || isKoth ? l('resultSaved') : l('practiceResets')}</span>
              {notice ? <span>{notice}</span> : null}
            </div>
          )}

          {!watch && <div className="arena-tip">{l('keysTip')}</div>}

          {!watch && (
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
          )}
        </>
      )}

      {phase === 'idle' && (
        <section className="arena-panel" aria-label="Merkur">
          <header>
            <strong>{l('title')}</strong>
            <span>{l('subtitle')}</span>
          </header>
          <p>{l('intro')}</p>

          <section className="duel-modes" aria-label={l('mode')}>
            {MODES.map((option) => (
              <button
                key={option.id}
                type="button"
                className="duel-mode"
                aria-pressed={selectedMode === option.id}
                onClick={() => setSelectedMode(option.id)}
              >
                <strong>{l(option.title)}</strong>
                <span>{l(option.desc)}</span>
              </button>
            ))}
          </section>

          <div className="arena-keys">
            <kbd>A/D</kbd> {l('moveShort')} · <kbd>W</kbd> {l('jumpShort')} · <kbd>J</kbd>{' '}
            {l('punchShort')} · <kbd>K</kbd> {l('kickShort')} · <kbd>S</kbd> {l('blockShort')}
          </div>

          <section className="duel-difficulty" aria-label={l('difficulty')}>
            <strong>{l('shadowSkill')}</strong>
            <div className="duel-difficulty-options">
              {([
                { id: 'gentle' as const, name: { cs: 'Klidný', en: 'Gentle', es: 'Tranquilo', pt: 'Tranquilo', fr: 'Calme' }, note: { cs: 'pomalejší reakce', en: 'slower reactions', es: 'reacciones más lentas', pt: 'reações mais lentas', fr: 'réactions lentes' } },
                { id: 'standard' as const, name: { cs: 'Vyrovnaný', en: 'Balanced', es: 'Equilibrado', pt: 'Equilibrado', fr: 'Équilibré' }, note: { cs: 'doporučeno', en: 'recommended', es: 'recomendado', pt: 'recomendado', fr: 'recommandé' } },
                { id: 'champion' as const, name: { cs: 'Mistr', en: 'Champion', es: 'Maestro', pt: 'Mestre', fr: 'Maître' }, note: { cs: 'rychlý blok a kop', en: 'quick guards & kicks', es: 'bloqueo y patada rápidos', pt: 'defesa e chutes rápidos', fr: 'gardes et coups rapides' } },
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

          <p className="duel-coach-tip">{l('coachTip')}</p>

          <div className="arena-actions">
            <button
              type="button"
              className="park-btn"
              onClick={() => {
                unlock();
                setSource('solo');
                setSoloStats(EMPTY_SOLO);
                clearFx(fx.current);
                setNotice(null);
                setPhase('playing');
              }}
            >
              {l('startMode')}
            </button>
            <button
              type="button"
              className="park-btn park-btn-mp"
              onClick={() => {
                unlock();
                setSource('online');
                setSelectedMode('duel');
                setMpStats(EMPTY_MP);
                setSoloStats(EMPTY_SOLO);
                clearFx(fx.current);
                setNotice(null);
                setPhase('playing');
              }}
            >
              {l('online')}
            </button>
          </div>
          {notice && <div className="arena-result">{notice}</div>}
          <GameBoard game="fight" className="duel-board-panel" />
          <nav className="duel-links" aria-label="Mars / Venus">
            <Link href="/mars" className="arena-link arena-small">
              {l('backToMars')}
            </Link>
            <Link href="/venus" className="arena-link arena-small">
              {l('toVenus')}
            </Link>
          </nav>
        </section>
      )}
    </main>
  );
}
