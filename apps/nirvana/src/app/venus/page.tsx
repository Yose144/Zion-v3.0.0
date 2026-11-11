'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import { useI18n, tx } from '@/core/i18n';
import { VenusRace, type RaceResult, type RaceStats } from '@/core/race/VenusRace';
import { VenusMultiplayer, type MpRaceStats } from '@/core/race/VenusMultiplayer';
import { LAPS, raceScore } from '@/core/race/track';
import type { StandingRow } from '@/core/race/rivals';
import { describeRun, nickname as pickNickname, recordRun } from '@/core/progress/run';
import { GameBoard } from '@/core/games/GameBoard';
import { watchRoom } from '@/core/net/watch';
import { SpectatorBar } from '@/core/net/SpectatorBar';
import { TouchButton, TouchPad } from '@/core/games/TouchPad';
import { unlock } from '@/core/audio/engine';
import { XR } from '@react-three/xr';
import { useXr } from '@/core/xr';
import { VrButton } from '@/core/xr/VrButton';
import { canvasDpr } from '@/core/design/dpr';
import { RACE_COPY, type RaceCopyKey } from './copy';

/** VENUŠE — tři kola proti třem soupeřům. Čas, pořadí, osobní rekord a tabule. */

type Phase = 'idle' | 'playing' | 'over';

const EMPTY: RaceStats = {
  speed: 0,
  lap: 1,
  laps: LAPS,
  elapsed: 0,
  lastLap: null,
  bestLap: null,
  offTrack: false,
  started: false,
  position: 1,
  standings: [],
  nitro: 1,
  drifting: false,
  boosting: false,
};

/** Žetony za pódium — jediná odměna, která závisí na soupeřích, ne na čase. */
const PODIUM_TOKENS = [3, 2, 1];

