'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import { XR, createXRStore } from '@react-three/xr';
import { tx, useI18n } from '@/core/i18n';
import { ARENA_COPY, type ArenaCopyKey } from './copy';
import { MarsArena, type ArenaResult, type ArenaStats } from '@/core/arena/MarsArena';
import { MarsMultiplayer, type MpStats } from '@/core/arena/MarsMultiplayer';
import { ArenaTouchControls, createTouchState } from '@/core/arena/ArenaTouch';
import { LOOK_MAX, LOOK_MIN, getLookSensitivity, setLookSensitivity } from '@/core/arena/settings';
import { FRAG_LIMIT, MATCH_SECONDS } from '@/core/arena/map';
import type { WeaponId } from '@/core/arena/weapons';
import { describeRun, nickname as pickNickname, recordRun } from '@/core/progress/run';
import { watchRoom } from '@/core/net/watch';
import { SpectatorBar } from '@/core/net/SpectatorBar';
import { GameBoard } from '@/core/games/GameBoard';
import { canvasDpr } from '@/core/design/dpr';

/**
 * MARS ARENA — Quake-style deathmatch v prohlížeči.
 *
 * Stránka drží jen HUD a fázi zápasu; svět, fyzika, boti a střelba jsou
 * v `core/arena`. Odměna jde přes stejný profil a tabuli jako pouť.
 */

type Phase = 'idle' | 'playing' | 'over';

const EMPTY_STATS: ArenaStats = {
  health: 100,
  armor: 0,
  frags: 0,
  deaths: 0,
  weapon: 'rail',
  ammo: 12,
  botsAlive: 3,
  timeLeft: MATCH_SECONDS,
  respawnIn: 0,
  quadIn: 0,
  ammoByWeapon: { rail: -1, rocket: 12, mg: 50, shotgun: 0, lightning: 0, plasma: 0 },
};

/** Lišta zbraní (Q3): číslo klávesy, zkratka a munice. */
const WEAPON_BAR: { id: WeaponId; key: number; label: string }[] = [
  { id: 'rail', key: 1, label: 'RAIL' },
  { id: 'rocket', key: 2, label: 'ROCKET' },
  { id: 'mg', key: 3, label: 'MG' },
  { id: 'shotgun', key: 4, label: 'SHOTGUN' },
  { id: 'lightning', key: 5, label: 'LIGHTNING' },
  { id: 'plasma', key: 6, label: 'PLASMA' },
];

/** Název zbraně do HUD — jedno místo pro sólo (MP má vlastní 3 zbraně). */
function weaponLabel(weapon: string, ammo: number): string {
  if (weapon === 'rail') return 'RAIL';
  if (weapon === 'mg') return `MG ×${ammo}`;
  if (weapon === 'rocket') return `ROCKET ×${ammo}`;
  if (weapon === 'shotgun') return `SHOTGUN ×${ammo}`;
  if (weapon === 'lightning') return `LIGHTNING ×${ammo}`;
  if (weapon === 'plasma') return `PLASMA ×${ammo}`;
  return 'RAIL';
}

