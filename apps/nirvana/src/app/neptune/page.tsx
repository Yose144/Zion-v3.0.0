'use client';

/**
 * NEPTUN — HLUBINA (`/neptune`).
 *
 * Planeta, která byla do 2026-11-11 jen „místo" (dosier bez hry), je teď
 * hratelný svět. Stránka drží menu, HUD a zápis dohraného sestupu; fyzika je
 * v `core/neptun/dive.ts`, scéna v `NeptuneScene.tsx`, data světa ve
 * `world.ts`. Dosier planety zůstal — hra ho nevytlačila, je v menu.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import { XR } from '@react-three/xr';
import { fill, tx, useI18n } from '@/core/i18n';
import { NEPTUN_COPY, type NeptunCopyKey } from '@/core/neptun/copy';
import { NeptuneScene, type NeptunStats } from '@/core/neptun/NeptuneScene';
import { DECKS, DEPTH_BOTTOM, MAX_ENERGY, MOTES, MOTE_SCORE, BOTTOM_BONUS } from '@/core/neptun/world';
import { type DiveResult } from '@/core/neptun/dive';
import { OUTER_WORLDS } from '@/core/outer/worlds';
import { describeRun, nickname as pickNickname, recordRun } from '@/core/progress/run';
import { GameBoard } from '@/core/games/GameBoard';
import { TouchButton, TouchPad } from '@/core/games/TouchPad';
import { play, unlock } from '@/core/audio/engine';
import { useXr } from '@/core/xr';
import { VrButton } from '@/core/xr/VrButton';
import { canvasDpr } from '@/core/design/dpr';

type Phase = 'menu' | 'diving' | 'over';

const EMPTY: NeptunStats = {
  depth: 0,
  energy: 100,
  hull: 100,
  lights: 0,
  totalLights: MOTES.length,
  wind: 0,
  deck: 0,
  sink: 0,
  score: 0,
  elapsed: 0,
  end: null,
  moteDx: null,
  moteDy: null,
  event: null,
  eventId: 0,
};

function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const s = safe - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

export default function NeptunePage() {
  const { lang } = useI18n();
  const l = useCallback(
    (key: NeptunCopyKey, values?: Record<string, string | number>) => {
      const text = tx(NEPTUN_COPY[key], lang);
      return values ? fill(text, values) : text;
    },
    [lang],
  );
  const cs = lang === 'cs';

  const [phase, setPhase] = useState<Phase>('menu');
  const [stats, setStats] = useState<NeptunStats>(EMPTY);
  const [result, setResult] = useState<DiveResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastKey, setToastKey] = useState(0);
  const [record, setRecord] = useState(false);
  const [coarse, setCoarse] = useState(false);

  const { store: xrStore, presenting } = useXr();
  const world = OUTER_WORLDS.neptune;

  useEffect(() => {
    const query = window.matchMedia('(hover: none) and (pointer: coarse)');
    setCoarse(query.matches);
    const onChange = () => setCoarse(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // během sestupu schovej globální dok a chat
  useEffect(() => {
    document.body.dataset.playing = phase === 'diving' ? '1' : '';
    return () => {
      document.body.dataset.playing = '';
    };
  }, [phase]);

  // hlášky z událostí (světlo, vír, náraz, vrstva) — 2 s
  useEffect(() => {
    if (!stats.event || stats.eventId === 0) return;
    const key: NeptunCopyKey =
      stats.event === 'light'
        ? 'toastMote'
        : stats.event === 'vortex'
          ? 'toastVortex'
          : stats.event === 'wall'
            ? 'toastWall'
            : stats.event === 'deck'
              ? 'toastDeck'
              : 'toastMote';
    if (stats.event === 'bottom' || stats.event === 'lantern' || stats.event === 'hull') return;
    setToast(l(key));
    setToastKey(stats.eventId);
    // klíč se mění s událostí — časovač se restartuje i při dvou stejných hláškách
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
    setPhase('diving');
    play('lanternIgnite');
  }, []);

  const finish = useCallback(
    (outcome: DiveResult) => {
      setResult(outcome);
      setPhase('over');
      const run = recordRun({ game: 'neptune', score: outcome.score, nickname: pickNickname() });
      setRecord(run.personalBest);
      setNotice(describeRun(run, cs));
    },
    [cs],
  );

  const diving = phase === 'diving';
  const deck = DECKS[stats.deck] ?? DECKS[0];
  // kompas: 0° = dolů, 90° = vpravo
  const compassAngle = (Math.atan2(stats.moteDx ?? 0, stats.moteDy ?? 1) * 180) / Math.PI;

  return (
    <main className="arena neptune">
      <div className="arena-stage">
        <Canvas
          dpr={canvasDpr(1.75)}
          camera={{ position: [1.1, 1.4, 8.6], fov: 58, near: 0.1, far: 1400 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        >
          <XR store={xrStore}>
            <NeptuneScene running={diving} xr={presenting} onStats={setStats} onFinish={finish} />
          </XR>
        </Canvas>
      </div>

      {diving && (
        <>
          <div className="neptune-depth">
            <span className="neptune-depth-value">{stats.depth}</span>
            <span className="neptune-depth-unit">m</span>
            <i style={{ width: `${Math.min(100, (stats.depth / DEPTH_BOTTOM) * 100)}%` }} />
            <em>
              {tx(deck.name, lang)} · {DEPTH_BOTTOM - stats.depth} m
            </em>
          </div>

          <div className="race-hud neptune-hud">
            <span className={`neptune-gauge is-energy${stats.energy < 25 ? ' is-low' : ''}`} title={l('hudEnergy')}>
              <em aria-hidden>✦</em>
              <span className="neptune-track">
                <i style={{ width: `${Math.max(0, Math.min(100, (stats.energy / MAX_ENERGY) * 100))}%` }} />
              </span>
            </span>
            <span className={`neptune-gauge is-hull${stats.hull < 30 ? ' is-low' : ''}`} title={l('hudHull')}>
              <em aria-hidden>◆</em>
              <span className="neptune-track">
                <i style={{ width: `${Math.max(0, Math.min(100, stats.hull))}%` }} />
              </span>
            </span>
            <span className="neptune-lights" title={l('hudLights')}>
              <em aria-hidden>✧</em> {stats.lights}/{stats.totalLights}
            </span>
            <span className="neptune-wind" title={l('hudWind')}>
              <svg viewBox="0 0 16 16" aria-hidden style={{ transform: `rotate(${stats.wind >= 0 ? 90 : -90}deg)` }}>
                <path d="M8 2 L11 9 L8 7.6 L5 9 Z" />
              </svg>
              {Math.abs(stats.wind).toFixed(1)}
            </span>
            <span className="race-best">
              {l('hudScore')} {stats.score}
            </span>
            {stats.moteDx !== null && (
              <span className="neptune-compass" title={l('compassMote')}>
                <svg viewBox="0 0 24 24" aria-hidden style={{ transform: `rotate(${compassAngle}deg)` }}>
                  <path d="M12 3 L17 19 L12 16 L7 19 Z" />
                </svg>
                {Math.round(Math.hypot(stats.moteDx, stats.moteDy ?? 0))} m
              </span>
            )}
            <VrButton xr={{ store: xrStore, presenting }} className="arena-vr" />
            <button type="button" className="game-exit" onClick={() => setPhase('menu')}>
              {l('menu')}
            </button>
          </div>

          {coarse && (
            <TouchPad>
              <TouchButton code="KeyW" className="is-up">
                ↓
              </TouchButton>
              <TouchButton code="KeyS" className="is-down">
                ↑
              </TouchButton>
              <TouchButton code="KeyA" className="is-left">
                ←
              </TouchButton>
              <TouchButton code="KeyD" className="is-right">
                →
              </TouchButton>
            </TouchPad>
          )}

          {toast && <div className="race-go neptune-toast">{toast}</div>}
        </>
      )}

      {phase !== 'diving' && (
        <section className="arena-panel neptune-panel">
          <header>
            <strong>{l('title')}</strong>
            <span>{l('kicker')}</span>
          </header>

          {phase === 'menu' && (
            <>
              <p className="neptune-lead">{tx(world.epithet, lang)} — {l('subtitle')}</p>
              <p>{l('intro')}</p>

              <div className="neptune-decks">
                {DECKS.map((item) => (
                  <span
                    key={item.id}
                    className="neptune-deck"
                    style={{ ['--deck' as string]: item.tint }}
                    title={tx(item.note, lang)}
                  >
                    <i aria-hidden />
                    {tx(item.name, lang)}
                  </span>
                ))}
              </div>

              <div className="neptune-facts">
                <p className="neptune-facts-title">{l('factsTitle')}</p>
                <dl>
                  {world.facts.map((fact) => (
                    <div key={fact.label.en}>
                      <dt>{tx(fact.label, lang)}</dt>
                      <dd>{tx(fact.value, lang)}</dd>
                    </div>
                  ))}
                </dl>
                <p className="neptune-facts-note">{l('factsNote')}</p>
              </div>

              <ul className="arena-keys">
                <li>
                  <kbd>A</kbd>/<kbd>D</kbd> {l('keySteer')}
                </li>
                <li>
                  <kbd>W</kbd>/<kbd>↑</kbd> {l('keyDive')}
                </li>
                <li>
                  <kbd>S</kbd>/<kbd>↓</kbd> {l('keyBrake')}
                </li>
              </ul>
              <p className="arena-small">{l('hint')}</p>

              <div className="arena-actions">
                <button type="button" className="park-btn" onClick={start}>
                  {l('start')}
                </button>
                <Link href="/uranus" className="arena-link">
                  {l('backArchive')}
                </Link>
                <Link href="/" className="arena-link">
                  {l('backUniverse')}
                </Link>
              </div>

              <GameBoard game="neptune" className="race-board-panel" />
            </>
          )}

          {phase === 'over' && result && (
            <>
              <p className={`race-verdict ${result.end === 'bottom' ? 'win' : ''}`}>
                {result.end === 'bottom' ? l('endBottom') : result.end === 'hull' ? l('endHull') : l('endLantern')}
              </p>
              <div className="arena-result">
                <div>
                  <em>{l('resultScore')}</em>
                  <strong>{result.score}</strong>
                </div>
                <div>
                  <em>{l('resultDepth')}</em>
                  <strong>{result.depth} m</strong>
                </div>
                <div>
                  <em>{l('resultLights')}</em>
                  <strong>
                    {result.lights}/{result.totalLights}
                  </strong>
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
                {result.depth} m + {result.lights} × {MOTE_SCORE}
                {result.end === 'bottom' ? ` + ${BOTTOM_BONUS}` : ''} = {result.score}
              </p>
            </>
          )}
        </section>
      )}
    </main>
  );
}