function format(seconds: number | null): string {
  if (seconds === null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

export default function VenusPage() {
  const { lang } = useI18n();
  /** Texty obrazovky jdou přes `./copy` — žádné `cs ? :` v JSX. */
  const l = useCallback((key: RaceCopyKey) => tx(RACE_COPY[key], lang), [lang]);
  const cs = lang === 'cs';
  const [phase, setPhase] = useState<Phase>('idle');
  const [stats, setStats] = useState<RaceStats>(EMPTY);
  const [result, setResult] = useState<RaceResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mp, setMp] = useState(false);
  const [mpStats, setMpStats] = useState<MpRaceStats | null>(null);
  /** Dotykové ovládání — na mobilu plyn/brzda/zatáčení místo WASD. */
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(hover: none) and (pointer: coarse)');
    setCoarse(query.matches);
    const onChange = () => setCoarse(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // během hry schovej globální dok a chat — na počítači i na mobilu
  useEffect(() => {
    document.body.dataset.playing = phase === 'playing' ? '1' : '';
    return () => {
      document.body.dataset.playing = '';
    };
  }, [phase]);

  const finish = useCallback(
    (outcome: RaceResult) => {
      setResult(outcome);
      setPhase('over');
      const score = raceScore(outcome.totalSeconds, outcome.laps);
      const podium = PODIUM_TOKENS[outcome.position - 1] ?? 0;
      const result = recordRun({
        game: 'race',
        score,
        nickname: pickNickname(),
        bonus: podium,
        metrics: {
          seconds: outcome.totalSeconds,
          completed: true,
          objectives: outcome.laps,
          objectivesTotal: outcome.laps,
        },
      });
      setNotice(describeRun(result, cs));
    },
    [cs],
  );

  const { store: xrStore, presenting } = useXr();
  /** `?watch=<room>` = hlediště. Čte se v efektu (SSR `window` nemá). */
  const [watch, setWatch] = useState<string | null>(null);
  useEffect(() => {
    const room = watchRoom();
    if (!room?.startsWith('race-')) return;
    setWatch(room);
    setMp(true);
    setPhase('playing');
  }, []);
  const racers = stats.standings.length || 4;
  const liveRows = stats.standings;

  return (
    <main className="arena race">
      <div className="arena-stage">
        <Canvas
          dpr={canvasDpr(1.5)}
          camera={{ position: [0, 8, 20], fov: 68, near: 0.1, far: 600 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        >
          <XR store={xrStore}>
            {mp ? (
              <VenusMultiplayer running={phase === 'playing'} xr={presenting} watch={watch} onStats={setMpStats} />
            ) : (
              <VenusRace running={phase === 'playing'} xr={presenting} onStats={setStats} onFinish={finish} />
            )}
          </XR>
        </Canvas>
      </div>

      {watch && <SpectatorBar room={watch} />}

      {phase === 'playing' && coarse && !watch && (
        <TouchPad>
          <TouchButton code="KeyW" className="is-up">
            {l('gas')}
          </TouchButton>
          <TouchButton code="KeyS" className="is-down">
            {l('brake')}
          </TouchButton>
          <TouchButton code="KeyA" className="is-left">
            ←
          </TouchButton>
          <TouchButton code="KeyD" className="is-right">
            →
          </TouchButton>
          <TouchButton code="Space" className="is-drift">
            {l('drift')}
          </TouchButton>
          <TouchButton code="ShiftLeft" className="is-nitro">
            {l('nitro')}
          </TouchButton>
        </TouchPad>
      )}

      {phase === 'playing' && mp && (
        <>
          <div className="race-hud">
            <span className="race-speed">
              {watch && (mpStats?.total ?? 0) === 0 ? '—' : `${mpStats?.speed ?? 0} km/h`}
            </span>
            <span className="race-pos">
              {watch && (mpStats?.total ?? 0) === 0 ? '—' : `${mpStats?.position ?? 1}/${mpStats?.total ?? 1}`}
            </span>
            <span>
              {l('lap')} {mpStats?.lap ?? 1}/{mpStats?.laps ?? LAPS}
            </span>
            <span>{format(mpStats?.elapsed ?? 0)}</span>
            <span
              className={`race-nitro${mpStats?.boosting ? ' is-boost' : ''}${(mpStats?.nitro ?? 0) >= 0.98 ? ' is-full' : ''}`}
              title={l('nitro')}
            >
              <i style={{ width: `${Math.round((mpStats?.nitro ?? 0) * 100)}%` }} />
            </span>
            {mpStats?.drifting && <span className="race-drift">{l('drift')}</span>}
            <span className={`race-best${mpStats?.connected ? '' : ' is-offline'}`}>
              {mpStats?.connected ? `${mpStats?.ping ?? 0} ms` : l('offline')}
            </span>
            <VrButton xr={{ store: xrStore, presenting }} className="arena-vr" />
            {!watch && (
              <button
                type="button"
                className="game-exit"
                onClick={() => {
                  setMp(false);
                  setMpStats(null);
                  setPhase('idle');
                }}
              >
                {l('menu')}
              </button>
            )}
          </div>
          {mpStats && mpStats.standings.length > 0 && (
            <ol className="race-board">
              {mpStats.standings.map((row) => (
                <li
                  key={row.id}
                  className={row.id === mpStats.standings[0]?.id ? 'is-leader' : undefined}
                >
                  <span className="race-board-name">{row.name}</span>
                  <span className="race-board-gap">
                    {row.finishedAtMs !== null ? format(row.finishedAtMs / 1000) : `${l('lapShort')}${row.lap}`}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {mpStats?.state === 'countdown' && (
            <div className="race-go race-countdown">
              {mpStats.countdown > 0 ? mpStats.countdown : l('start')}
            </div>
          )}
          {mpStats?.state === 'ended' && (
            <div className="race-go">{l('finish')}</div>
          )}
        </>
      )}

      {phase === 'playing' && !mp && (
        <div className="race-hud">
          <span className="race-speed">{stats.speed} km/h</span>
          <span className="race-pos">
            {stats.position}/{racers}
          </span>
          <span>
            {l('lap')} {stats.lap}/{stats.laps}
          </span>
          <span>{format(stats.elapsed)}</span>
          <span className="race-best">
            {l('best')} {format(stats.bestLap)}
          </span>
          <span
            className={`race-nitro${stats.boosting ? ' is-boost' : ''}${stats.nitro >= 0.98 ? ' is-full' : ''}`}
            title={l('nitro')}
          >
            <i style={{ width: `${Math.round(stats.nitro * 100)}%` }} />
          </span>
          {stats.drifting && <span className="race-drift">{l('drift')}</span>}
          {stats.offTrack && <span className="race-off">{l('offTrack')}</span>}
          <VrButton xr={{ store: xrStore, presenting }} className="arena-vr" />
          <button
            type="button"
            className="game-exit"
            onClick={() => setPhase('idle')}
          >
            {l('menu')}
          </button>
        </div>
      )}

      {/* Sólo tabule jen bez MP — `stats.standings` zůstává z minulého
          sólového závodu a v MP by se vykreslila druhá, překryvná tabule. */}
      {phase === 'playing' && !mp && liveRows.length > 0 && (
        <ol className="race-board">
          {liveRows.map((row, index) => (
            <li key={row.id} className={row.isPlayer ? 'me' : undefined}>
              <i style={{ background: row.color }} />
              <span className="race-board-name">{lang === 'cs' ? row.nameCs : lang === 'es' ? row.nameEs ?? row.nameEn : row.nameEn}</span>
              <span className="race-board-gap">
                {row.totalSeconds !== null || index > 0
                  ? row.totalSeconds !== null
                    ? format(row.totalSeconds)
                    : `+${row.gap.toFixed(1)} m`
                  : `${l('lapShort')}${row.lap}`}
              </span>
            </li>
          ))}
        </ol>
      )}

      {phase === 'playing' && !mp && !stats.started && (
        <div className="race-go">{l('throttleToStart')}</div>
      )}

      {phase !== 'playing' && (
        <section className="arena-panel">
          <header>
            <strong>{l('title')}</strong>
            <span>{l('circuit')}</span>
          </header>

          {phase === 'idle' && (
            <>
              <p>
                {l('intro')}
              </p>
              <ul className="arena-keys">
                <li>
                  <kbd>W</kbd>/<kbd>↑</kbd> {l('throttle')}
                </li>
                <li>
                  <kbd>S</kbd>/<kbd>↓</kbd> {l('brakeLower')}
                </li>
                <li>
                  <kbd>A</kbd>/<kbd>D</kbd> {l('steer')}
                </li>
                <li>
                  <kbd>Space</kbd> {l('handbrake')}
                </li>
                <li>
                  <kbd>Shift</kbd> {l('nitroKey')}
                </li>
              </ul>
              <div className="arena-actions">
                <button type="button" className="park-btn" onClick={() => {
                  unlock();
                  setStats(EMPTY);
                  setPhase('playing');
                }}>
                  {l('toGrid')}
                </button>
                <button
                  type="button"
                  className="park-btn park-btn-mp"
                  onClick={() => {
                    unlock();
                    setMp(true);
                    setMpStats(null);
                    setStats(EMPTY);
                    setPhase('playing');
                  }}
                >
                  {l('multiplayer')}
                </button>
                <Link href="/park" className="arena-link">
                  {l('backToFair')}
                </Link>
              </div>
              <GameBoard game="race" className="race-board-panel" />
            </>
          )}

          {phase === 'over' && result && (
            <>
              <p className={result.position === 1 ? 'race-verdict win' : 'race-verdict'}>
                {result.position === 1
                  ? cs
                    ? 'Vyhrál jsi. Všichni tři za tebou.'
                    : 'You won. All three behind you.'
                  : cs
                    ? `${result.position}. místo ze ${result.standings.length}.`
                    : `${result.position}${result.position === 2 ? 'nd' : result.position === 3 ? 'rd' : 'th'} of ${result.standings.length}.`}
              </p>
              <div className="arena-result">
                <div>
                  <em>{l('total')}</em>
                  <strong>{format(result.totalSeconds)}</strong>
                </div>
                <div>
                  <em>{l('bestLap')}</em>
                  <strong>{format(result.bestLap)}</strong>
                </div>
                <div>
                  <em>{l('score')}</em>
                  <strong>{raceScore(result.totalSeconds, result.laps)}</strong>
                </div>
              </div>
              <ol className="race-board final">
                {result.standings.map((row: StandingRow, index) => (
                  <li key={row.id} className={row.isPlayer ? 'me' : undefined}>
                    <span className="race-board-place">{index + 1}.</span>
                    <i style={{ background: row.color }} />
                    <span className="race-board-name">{lang === 'cs' ? row.nameCs : lang === 'es' ? row.nameEs ?? row.nameEn : row.nameEn}</span>
                    <span className="race-board-gap">
                      {row.totalSeconds !== null
                        ? format(row.totalSeconds)
                        : cs
                          ? `nedojel · k${row.lap}`
                          : `DNF · l${row.lap}`}
                    </span>
                  </li>
                ))}
              </ol>
              {notice && <p className="arena-notice">{notice}</p>}
              <div className="arena-actions">
                <button type="button" className="park-btn" onClick={() => {
                  unlock();
                  setStats(EMPTY);
                  setPhase('playing');
                }}>
                  {l('again')}
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
