'use client';

/**
 * TE PĪKO ORA — vodní hry v laguně.
 *
 * Stránka drží menu, HUD, pas (medaile + skiny) a zápis dohrané hry.
 * Fyzika je v `core/piko/` (`canoe.ts`, `surf.ts`), scéna v `PikoScene.tsx`,
 * progrese v `passport.ts` a duch v `ghost.ts`.
 *
 * Dvě hry, jedna tabule: skóre kánoe i surfu je kalibrované na stejný rozsah,
 * takže se dají srovnávat a denní výzva má jeden cíl.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import { XR } from '@react-three/xr';
import { fill, tx, useI18n } from '@/core/i18n';
import { PIKO_COPY, type PikoCopyKey } from '@/core/piko/copy';
import { PikoScene, type PikoResult, type PikoStats } from '@/core/piko/PikoScene';
import { PikoMinimap } from '@/core/piko/PikoMinimap';
import { PIKO_GATES } from '@/core/piko/world';
import { SURF } from '@/core/piko/surf';
import {
  PIKO_MEDALS,
  activeSkin,
  applyRun,
  emptyPassport,
  loadPassport,
  medalRank,
  savePassport,
  setSkin,
  skinsFor,
  type Medal,
  type PikoPassport,
} from '@/core/piko/passport';
import { describeRun, nickname as pickNickname, recordRun } from '@/core/progress/run';
import { GameBoard } from '@/core/games/GameBoard';
import { TouchButton, TouchPad } from '@/core/games/TouchPad';
import { play, unlock } from '@/core/audio/engine';
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
  z: 0,
  pocketX: 0,
  heading: 0,
  nextGate: 0,
  windAngle: 0,
  windStrength: 0,
  flow: 0,
  combo: 1,
  air: 0,
  tricks: 0,
  waveDistance: 0,
  distance: 0,
  ghostX: null,
  ghostZ: null,
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

interface ProResult {
  medal: Medal;
  improved: boolean;
  newSkins: { id: string; name: { cs: string; en: string; es?: string } }[];
  ghostSaved: boolean;
}

const MEDALS = ['bronze', 'silver', 'gold'] as const;

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
  const [pro, setPro] = useState<ProResult | null>(null);
  const [passport, setPassport] = useState<PikoPassport>(emptyPassport);
  /** Dotyk: kromě čtyř směrů ještě trik (jen surf). */
  const [coarse, setCoarse] = useState(false);

  const { store: xrStore, presenting } = useXr();
  const skin = activeSkin(passport, mode);
  const ghost = passport.ghost[mode];

  useEffect(() => {
    setPassport(loadPassport());
    const onFocus = () => setPassport(loadPassport());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

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

  // hlášky z událostí (bóje, pád, vzduch, přistání) — ukazují se 2,2 s
  useEffect(() => {
    if (!stats.event || stats.eventId === 0) return;
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
                : stats.event === 'air'
                  ? 'air'
                  : stats.event === 'landing'
                    ? 'landing'
                    : null;
    if (!key) return;
    setToast(l(key));
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [stats.event, stats.eventId, l]);

  const start = useCallback(
    (next: PikoMode = mode) => {
      unlock();
      setMode(next);
      setStats(EMPTY);
      setResult(null);
      setNotice(null);
      setPro(null);
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

      // pas: medaile, rekord, odemčené skiny, duch
      const applied = applyRun(passport, {
        mode: outcome.mode,
        score: outcome.score,
        elapsed: outcome.elapsed,
        ghostPoints: outcome.ghost,
      });
      savePassport(applied.passport);
      setPassport(applied.passport);
      setPro({
        medal: applied.medal,
        improved: applied.improved,
        newSkins: applied.newSkins.map((item) => ({ id: item.id, name: item.name })),
        ghostSaved: applied.ghostSaved,
      });
      if (applied.improved) play('medal');
    },
    [cs, passport],
  );

  const chooseSkin = useCallback(
    (id: string) => {
      const next = setSkin(passport, mode, id);
      if (!next || next === passport) return;
      savePassport(next);
      setPassport(next);
      play('click');
    },
    [passport, mode],
  );

  const medalLabel = useCallback(
    (medal: Medal) =>
      l(
        medal === 'gold'
          ? 'medalGold'
          : medal === 'silver'
            ? 'medalSilver'
            : medal === 'bronze'
              ? 'medalBronze'
              : 'medalNone',
      ),
    [l],
  );

  const sailing = phase === 'playing';
  const canoe = mode === 'canoe';
  const windRotation = ((stats.windAngle + stats.heading) * 180) / Math.PI - 90;

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
              skin={skin}
              ghost={ghost}
              onStats={setStats}
              onFinish={finish}
            />
          </XR>
        </Canvas>
      </div>

      {sailing && (
        <PikoMinimap
          stats={{
            mode,
            x: stats.x,
            z: stats.z,
            heading: stats.heading,
            gates: stats.gates,
            nextGate: stats.nextGate,
            distance: stats.waveDistance,
            waveProgress: canoe ? 0 : stats.waveDistance / SURF.length,
            wave: stats.wave,
            totalWaves: stats.totalWaves,
            pocketX: stats.pocketX,
            combo: stats.combo,
            flow: stats.flow,
            windAngle: stats.windAngle,
          }}
          ghost={stats.ghostX !== null && stats.ghostZ !== null ? { x: stats.ghostX, z: stats.ghostZ } : null}
        />
      )}

      {sailing && coarse && (
        <TouchPad>
          <TouchButton code="KeyW" className="is-up">
            {l('touchPaddle')}
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
          {!canoe && (
            <TouchButton code="Space" className="piko-trick">
              {l('trick')}
            </TouchButton>
          )}
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
              <span className="piko-wind" title={l('wind')}>
                <svg viewBox="0 0 16 16" style={{ transform: `rotate(${windRotation}deg)` }} aria-hidden>
                  <path d="M8 1.5 L12.4 12 L8 9.4 L3.6 12 Z" />
                </svg>
              </span>
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
              <span className={`piko-combo${stats.combo > 2 ? ' is-hot' : ''}`}>
                ×{stats.combo.toFixed(1)}
              </span>
              {stats.air > 0 && <span className="piko-air">{l('air')}</span>}
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

              <div className="piko-pro">
                <div className="piko-pro-head">
                  <span>{l('passport')}</span>
                  <span>
                    {passport.runs} {l('passes')}
                  </span>
                </div>
                <div className="piko-medals">
                  {MEDALS.map((medal) => (
                    <span
                      key={medal}
                      className={`piko-medal is-${medal}${
                        medalRank(passport.medals[mode]) >= medalRank(medal) ? ' is-earned' : ''
                      }`}
                      title={medalLabel(medal)}
                    >
                      <i aria-hidden>{medal === 'gold' ? '🥇' : medal === 'silver' ? '🥈' : '🥉'}</i>
                      <strong>{medalLabel(medal)}</strong>
                      <em>{l('medalTarget', { n: PIKO_MEDALS[mode][medal] })}</em>
                    </span>
                  ))}
                </div>
                <div className="piko-pro-stats">
                  <span>
                    {l('bestScore')} <strong>{passport.best[mode] || '—'}</strong>
                  </span>
                  <span>
                    {l('bestTime')}{' '}
                    <strong>
                      {passport.bestTime[mode] !== null ? format(passport.bestTime[mode] as number) : '—'}
                    </strong>
                  </span>
                </div>
                <div className="piko-skins">
                  <span className="piko-pro-title">{l('skins')}</span>
                  <div className="piko-skin-row">
                    {skinsFor(mode).map((item) => {
                      const unlocked = medalRank(passport.medals[mode]) >= medalRank(item.unlock);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={!unlocked}
                          className={`piko-skin${skin.id === item.id ? ' is-active' : ''}${
                            unlocked ? '' : ' is-locked'
                          }`}
                          onClick={() => chooseSkin(item.id)}
                          title={unlocked ? tx(item.name, lang) : l('skinLocked', { medal: medalLabel(item.unlock) })}
                        >
                          <i aria-hidden style={{ background: item.hull ?? item.deck ?? '#7fe3d4' }} />
                          <span>{tx(item.name, lang)}</span>
                          {!unlocked && <em aria-hidden>🔒</em>}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <p className="piko-ghost-note">{ghost ? l('ghostSaved') : l('ghostNone')}</p>
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
                {!canoe && (
                  <li>
                    <kbd>Space</kbd> {l('trick')}
                  </li>
                )}
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
                      <em>{l('resultTricks')}</em>
                      <strong>{result.tricks}</strong>
                    </div>
                    <div>
                      <em>{l('resultWipes')}</em>
                      <strong>{result.wipes}</strong>
                    </div>
                  </>
                )}
              </div>
              {pro && (
                <p className="piko-pro-result">
                  {pro.improved && <span className="is-record">{l('newRecord')}</span>}
                  {pro.medal !== 'none' && (
                    <span>{l('newMedal', { medal: medalLabel(pro.medal) })}</span>
                  )}
                  {pro.newSkins.map((item) => (
                    <span key={item.id}>{l('unlockedSkin', { name: tx(item.name, lang) })}</span>
                  ))}
                  {pro.ghostSaved && <span>{l('ghostSaved')}</span>}
                </p>
              )}
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
        </section>
      )}
    </main>
  );
}
