'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import { XR, createXRStore } from '@react-three/xr';
import { useI18n } from '@/core/i18n';
import { MarsArena, type ArenaResult, type ArenaStats } from '@/core/arena/MarsArena';
import { MarsMultiplayer, type MpStats } from '@/core/arena/MarsMultiplayer';
import { ArenaTouchControls, createTouchState } from '@/core/arena/ArenaTouch';
import { LOOK_MAX, LOOK_MIN, getLookSensitivity, setLookSensitivity } from '@/core/arena/settings';
import { FRAG_LIMIT, MATCH_SECONDS } from '@/core/arena/map';
import { describeRun, nickname as pickNickname, recordRun } from '@/core/progress/run';
import { watchRoom } from '@/core/net/watch';
import { GameBoard } from '@/core/games/GameBoard';

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
};

export default function MarsPage() {
  const { lang } = useI18n();
  const cs = lang === 'cs';
  const [phase, setPhase] = useState<Phase>('idle');
  const [presenting, setPresenting] = useState(false);
  const [xrStore] = useState(() => createXRStore({ foveation: 0.5 }));
  const [stats, setStats] = useState<ArenaStats>(EMPTY_STATS);
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

  // během hry na mobilu schovej navigaci a chat (celá obrazovka pro hru)
  useEffect(() => {
    if (!coarse) return;
    document.body.dataset.playing = phase === 'playing' ? '1' : '';
    return () => {
      document.body.dataset.playing = '';
    };
  }, [coarse, phase]);

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
    if (!room) return;
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
        describeRun(result, cs, [outcome.reason === 'frags' ? 'frag limit' : cs ? 'čas' : 'time']),
      );
    },
    [cs],
  );

  useEffect(() => {
    if (phase !== 'playing') return;
    const onEscape = () => {
      // Esc jen uvolní myš; zápas běží dál, ať se dá vrátit
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [phase]);

  const healthColor = stats.health > 60 ? '#7fe3d4' : stats.health > 25 ? '#ffd166' : '#ff7a6b';

  return (
    <main className="arena">
      <div className="arena-stage">
        <Canvas
          dpr={[1, 1.5]}
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
              />
            </XR>
          )}
        </Canvas>
      </div>

      {phase === 'playing' && coarse && <ArenaTouchControls state={touch} />}

      {phase === 'playing' && mp && (
        <>
          <div className="arena-crosshair" aria-hidden />
          {watch && (
            <div className="arena-spectator" role="status">
              <strong>👁 {cs ? 'DÍVÁŠ SE' : 'WATCHING'}</strong>
              <span>{watch}</span>
              <Link href="/multiplayer" className="arena-link">
                {cs ? 'do lobby' : 'to lobby'}
              </Link>
            </div>
          )}
          <div className="arena-hud">
            <span className="arena-health" style={{ color: (mpStats?.health ?? 100) > 60 ? '#7fe3d4' : (mpStats?.health ?? 100) > 25 ? '#ffd166' : '#ff7a6b' }}>
              ❤ {mpStats?.health ?? 100}
            </span>
            <span className="arena-armor">🛡 {mpStats?.armor ?? 0}</span>
            <span className="arena-frags">
              {cs ? 'fraggy' : 'frags'} {mpStats?.frags ?? 0}/{FRAG_LIMIT}
            </span>
            <span className="arena-time">{mpStats?.timeLeft ?? MATCH_SECONDS}s</span>
            <span className="arena-weapon">{mpStats?.weapon === 'rocket' ? `ROCKET ×${mpStats?.ammo ?? 0}` : mpStats?.weapon === 'mg' ? `MG ×${mpStats?.ammo ?? 0}` : 'RAIL'}</span>
            <span className={`arena-weapon${mpStats?.connected ? '' : ' is-offline'}`}>
              {mpStats?.connected ? `${mpStats?.ping ?? 0} ms` : cs ? 'offline' : 'offline'}
            </span>
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
          <div className="arena-tip">
            {coarse
              ? cs
                ? 'joystick = pohyb · tažení vpravo = rozhlížení · PALBA / SKOK / ZB'
                : 'stick = move · drag right = look · FIRE / JUMP / WP'
              : cs
                ? 'WASD pohyb · mezerník skok · 1/2/3 zbraň · klik střelba · Esc uvolní myš'
                : 'WASD move · space jump · 1/2/3 weapon · click fire · Esc releases the mouse'}
          </div>
          {mpStats?.matchState === 'ended' && (
            <div className="arena-respawn">
              {cs ? 'konec zápasu — nový začne za chvíli' : 'match over — new one starts shortly'}
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
              {cs ? 'fraggy' : 'frags'} {stats.frags}/{FRAG_LIMIT}
            </span>
            <span className="arena-time">{stats.timeLeft}s</span>
            <span className="arena-weapon">
              {stats.weapon === 'rail' ? 'RAIL' : stats.weapon === 'mg' ? `MG ×${stats.ammo}` : `ROCKET ×${stats.ammo}`}
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
          </div>
          <div className="arena-tip">
            {coarse
              ? cs
                ? 'joystick = pohyb · tažení vpravo = rozhlížení · PALBA / SKOK / ZB'
                : 'stick = move · drag right = look · FIRE / JUMP / WP'
              : cs
                ? 'WASD pohyb · mezerník skok · 1/2/3 zbraň · klik střelba · Esc uvolní myš'
                : 'WASD move · space jump · 1/2/3 weapon · click fire · Esc releases the mouse'}
          </div>
          {stats.respawnIn > 0 && (
            <div className="arena-respawn">
              {cs ? 'respawN za' : 'respawn in'} {stats.respawnIn}
            </div>
          )}
        </>
      )}

      {phase !== 'playing' && (
        <section className="arena-panel">
          <header>
            <strong>MARS ARENA</strong>
            <span>{cs ? 'deathmatch · Quake-style' : 'deathmatch · Quake-style'}</span>
          </header>

          {phase === 'idle' && (
            <>
              <p>
                {cs
                  ? 'Rail a rakety, tři boti, frag limit 10 nebo tři minuty. Mapa je z krabic — žádné modely, jen fyzika a světlo.'
                  : 'Rail and rockets, three bots, frag limit 10 or three minutes. The map is made of boxes — no models, just physics and light.'}
              </p>
              <ul className="arena-keys">
                <li>
                  <kbd>{coarse ? 'joystick' : 'WASD'}</kbd> {cs ? 'pohyb' : 'move'}
                </li>
                <li>
                  <kbd>mezerník</kbd> {cs ? 'skok' : 'jump'}
                </li>
                <li>
                  <kbd>1</kbd>/<kbd>2</kbd>/<kbd>3</kbd> {cs ? 'rail / rakety / MG' : 'rail / rockets / MG'}
                </li>
                <li>
                  <kbd>klik</kbd> {cs ? 'střelba' : 'fire'}
                </li>
              </ul>
              {coarse && (
                <label className="arena-slider">
                  <span>{cs ? 'citlivost pohledu' : 'look sensitivity'}</span>
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
                  {cs ? 'Vstoupit do arény' : 'Enter the arena'}
                </button>
                <button
                  type="button"
                  className="park-btn park-btn-mp"
                  onClick={() => {
                    setMp(true);
                    setPhase('playing');
                  }}
                >
                  {cs ? 'Multiplayer — proti lidem' : 'Multiplayer — against people'}
                </button>
                <Link href="/park" className="arena-link">
                  {cs ? '← zpět na pouť' : '← back to the fair'}
                </Link>
              </div>
              <p className="arena-small">
                {cs
                  ? 'Multiplayer: server počítá pohyb i zásahy, ty posíláš jen vstup. Chat (T) je pro přihlášené.'
                  : 'Multiplayer: the server computes movement and hits, you only send input. Chat (T) is for signed-in users.'}
              </p>
              <p className="arena-small">
                {cs
                  ? 'Myš se zamkne kliknutím do plátna. Ve VR (tlačítko VR) míříš pravým ovladačem a střílíš spouští — hráč ale stojí, pohyb ovladačem ještě není.'
                  : 'The mouse locks when you click the canvas. In VR (VR button) you aim with the right controller and fire with the trigger — the player stands still, controller movement is not implemented yet.'}
              </p>
              <GameBoard game="arena" className="arena-board-panel" />
            </>
          )}

          {phase === 'over' && result && (
            <>
              <div className="arena-result">
                <div>
                  <em>{cs ? 'fraggy' : 'frags'}</em>
                  <strong>{result.frags}</strong>
                </div>
                <div>
                  <em>{cs ? 'smrti' : 'deaths'}</em>
                  <strong>{result.deaths}</strong>
                </div>
                <div>
                  <em>{cs ? 'skóre' : 'score'}</em>
                  <strong>{result.score}</strong>
                </div>
              </div>
              {notice && <p className="arena-notice">{notice}</p>}
              <div className="arena-actions">
                <button type="button" className="park-btn" onClick={() => setPhase('playing')}>
                  {cs ? 'Odveta' : 'Rematch'}
                </button>
                <Link href="/park" className="arena-link">
                  {cs ? '← zpět na pouť' : '← back to the fair'}
                </Link>
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}
