'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import { useI18n } from '@/core/i18n';
import { VenusRace, type RaceResult, type RaceStats } from '@/core/race/VenusRace';
import { LAPS, raceScore } from '@/core/race/track';
import { awardRun, loadProfile } from '@/core/park/profile';
import { CHALLENGE_REWARD, claimChallenge } from '@/core/park/challenge';

/** VENUŠE — time trial. Tři kola, čas, osobní rekord a tabule. */

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
};

function format(seconds: number | null): string {
  if (seconds === null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

export default function VenusPage() {
  const { lang } = useI18n();
  const cs = lang === 'cs';
  const [phase, setPhase] = useState<Phase>('idle');
  const [stats, setStats] = useState<RaceStats>(EMPTY);
  const [result, setResult] = useState<RaceResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const finish = useCallback(
    (outcome: RaceResult) => {
      setResult(outcome);
      setPhase('over');
      const score = raceScore(outcome.totalSeconds, outcome.laps);
      const awarded = awardRun(loadProfile(), 'race', score);
      const challenge = claimChallenge(awarded.profile, 'race', score);

      const nickname = (() => {
        try {
          return window.localStorage.getItem('nirvana.park.name') ?? 'hrac';
        } catch {
          return 'hrac';
        }
      })();

      const bits = [`+${awarded.tokensGained} ${cs ? 'žetony' : 'tokens'}`];
      if (challenge.claimed) bits.push(cs ? `výzva +${CHALLENGE_REWARD}` : `daily +${CHALLENGE_REWARD}`);
      setNotice(bits.join(' · '));

      void fetch('/api/park/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: 'race', score, name: nickname }),
      }).catch(() => undefined);
    },
    [cs],
  );

  return (
    <main className="arena race">
      <div className="arena-stage">
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 8, 20], fov: 68, near: 0.1, far: 600 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        >
          <VenusRace running={phase === 'playing'} onStats={setStats} onFinish={finish} />
        </Canvas>
      </div>

      {phase === 'playing' && (
        <div className="race-hud">
          <span className="race-speed">{stats.speed} km/h</span>
          <span>
            {cs ? 'kolo' : 'lap'} {stats.lap}/{stats.laps}
          </span>
          <span>{format(stats.elapsed)}</span>
          <span className="race-best">
            {cs ? 'nej' : 'best'} {format(stats.bestLap)}
          </span>
          {stats.offTrack && <span className="race-off">{cs ? 'mimo trať' : 'off track'}</span>}
        </div>
      )}

      {phase === 'playing' && !stats.started && (
        <div className="race-go">{cs ? 'plyn = start' : 'throttle to start'}</div>
      )}

      {phase !== 'playing' && (
        <section className="arena-panel">
          <header>
            <strong>VENUŠE</strong>
            <span>{cs ? 'okruh · 3 kola' : 'circuit · 3 laps'}</span>
          </header>

          {phase === 'idle' && (
            <>
              <p>
                {cs
                  ? 'Hovercraft, tři kola a trať, která tě sama drží na silnici. Mimo pás tě to zpomalí a přitáhne zpět — žádné pády do prázdna.'
                  : 'A hovercraft, three laps and a track that keeps you on the road. Off the strip you slow down and get pulled back — no falling into the void.'}
              </p>
              <ul className="arena-keys">
                <li>
                  <kbd>W</kbd>/<kbd>↑</kbd> {cs ? 'plyn' : 'throttle'}
                </li>
                <li>
                  <kbd>S</kbd>/<kbd>↓</kbd> {cs ? 'brzda' : 'brake'}
                </li>
                <li>
                  <kbd>A</kbd>/<kbd>D</kbd> {cs ? 'zatáčení' : 'steer'}
                </li>
              </ul>
              <div className="arena-actions">
                <button type="button" className="park-btn" onClick={() => setPhase('playing')}>
                  {cs ? 'Na start' : 'To the grid'}
                </button>
                <Link href="/park" className="arena-link">
                  {cs ? '← zpět na pouť' : '← back to the fair'}
                </Link>
              </div>
            </>
          )}

          {phase === 'over' && result && (
            <>
              <div className="arena-result">
                <div>
                  <em>{cs ? 'celkem' : 'total'}</em>
                  <strong>{format(result.totalSeconds)}</strong>
                </div>
                <div>
                  <em>{cs ? 'nejlepší kolo' : 'best lap'}</em>
                  <strong>{format(result.bestLap)}</strong>
                </div>
                <div>
                  <em>{cs ? 'skóre' : 'score'}</em>
                  <strong>{raceScore(result.totalSeconds, result.laps)}</strong>
                </div>
              </div>
              {notice && <p className="arena-notice">{notice}</p>}
              <div className="arena-actions">
                <button type="button" className="park-btn" onClick={() => setPhase('playing')}>
                  {cs ? 'Znovu' : 'Again'}
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
