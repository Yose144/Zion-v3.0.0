'use client';

/**
 * TE PĪKO ORA — vodní hry v laguně.
 *
 * Stránka drží jen menu, HUD a zápis dohrané hry. Fyzika je v `core/piko/`
 * (`canoe.ts`, `surf.ts`), scéna v `core/piko/PikoScene.tsx`.
 *
 * Dvě hry, jedna tabule: skóre kánoe i surfu je kalibrované na stejný rozsah
 * (0–1200), takže se dají srovnávat a denní výzva má jeden cíl.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import { XR } from '@react-three/xr';
import { fill, tx, useI18n } from '@/core/i18n';
import { PIKO_COPY, type PikoCopyKey } from '@/core/piko/copy';
import { PikoScene, type PikoResult, type PikoStats } from '@/core/piko/PikoScene';
import { PIKO_GATES } from '@/core/piko/world';
import { SURF } from '@/core/piko/surf';
import { describeRun, nickname as pickNickname, recordRun } from '@/core/progress/run';
import { GameBoard } from '@/core/games/GameBoard';
import { TouchButton, TouchPad } from '@/core/games/TouchPad';
import { unlock } from '@/core/audio/engine';
import { useXr } from '@/core/xr';
import { VrButton } from '@/core/xr/VrButton';
import { canvasDpr } from '@/core/design/dpr';
import type { PikoMode } from '@/core/piko/world';

type Phase = 'menu' | 'playing' | 'over';

const EMPTY: PikoStats = {
  mode: 'canoe',
  phase: 'idle',
  score: 0,
  elapsed: 0,
  speed: 0,
  gates: 0,
  totalGates: PIKO_GATES.length,
  wave: 0,
  totalWaves: SURF.waves,
  balance: 100,
  pocket: 0,
  x: 0,
  pocketX: 0,
  distance: 0,
  waveTimer: 0,
  started: false,
  finished: false,
  event: null,
  eventId: 0,
};

function format(seconds: number): string {
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const s = safe - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

export default function PikoPage() {
  const { lang } = useI18n();
  const l = useCallback(
    (key: PikoCopyKey, values?: Record<string, string | number>) => {
      const text = tx(PIKO_COPY[key], lang);
      return values ? fill(text, values) : text;
    },
    [lang],
  );
  const cs = lang === 'cs';

  const [mode, setMode] = useState<PikoMode>('canoe');
  const [phase, setPhase] = useState<Phase>('menu');
  const [stats, setStats] = useState<PikoStats>(EMPTY);
  const [result, setResult] = useState<PikoResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  /** Dotyk: čtyři tlačítka místo klávesnice. */
  const [coarse, setCoarse] = useState(false);
  const seenEvent = useRef(0);

  const { store: xrStore, presenting } = useXr();

  useEffect(() => {
    const query = window.matchMedia('(hover: none) and (pointer: coarse)');
    setCoarse(query.matches);
    const onChange = () => setCoarse(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // během hry schovej globální dok a chat — jinak zbývá na hru půlka displeje
  useEffect(() => {
    document.body.dataset.playing = phase === 'playing' ? '1' : '';
    return () => {
      document.body.dataset.playing = '';
    };
  }, [phase]);

  // hlášky z událostí (bóje, pád, uvíznutí) — ukazují se 2,2 s
  useEffect(() => {
    if (!stats.event || stats.eventId === seenEvent.current) return;
    seenEvent.current = stats.eventId;
    const key: PikoCopyKey | null =
      stats.event === 'gate'
        ? 'gateHit'
        : stats.event === 'takeoff'
          ? 'takeoff'
          : stats.event === 'wipeout'
            ? 'wipeout'
            : stats.event === 'bogged'
              ? 'bogged'
              : stats.event === 'wave'
                ? 'cleanWave'
                : null;
    if (!key) return;
    setToast(l(key));
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [stats.event, stats.eventId, l]);

  const start = useCallback(
    (next: PikoMode = mode) => {
      unlock();
      seenEvent.current = 0;
      setMode(next);
      setStats(EMPTY);
      setResult(null);
      setNotice(null);
      setToast(null);
      setPhase('playing');
    },
    [mode],
  );

  const finish = useCallback(
    (outcome: PikoResult) => {
      setResult(outcome);
      setPhase('over');
      const run = recordRun({ game: 'piko', score: outcome.score, nickname: pickNickname() });
      setNotice(describeRun(run, cs));
    },
    [cs],
  );

  const sailing = phase === 'playing';
  const canoe = mode === 'canoe';

  return (
    <main className="arena piko">
      <div className="arena-stage">
        <Canvas
          dpr={canvasDpr(1.75)}
          camera={{ position: [0, 8, 32], fov: 60, near: 0.1, far: 2600 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        >
          <XR store={xrStore}>
            <PikoScene
              mode={mode}
              running={sailing}
              xr={presenting}
              onStats={setStats}
              onFinish={finish}
            />
          </XR>
        </Canvas>
      </div>

      {sailing && coarse && (
        <TouchPad>
          <TouchButton code="KeyW" className="is-up">
            {l(canoe ? 'touchPaddle' : 'touchPaddle')}
          </TouchButton>
          <TouchButton code="KeyS" className="is-down">
            {l('touchBrace')}
          </TouchButton>
          <TouchButton code="KeyA" className="is-left">
            ←
          </TouchButton>
          <TouchButton code="KeyD" className="is-right">
            →
          </TouchButton>
        </TouchPad>
      )}

      {sailing && (
        <div className="race-hud piko-hud">
          <span className="race-speed">{stats.speed} km/h</span>
          {canoe ? (
            <>
              <span className="race-pos">
                {l('gates')} {stats.gates}/{stats.totalGates}
              </span>
              <span>{format(stats.elapsed)}</span>
            </>
          ) : (
            <>
              <span className="race-pos">
                {l('waveOf', { n: stats.wave, total: stats.totalWaves })}
              </span>
              <span>{format(stats.elapsed)}</span>
              <span className={`piko-pocket${stats.pocket > 0.6 ? ' is-in' : ''}`}>
                {l('pocket')} {stats.pocketX - stats.x < -5 ? '◀' : stats.pocketX - stats.x > 5 ? '▶' : '•'}
              </span>
              <span className="piko-balance" aria-label={l('balance')}>
                <i style={{ width: `${Math.max(0, Math.min(100, stats.balance))}%` }} />
              </span>
            </>
          )}
          <span className="race-best">
            {l('score')} {stats.score}
          </span>
          <VrButton xr={{ store: xrStore, presenting }} className="arena-vr" />
          <button type="button" className="game-exit" onClick={() => setPhase('menu')}>
            {l('menu')}
          </button>
        </div>
      )}

      {sailing && toast && <div className="race-go piko-toast">{toast}</div>}

      {sailing && canoe && !stats.started && <div className="race-go">{l('paddleNow')}</div>}

      {sailing && !canoe && stats.phase !== 'riding' && (
        <div className="race-go piko-countdown">
          {stats.waveTimer > 0
            ? `${l('waitingWave')} ${stats.waveTimer.toFixed(1)}`
            : l('waitingWave')}
        </div>
      )}

      {phase !== 'playing' && (
        <section className="arena-panel piko-panel">
          <header>
            <strong>{l('title')}</strong>
            <span>{l('kicker')}</span>
          </header>

          {phase === 'menu' && (
            <>
              <p>{l('intro')}</p>

              <div className="piko-modes">
                {(['canoe', 'surf'] as const).map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`piko-mode${mode === id ? ' is-active' : ''}`}
                    onClick={() => setMode(id)}
                    aria-pressed={mode === id}
                  >
                    <em aria-hidden>{id === 'canoe' ? '🛶' : '🏄'}</em>
                    <strong>{l(id === 'canoe' ? 'modeCanoe' : 'modeSurf')}</strong>
                    <span>{l(id === 'canoe' ? 'modeCanoeNote' : 'modeSurfNote')}</span>
                  </button>
                ))}
              </div>

              <ul className="arena-keys">
                <li>
                  <kbd>W</kbd>/<kbd>↑</kbd> {l(canoe ? 'keyPaddle' : 'keyPump')}
                </li>
                <li>
                  <kbd>S</kbd>/<kbd>↓</kbd> {l('keyBrace')}
                </li>
                <li>
                  <kbd>A</kbd>/<kbd>D</kbd> {l('keySteer')}
                </li>
              </ul>
              <p className="arena-small">{l(canoe ? 'hintCanoe' : 'hintSurf')}</p>

              <div className="arena-actions">
                <button type="button" className="park-btn" onClick={() => start()}>
                  {l(canoe ? 'startCanoe' : 'startSurf')}
                </button>
                <Link href="/park" className="arena-link">
                  {l('backToFair')}
                </Link>
                <Link href="/" className="arena-link">
                  {l('backToUniverse')}
                </Link>
              </div>

              <GameBoard game="piko" className="race-board-panel" />
            </>
          )}

          {phase === 'over' && result && (
            <>
              <p className="race-verdict win">
                {l(result.mode === 'canoe' ? 'finishedCanoe' : 'finishedSurf')}
              </p>
              <div className="arena-result">
                <div>
                  <em>{l('resultScore')}</em>
                  <strong>{result.score}</strong>
                </div>
                <div>
                  <em>{l('resultTime')}</em>
                  <strong>{format(result.elapsed)}</strong>
                </div>
                {result.mode === 'canoe' ? (
                  <div>
                    <em>{l('resultGates')}</em>
                    <strong>
                      {result.gates}/{PIKO_GATES.length}
                    </strong>
                  </div>
                ) : (
                  <>
                    <div>
                      <em>{l('resultWaves')}</em>
                      <strong>
                        {result.waves}/{SURF.waves}
                      </strong>
                    </div>
                    <div>
                      <em>{l('resultDistance')}</em>
                      <strong>{result.distance} m</strong>
                    </div>
                    <div>
                      <em>{l('resultWipes')}</em>
                      <strong>{result.wipes}</strong>
                    </div>
                  </>
                )}
              </div>
              {notice && <p className="arena-notice">{notice}</p>}
              <div className="arena-actions">
                <button type="button" className="park-btn" onClick={() => start(result.mode)}>
                  {l('again')}
                </button>
                <button
                  type="button"
                  className="park-btn park-btn-mp"
                  onClick={() => {
                    const other: PikoMode = result.mode === 'canoe' ? 'surf' : 'canoe';
                    setMode(other);
                    setPhase('menu');
                  }}
                >
                  {l('switchMode')}
                </button>
                <Link href="/park" className="arena-link">
                  {l('backToFair')}
                </Link>
              </div>
            </>
          )}

          {phase === 'menu' && <p className="arena-small">{l('chooseMode')}</p>}
        </section>
      )}
    </main>
  );
}
