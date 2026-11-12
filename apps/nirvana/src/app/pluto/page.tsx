'use client';

/**
 * PLUTO — SRDCE NA OKRAJI (`/pluto`).
 *
 * Byl to poslední dosier bez hry (`OuterWorldPage`). Teď je to klidová
 * pochůzka: rozsviť devět lamp na zmrzlé pláni ve tvaru srdce a nezamrzni
 * cestou. Fyzika je v `core/pluto/light.ts`, scéna v `PlutoScene.tsx`,
 * data ve `world.ts`; dosier planety zůstal v menu.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import { XR } from '@react-three/xr';
import { tx, useI18n } from '@/core/i18n';
import { PLUTO_COPY, type PlutoCopyKey } from '@/core/pluto/copy';
import { PlutoScene, type PlutoStats } from '@/core/pluto/PlutoScene';
import { PlutoMinimap } from '@/core/pluto/PlutoMinimap';
import { COMPLETE_BONUS, LAMP_SCORE, LAMPS, LIGHT_TIME, WARMTH_MAX, WARMTH_SCORE } from '@/core/pluto/world';
import type { LightResult } from '@/core/pluto/light';
import { OUTER_WORLDS } from '@/core/outer/worlds';
import { describeRun, nickname as pickNickname, recordRun } from '@/core/progress/run';
import { GameBoard } from '@/core/games/GameBoard';
import { TouchButton, TouchPad } from '@/core/games/TouchPad';
import { play, unlock } from '@/core/audio/engine';
import { useXr } from '@/core/xr';
import { VrButton } from '@/core/xr/VrButton';
import { canvasDpr } from '@/core/design/dpr';

type Phase = 'menu' | 'walking' | 'over';

const EMPTY: PlutoStats = {
  x: 0,
  z: 60,
  warmth: 100,
  lamps: 0,
  totalLamps: LAMPS.length,
  warmDistance: 0,
  channel: 0,
  channelId: null,
  reach: 0,
  score: 0,
  elapsed: 0,
  end: null,
  nextDx: null,
  nextDz: null,
  nextDistance: null,
  nextId: null,
  litMask: LAMPS.map(() => false),
  vx: 0,
  vz: 0,
  event: null,
  eventId: 0,
};

function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const s = safe - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

export default function PlutoPage() {
  const { lang } = useI18n();
  const l = useCallback((key: PlutoCopyKey) => tx(PLUTO_COPY[key], lang), [lang]);
  const cs = lang === 'cs';

  const [phase, setPhase] = useState<Phase>('menu');
  const [stats, setStats] = useState<PlutoStats>(EMPTY);
  const [result, setResult] = useState<LightResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastKey, setToastKey] = useState(0);
  const [record, setRecord] = useState(false);
  const [coarse, setCoarse] = useState(false);

  const { store: xrStore, presenting } = useXr();
  const world = OUTER_WORLDS.pluto;

  useEffect(() => {
    const query = window.matchMedia('(hover: none) and (pointer: coarse)');
    setCoarse(query.matches);
    const onChange = () => setCoarse(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    document.body.dataset.playing = phase === 'walking' ? '1' : '';
    return () => {
      document.body.dataset.playing = '';
    };
  }, [phase]);

  useEffect(() => {
    if (!stats.event || stats.eventId === 0) return;
    if (stats.event === 'complete' || stats.event === 'frozen') return;
    const key: PlutoCopyKey =
      stats.event === 'lit' ? 'toastLit' : stats.event === 'cold' ? 'toastCold' : 'toastWarm';
    setToast(l(key));
    setToastKey(stats.eventId);
  }, [stats.eventId, stats.event, l]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2000);
    return () => window.clearTimeout(timer);
  }, [toast, toastKey]);

  const start = useCallback(() => {
    unlock();
    setStats(EMPTY);
    setResult(null);
    setNotice(null);
    setRecord(false);
    setToast(null);
    setPhase('walking');
    play('lanternIgnite');
  }, []);

  const finish = useCallback(
    (outcome: LightResult) => {
      setResult(outcome);
      setPhase('over');
      const run = recordRun({
        game: 'pluto',
        score: outcome.score,
        nickname: pickNickname(),
        metrics: {
          seconds: outcome.elapsed,
          completed: outcome.end === 'complete',
          objectives: outcome.lamps,
          objectivesTotal: outcome.totalLamps,
        },
      });
      setRecord(run.personalBest);
      setNotice(describeRun(run, cs));
    },
    [cs],
  );

  const walking = phase === 'walking';
  // kompas: 0° = nahoru (sever), 90° = vpravo
  const compass = (Math.atan2(stats.nextDx ?? 0, -(stats.nextDz ?? -1)) * 180) / Math.PI;
  const warmRatio = Math.max(0, Math.min(100, (stats.warmth / WARMTH_MAX) * 100));
  // `LIGHT_TIME` je jediný zdroj délky zapalování — zkopírované 1,5 by se rozešlo
  const channelRatio = stats.channelId ? Math.min(1, stats.channel / LIGHT_TIME) : 0;

  return (
    <main className="arena pluto">
      <div className="arena-stage">
        <Canvas
          dpr={canvasDpr(1.75)}
          camera={{ position: [1.5, 30, 22], fov: 55, near: 0.1, far: 420 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        >
          <XR store={xrStore}>
            <PlutoScene running={walking} xr={presenting} onStats={setStats} onFinish={finish} />
          </XR>
        </Canvas>
      </div>
      <div className="pluto-vignette" aria-hidden />

      {walking && (
        <PlutoMinimap
          x={stats.x}
          z={stats.z}
          vx={stats.vx}
          vz={stats.vz}
          lamps={stats.lamps}
          litMask={stats.litMask}
          nextId={stats.nextId}
        />
      )}

      {walking && (
        <>
          <div className={`pluto-warmth${stats.warmth < 25 ? ' is-low' : ''}`}>
            <span className="pluto-warmth-label">{l('hudWarmth')}</span>
            <span className="pluto-warmth-track">
              <i style={{ width: `${warmRatio}%` }} />
            </span>
            <span className="pluto-warmth-value">{stats.warmth}</span>
            {stats.warmth < 25 && <em>{l('toastCold')}</em>}
          </div>

          <div className="race-hud pluto-hud">
            <span className="pluto-lamps" title={l('hudLamps')}>
              <em aria-hidden>🕯</em> {stats.lamps}/{stats.totalLamps}
            </span>
            <span className="race-best">
              {l('hudScore')} {stats.score}
            </span>
            <span className="pluto-reach" title={l('hudReach')}>
              {l('hudReach')} {stats.reach} m
            </span>
            {stats.nextDx !== null && (
              <span className="pluto-compass" title={l('compassLamp')}>
                <svg viewBox="0 0 24 24" aria-hidden style={{ transform: `rotate(${compass}deg)` }}>
                  <path d="M12 3 L17 19 L12 16 L7 19 Z" />
                </svg>
                {Math.round(stats.nextDistance ?? 0)} m
              </span>
            )}
            <span className="pluto-clock">{formatTime(stats.elapsed)}</span>
            <VrButton xr={{ store: xrStore, presenting }} className="arena-vr" />
            <button type="button" className="game-exit" onClick={() => setPhase('menu')}>
              {l('menu')}
            </button>
          </div>

          {stats.channelId !== null && (
            <div className="pluto-channel">
              <span>{l('channel')}</span>
              <i style={{ width: `${channelRatio * 100}%` }} />
            </div>
          )}

          {coarse && (
            <TouchPad>
              <TouchButton code="KeyW" className="is-up">
                ↑
              </TouchButton>
              <TouchButton code="KeyS" className="is-down">
                ↓
              </TouchButton>
              <TouchButton code="KeyA" className="is-left">
                ←
              </TouchButton>
              <TouchButton code="KeyD" className="is-right">
                →
              </TouchButton>
            </TouchPad>
          )}

          {toast && <div className="race-go pluto-toast">{toast}</div>}
        </>
      )}

      {phase !== 'walking' && (
        <section className="arena-panel pluto-panel">
          <header>
            <strong>{l('title')}</strong>
            <span>{l('kicker')}</span>
          </header>

          {phase === 'menu' && (
            <>
              <p className="pluto-lead">{l('subtitle')}</p>
              <p>{l('intro')}</p>

              <ol className="pluto-lamps-list">
                {LAMPS.map((lamp) => (
                  <li key={lamp.id}>
                    <em aria-hidden>{lamp.id}</em>
                    {tx(lamp.name, lang)}
                  </li>
                ))}
              </ol>

              <div className="planet-facts">
                <p className="planet-facts-title">{l('factsTitle')}</p>
                <dl>
                  {world.facts.map((fact) => (
                    <div key={fact.label.en}>
                      <dt>{tx(fact.label, lang)}</dt>
                      <dd>{tx(fact.value, lang)}</dd>
                    </div>
                  ))}
                </dl>
                <p className="planet-facts-note">{l('factsNote')}</p>
              </div>

              <ul className="arena-keys">
                <li>
                  <kbd>W</kbd>
                  <kbd>A</kbd>
                  <kbd>S</kbd>
                  <kbd>D</kbd> {l('keyMove')}
                </li>
                <li>{l('keyLight')}</li>
              </ul>
              <p className="arena-small">{l('hint')}</p>

              <div className="arena-actions">
                <button type="button" className="park-btn" onClick={start}>
                  {l('start')}
                </button>
                <Link href="/neptune" className="arena-link">
                  ← {l('backArchive')}
                </Link>
                <Link href="/" className="arena-link">
                  {l('backUniverse')}
                </Link>
              </div>

              <GameBoard game="pluto" className="race-board-panel" />
            </>
          )}

          {phase === 'over' && result && (
            <>
              <p className={`race-verdict ${result.end === 'complete' ? 'win' : ''}`}>
                {result.end === 'complete' ? l('endComplete') : l('endFrozen')}
              </p>
              <div className="arena-result">
                <div>
                  <em>{l('resultScore')}</em>
                  <strong>{result.score}</strong>
                </div>
                <div>
                  <em>{l('resultLamps')}</em>
                  <strong>
                    {result.lamps}/{result.totalLamps}
                  </strong>
                </div>
                <div>
                  <em>{l('resultWarmth')}</em>
                  <strong>{result.warmth}</strong>
                </div>
                <div>
                  <em>{l('resultTime')}</em>
                  <strong>{formatTime(result.elapsed)}</strong>
                </div>
              </div>
              {record && <p className="neptune-record">{l('newRecord')}</p>}
              {notice && <p className="arena-notice">{notice}</p>}
              <div className="arena-actions">
                <button type="button" className="park-btn" onClick={start}>
                  {l('again')}
                </button>
                <button type="button" className="park-btn park-btn-mp" onClick={() => setPhase('menu')}>
                  {l('menu')}
                </button>
                <Link href="/" className="arena-link">
                  {l('backUniverse')}
                </Link>
              </div>
              <p className="arena-small">
                {result.lamps} × {LAMP_SCORE} + {result.warmth} × {WARMTH_SCORE}
                {result.end === 'complete' ? ` + ${COMPLETE_BONUS}` : ''} = {result.score}
              </p>
            </>
          )}
        </section>
      )}
    </main>
  );
}
