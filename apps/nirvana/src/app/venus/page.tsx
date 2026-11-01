'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import { useI18n } from '@/core/i18n';
import { VenusRace, type RaceResult, type RaceStats } from '@/core/race/VenusRace';
import { VenusMultiplayer, type MpRaceStats } from '@/core/race/VenusMultiplayer';
import { LAPS, raceScore } from '@/core/race/track';
import type { StandingRow } from '@/core/race/rivals';
import { awardRun, grantTokens, loadProfile, saveProfile } from '@/core/park/profile';
import { CHALLENGE_REWARD, claimChallenge } from '@/core/park/challenge';

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
  const cs = lang === 'cs';
  const [phase, setPhase] = useState<Phase>('idle');
  const [stats, setStats] = useState<RaceStats>(EMPTY);
  const [result, setResult] = useState<RaceResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mp, setMp] = useState(false);
  const [mpStats, setMpStats] = useState<MpRaceStats | null>(null);

  const finish = useCallback(
    (outcome: RaceResult) => {
      setResult(outcome);
      setPhase('over');
      const score = raceScore(outcome.totalSeconds, outcome.laps);
      const awarded = awardRun(loadProfile(), 'race', score);

      const podium = PODIUM_TOKENS[outcome.position - 1] ?? 0;
      const withPodium = grantTokens(awarded.profile, podium);
      const challenge = claimChallenge(withPodium, 'race', score);
      if (challenge.claimed) saveProfile(challenge.profile);

      const nickname = (() => {
        try {
          return window.localStorage.getItem('nirvana.park.name') ?? 'hrac';
        } catch {
          return 'hrac';
        }
      })();

      const bits = [`+${awarded.tokensGained + podium} ${cs ? 'žetony' : 'tokens'}`];
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

  const racers = stats.standings.length || 4;
  const liveRows = stats.standings;

  return (
    <main className="arena race">
      <div className="arena-stage">
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 8, 20], fov: 68, near: 0.1, far: 600 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        >
          {mp ? (
            <VenusMultiplayer running={phase === 'playing'} onStats={setMpStats} />
          ) : (
            <VenusRace running={phase === 'playing'} onStats={setStats} onFinish={finish} />
          )}
        </Canvas>
      </div>

      {phase === 'playing' && mp && (
        <>
          <div className="race-hud">
            <span className="race-speed">{mpStats?.speed ?? 0} km/h</span>
            <span className="race-pos">
              {mpStats?.position ?? 1}/{mpStats?.total ?? 1}
            </span>
            <span>
              {cs ? 'kolo' : 'lap'} {mpStats?.lap ?? 1}/{mpStats?.laps ?? LAPS}
            </span>
            <span>{format(mpStats?.elapsed ?? 0)}</span>
            <span className={`race-best${mpStats?.connected ? '' : ' is-offline'}`}>
              {mpStats?.connected ? `${mpStats?.ping ?? 0} ms` : cs ? 'offline' : 'offline'}
            </span>
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
                    {row.finishedAtMs !== null ? format(row.finishedAtMs / 1000) : `${cs ? 'k' : 'l'}${row.lap}`}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {mpStats?.state === 'countdown' && (
            <div className="race-go race-countdown">
              {mpStats.countdown > 0 ? mpStats.countdown : cs ? 'start!' : 'go!'}
            </div>
          )}
          {mpStats?.state === 'ended' && (
            <div className="race-go">{cs ? 'cíl — nový závod za chvíli' : 'finish — new race soon'}</div>
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
            {cs ? 'kolo' : 'lap'} {stats.lap}/{stats.laps}
          </span>
          <span>{format(stats.elapsed)}</span>
          <span className="race-best">
            {cs ? 'nej' : 'best'} {format(stats.bestLap)}
          </span>
          {stats.offTrack && <span className="race-off">{cs ? 'mimo trať' : 'off track'}</span>}
        </div>
      )}

      {phase === 'playing' && liveRows.length > 0 && (
        <ol className="race-board">
          {liveRows.map((row, index) => (
            <li key={row.id} className={row.isPlayer ? 'me' : undefined}>
              <i style={{ background: row.color }} />
              <span className="race-board-name">{cs ? row.nameCs : row.nameEn}</span>
              <span className="race-board-gap">
                {row.totalSeconds !== null || index > 0
                  ? row.totalSeconds !== null
                    ? format(row.totalSeconds)
                    : `+${row.gap.toFixed(1)} m`
                  : `${cs ? 'k' : 'l'}${row.lap}`}
              </span>
            </li>
          ))}
        </ol>
      )}

      {phase === 'playing' && !mp && !stats.started && (
        <div className="race-go">{cs ? 'plyn = start' : 'throttle to start'}</div>
      )}

      {phase !== 'playing' && (
        <section className="arena-panel">
          <header>
            <strong>VENUŠE</strong>
            <span>{cs ? 'okruh · 3 kola · 3 soupeři' : 'circuit · 3 laps · 3 rivals'}</span>
          </header>

          {phase === 'idle' && (
            <>
              <p>
                {cs
                  ? 'Hovercraft, tři kola a tři soupeři na stejných strojích. Rozhoduje brzdný bod a stopa — kdo jede čistěji, vyhraje. Mimo pás tě to zpomalí a přitáhne zpět.'
                  : 'A hovercraft, three laps and three rivals on identical machines. Braking points and the racing line decide it — the cleaner driver wins. Off the strip you slow down and get pulled back.'}
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
              <ol className="race-board final">
                {result.standings.map((row: StandingRow, index) => (
                  <li key={row.id} className={row.isPlayer ? 'me' : undefined}>
                    <span className="race-board-place">{index + 1}.</span>
                    <i style={{ background: row.color }} />
                    <span className="race-board-name">{cs ? row.nameCs : row.nameEn}</span>
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