export default function MarsPage() {
  const { lang } = useI18n();
  /** Texty HUD jdou přes `app/mars/copy.ts` — žádné `cs ? :` v JSX. */
  const l = useCallback((key: ArenaCopyKey) => tx(ARENA_COPY[key], lang), [lang]);
  const cs = lang === 'cs';
  const [phase, setPhase] = useState<Phase>('idle');
  const [presenting, setPresenting] = useState(false);
  const [xrStore] = useState(() => createXRStore({ foveation: 0.5 }));
  const [stats, setStats] = useState<ArenaStats>(EMPTY_STATS);
  /** Klik na zbraň v liště — request, který sim aplikuje v příštím snímku. */
  const weaponRequest = useRef<WeaponId | null>(null);
  /** `mp` = online aréna (server-authoritative), jinak sólo proti botům. */
  const [mp, setMp] = useState(false);
  const [mpStats, setMpStats] = useState<MpStats | null>(null);
  const [result, setResult] = useState<ArenaResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Dotykové ovládání — na mobilu joystick + tažení místo WASD a myši. */
  const touch = useRef(createTouchState());
  const [coarse, setCoarse] = useState(false);
  /** Násobek citlivosti pohledu — načte se až v efektu (localStorage není na serveru). */
  const [look, setLook] = useState(1);

  useEffect(() => {
    const query = window.matchMedia('(hover: none) and (pointer: coarse)');
    setCoarse(query.matches);
    setLook(getLookSensitivity());
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

  useEffect(() => xrStore.subscribe((state) => setPresenting(Boolean(state.session))), [xrStore]);

  /**
   * `?watch=arena-2` = hlediště, ne hra.
   *
   * Čte se až v efektu: při SSR `window` není, takže inicializace stavu
   * z URL by na serveru a klientu dala jiný strom (hydration mismatch).
   */
  const [watch, setWatch] = useState<string | null>(null);
  useEffect(() => {
    const room = watchRoom();
    if (!room?.startsWith('arena-')) return;
    setWatch(room);
    setMp(true);
    setPhase('playing');
  }, []);

  const endMatch = useCallback(
    (outcome: ArenaResult) => {
      setResult(outcome);
      setPhase('over');
      if (document.pointerLockElement) void document.exitPointerLock();

      const result = recordRun({ game: 'arena', score: outcome.score, nickname: pickNickname() });
      setNotice(
        describeRun(result, cs, [outcome.reason === 'frags' ? 'frag limit' : l('time')]),
      );
    },
    [cs],
  );

  const healthColor = stats.health > 60 ? '#7fe3d4' : stats.health > 25 ? '#ffd166' : '#ff7a6b';

  return (
    <main className="arena">
      <div className="arena-stage">
        <Canvas
          dpr={canvasDpr(1.5)}
          camera={{ position: [0, 1.7, 15], fov: 88, near: 0.05, far: 400 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        >
          {mp ? (
            <MarsMultiplayer running={phase === 'playing'} watch={watch} onStats={setMpStats} touch={touch} />
          ) : (
            <XR store={xrStore}>
              <MarsArena
                running={phase === 'playing'}
                xr={presenting}
                onStats={setStats}
                onEnd={endMatch}
                touch={touch}
                weaponRequest={weaponRequest}
              />
            </XR>
          )}
        </Canvas>
      </div>

      {phase === 'playing' && coarse && !watch && <ArenaTouchControls state={touch} />}

      {phase === 'playing' && mp && (
        <>
          {!watch && <div className="arena-crosshair" aria-hidden />}
          {watch && <SpectatorBar room={watch} />}
          <div className="arena-hud">
            {!watch && (
              <>
                <span className="arena-health" style={{ color: (mpStats?.health ?? 100) > 60 ? '#7fe3d4' : (mpStats?.health ?? 100) > 25 ? '#ffd166' : '#ff7a6b' }}>
                  ❤ {mpStats?.health ?? 100}
                </span>
                <span className="arena-armor">🛡 {mpStats?.armor ?? 0}</span>
                <span className="arena-frags">
                  {l('frags')} {mpStats?.frags ?? 0}/{FRAG_LIMIT}
                </span>
                <span className="arena-weapon">{mpStats?.weapon === 'rocket' ? `ROCKET ×${mpStats?.ammo ?? 0}` : mpStats?.weapon === 'mg' ? `MG ×${mpStats?.ammo ?? 0}` : 'RAIL'}</span>
              </>
            )}
            <span className="arena-time">{mpStats?.timeLeft ?? MATCH_SECONDS}s</span>
            <span className={`arena-weapon${mpStats?.connected ? '' : ' is-offline'}`}>
              {mpStats?.connected ? `${mpStats?.ping ?? 0} ms` : l('offline')}
            </span>
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
          {mpStats && mpStats.players.length > 1 && (
            <ol className="arena-board">
              {mpStats.players.map((row) => (
                <li key={row.id} className={row.id === mpStats.players[0]?.id ? 'is-leader' : undefined}>
                  <span className="arena-board-name">{row.name}</span>
                  <span className="arena-board-score">
                    {row.frags}/{row.deaths}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {!watch && (
          <div className="arena-tip">
            {coarse
              ? cs
                ? 'joystick = pohyb · tažení vpravo = rozhlížení · PALBA / SKOK / ZB'
                : 'stick = move · drag right = look · FIRE / JUMP / WP'
              : cs
                ? 'WASD pohyb · mezerník skok · 1/2/3 zbraň · klik střelba · Esc uvolní myš'
                : 'WASD move · space jump · 1/2/3 weapon · click fire · Esc releases the mouse'}
          </div>
          )}
          {mpStats?.matchState === 'ended' && (
            <div className="arena-respawn">
              {l('matchOver')}
            </div>
          )}
        </>
      )}

      {phase === 'playing' && !mp && (
        <>
          <div className="arena-crosshair" aria-hidden />
          <div className="arena-hud">
            <span className="arena-health" style={{ color: healthColor }}>
              ❤ {stats.health}
            </span>
            <span className="arena-armor">🛡 {stats.armor}</span>
            <span className="arena-frags">
              {l('frags')} {stats.frags}/{FRAG_LIMIT}
            </span>
            <span className="arena-time">{stats.timeLeft}s</span>
            {(stats.quadIn ?? 0) > 0 && (
              <span className="arena-quad" title={cs ? 'Quad Damage ×3' : 'Quad Damage ×3'}>
                QUAD ×3 · {stats.quadIn}s
              </span>
            )}
            <span className="arena-weapon">
              {weaponLabel(stats.weapon, stats.ammo)}
            </span>
            {!presenting && (
              <button
                type="button"
                className="arena-vr"
                onClick={() => {
                  void xrStore.enterVR();
                }}
              >
                VR
              </button>
            )}
            <button
              type="button"
              className="game-exit"
              onClick={() => {
                if (document.pointerLockElement) void document.exitPointerLock();
                setPhase('idle');
              }}
            >
              {l('menu')}
            </button>
          </div>
          <div className="arena-weaponbar" role="group" aria-label={l('weapons')}>
            {WEAPON_BAR.map((slot) => {
              const ammo = stats.ammoByWeapon?.[slot.id];
              const infinite = slot.id === 'rail';
              const empty = !infinite && (ammo ?? 0) <= 0;
              return (
                <button
                  key={slot.id}
                  type="button"
                  className={`arena-weaponbar-slot${stats.weapon === slot.id ? ' is-active' : ''}${empty ? ' is-empty' : ''}`}
                  aria-pressed={stats.weapon === slot.id}
                  disabled={empty}
                  title={`${slot.key} · ${slot.label}`}
                  onClick={() => {
                    weaponRequest.current = slot.id;
                  }}
                >
                  <kbd>{slot.key}</kbd>
                  <span>{slot.label}</span>
                  <b>{infinite ? '∞' : (ammo ?? 0)}</b>
                </button>
              );
            })}
          </div>
          <div className="arena-tip">
            {coarse
              ? cs
                ? 'joystick = pohyb · tažení vpravo = rozhlížení · PALBA / SKOK / ZB'
                : 'stick = move · drag right = look · FIRE / JUMP / WP'
              : cs
                ? 'WASD pohyb · mezerník skok · 1–6 nebo kolečko zbraň · klik střelba · Esc uvolní myš'
                : 'WASD move · space jump · 1–6 or wheel weapon · click fire · Esc releases the mouse'}
          </div>
          {stats.respawnIn > 0 && (
            <div className="arena-respawn">
              {l('respawnIn')} {stats.respawnIn}
            </div>
          )}
        </>
      )}

      {phase !== 'playing' && (
        <section className="arena-panel">
          <header>
            <strong>MARS ARENA</strong>
            <span>{l('mode')}</span>
          </header>

          {phase === 'idle' && (
            <>
              <p>
                {l('intro')}
              </p>
              <ul className="arena-keys">
                <li>
                  <kbd>{coarse ? 'joystick' : 'WASD'}</kbd> {l('move')}
                </li>
                <li>
                  <kbd>mezerník</kbd> {l('jump')}
                </li>
                <li>
                  <kbd>1</kbd>–<kbd>6</kbd> {l('weapons')}
                </li>
                <li>
                  <kbd>klik</kbd> {l('fire')}
                </li>
              </ul>
              {coarse && (
                <label className="arena-slider">
                  <span>{l('lookSensitivity')}</span>
                  <input
                    type="range"
                    min={LOOK_MIN}
                    max={LOOK_MAX}
                    step={0.1}
                    value={look}
                    onChange={(event) => setLook(setLookSensitivity(Number(event.target.value)))}
                  />
                  <b>{look.toFixed(1)}×</b>
                </label>
              )}
              <div className="arena-actions">
                <button type="button" className="park-btn" onClick={() => setPhase('playing')}>
                  {l('enter')}
                </button>
                <button
                  type="button"
                  className="park-btn park-btn-mp"
                  onClick={() => {
                    setMp(true);
                    setPhase('playing');
                  }}
                >
                  {l('multiplayer')}
                </button>
                <Link href="/park" className="arena-link">
                  {l('backToFair')}
                </Link>
              </div>
              <p className="arena-small">
                {l('mpNote')}
              </p>
              <p className="arena-small">
                {l('vrNote')}
              </p>
              <GameBoard game="arena" className="arena-board-panel" />
            </>
          )}

          {phase === 'over' && result && (
            <>
              <div className="arena-result">
                <div>
                  <em>{l('frags')}</em>
                  <strong>{result.frags}</strong>
                </div>
                <div>
                  <em>{l('deaths')}</em>
                  <strong>{result.deaths}</strong>
                </div>
                <div>
                  <em>{l('score')}</em>
                  <strong>{result.score}</strong>
                </div>
              </div>
              {notice && <p className="arena-notice">{notice}</p>}
              <div className="arena-actions">
                <button type="button" className="park-btn" onClick={() => setPhase('playing')}>
                  {l('rematch')}
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
