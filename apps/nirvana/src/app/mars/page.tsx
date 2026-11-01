'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import { XR, createXRStore } from '@react-three/xr';
import { useI18n } from '@/core/i18n';
import { MarsArena, type ArenaResult, type ArenaStats } from '@/core/arena/MarsArena';
import { FRAG_LIMIT, MATCH_SECONDS } from '@/core/arena/map';
import { awardRun, loadProfile, saveProfile } from '@/core/park/profile';
import { CHALLENGE_REWARD, claimChallenge } from '@/core/park/challenge';

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
  const [result, setResult] = useState<ArenaResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => xrStore.subscribe((state) => setPresenting(Boolean(state.session))), [xrStore]);

  const endMatch = useCallback(
    (outcome: ArenaResult) => {
      setResult(outcome);
      setPhase('over');
      if (document.pointerLockElement) void document.exitPointerLock();

      const awarded = awardRun(loadProfile(), 'arena', outcome.score);
      const challenge = claimChallenge(awarded.profile, 'arena', outcome.score);
      // odměna za výzvu se musí uložit, jinak se zobrazí a zmizí (stará chyba)
      if (challenge.claimed) saveProfile(challenge.profile);
      const nickname = (() => {
        try {
          return window.localStorage.getItem('nirvana.park.name') ?? 'hrac';
        } catch {
          return 'hrac';
        }
      })();

      const bits = [
        outcome.reason === 'frags'
          ? cs
            ? 'frag limit'
            : 'frag limit'
          : cs
            ? 'čas'
            : 'time',
        `+${awarded.tokensGained} ${cs ? 'žetony' : 'tokens'}`,
      ];
      if (challenge.claimed) bits.push(cs ? `výzva +${CHALLENGE_REWARD}` : `daily +${CHALLENGE_REWARD}`);
      setNotice(bits.join(' · '));

      void fetch('/api/park/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: 'arena', score: outcome.score, name: nickname }),
      }).catch(() => undefined);
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
          <XR store={xrStore}>
            <MarsArena
              running={phase === 'playing'}
              xr={presenting}
              onStats={setStats}
              onEnd={endMatch}
            />
          </XR>
        </Canvas>
      </div>

      {phase === 'playing' && (
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
              {stats.weapon === 'rail' ? 'RAIL' : `ROCKET ×${stats.ammo}`}
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
            {cs
              ? 'WASD pohyb · mezerník skok · 1/2 zbraň · klik střelba · Esc uvolní myš'
              : 'WASD move · space jump · 1/2 weapon · click fire · Esc releases the mouse'}
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
                  <kbd>WASD</kbd> {cs ? 'pohyb' : 'move'}
                </li>
                <li>
                  <kbd>mezerník</kbd> {cs ? 'skok' : 'jump'}
                </li>
                <li>
                  <kbd>1</kbd>/<kbd>2</kbd> {cs ? 'rail / rakety' : 'rail / rockets'}
                </li>
                <li>
                  <kbd>klik</kbd> {cs ? 'střelba' : 'fire'}
                </li>
              </ul>
              <div className="arena-actions">
                <button type="button" className="park-btn" onClick={() => setPhase('playing')}>
                  {cs ? 'Vstoupit do arény' : 'Enter the arena'}
                </button>
                <Link href="/park" className="arena-link">
                  {cs ? '← zpět na pouť' : '← back to the fair'}
                </Link>
              </div>
              <p className="arena-small">
                {cs
                  ? 'Myš se zamkne kliknutím do plátna. Ve VR (tlačítko VR) míříš pravým ovladačem a střílíš spouští — hráč ale stojí, pohyb ovladačem ještě není.'
                  : 'The mouse locks when you click the canvas. In VR (VR button) you aim with the right controller and fire with the trigger — the player stands still, controller movement is not implemented yet.'}
              </p>
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
