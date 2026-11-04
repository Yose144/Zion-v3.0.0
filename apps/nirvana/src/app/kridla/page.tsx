'use client';

/**
 * KŘÍDLA — hratelný svět na Uranu.
 *
 * Cesta, ne soutěž: sedm světel v ledové obloze, svatyně na konci a text,
 * který se odemyká po jednom. Žádní nepřátelé, žádný časový limit —
 * kdyby hra trestala pomalé kochání, byla by to jiná hra.
 *
 * Co stránka drží: fázi (úvod / let / konec), HUD, texty příběhu a zápis
 * dohrané cesty do společné progrese (`recordRun`). Fyzika i scéna jsou
 * v `core/sky/`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/core/i18n';
import { SkyCanvas, type SkyStats } from '@/core/sky/SkyScene';
import { SKY_FINISH, SKY_INTRO, SKY_LIGHTS } from '@/core/sky/world';
import { describeRun, nickname as pickNickname, recordRun } from '@/core/progress/run';
import { unlock } from '@/core/audio/engine';
import { TouchButton } from '@/core/games/TouchPad';

type Phase = 'intro' | 'flying' | 'done';

const EMPTY: SkyStats = { lights: 0, total: SKY_LIGHTS.length, energy: 100, time: 0, finished: false, lastLight: null };

export default function KridlaPage() {
  const { lang } = useI18n();
  const cs = lang === 'cs';

  const [phase, setPhase] = useState<Phase>('intro');
  const [stats, setStats] = useState<SkyStats>(EMPTY);
  const [notice, setNotice] = useState<string | null>(null);
  const [fragment, setFragment] = useState<{ id: number; text: string } | null>(null);
  const [coarse, setCoarse] = useState(false);
  /** Klíč remountuje scénu — jinak by „Znovu" pokračovalo v doletěné cestě. */
  const [run, setRun] = useState(0);
  const recorded = useRef(false);

  useEffect(() => {
    const query = window.matchMedia('(hover: none) and (pointer: coarse)');
    const update = () => setCoarse(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  // během letu schovej navigaci a chat — celá obrazovka patří obloze
  useEffect(() => {
    document.body.dataset.playing = phase === 'flying' ? '1' : '';
    return () => {
      document.body.dataset.playing = '';
    };
  }, [phase]);

  // text příběhu po každém sebraném světle
  useEffect(() => {
    if (!stats.lastLight) return;
    const light = SKY_LIGHTS.find((entry) => entry.id === stats.lastLight);
    if (!light) return;
    setFragment({ id: light.id, text: light.fragment[cs ? 'cs' : 'en'] });
    const timer = window.setTimeout(() => setFragment(null), 8000);
    return () => window.clearTimeout(timer);
  }, [stats.lastLight, cs]);

  const start = useCallback(() => {
    unlock();
    recorded.current = false;
    setStats(EMPTY);
    setNotice(null);
    setFragment(null);
    setRun((value) => value + 1);
    setPhase('flying');
  }, []);

  const finish = useCallback(
    (score: number) => {
      if (recorded.current) return;
      recorded.current = true;
      const outcome = recordRun({ game: 'wings', score, nickname: pickNickname() });
      setNotice(describeRun(outcome, cs, [`${score} ${cs ? 'bodů' : 'points'}`]));
      setPhase('done');
    },
    [cs],
  );

  const missing = Math.max(0, stats.total - stats.lights);

  return (
    <main className="sky">
      <div className="sky-stage">
        <SkyCanvas key={run} onStats={setStats} onFinish={finish} paused={phase !== 'flying'} />
      </div>

      <header className="sky-chrome">
        <div>
          <p className="sky-kicker">{cs ? 'Uran · vnější soustava' : 'Uranus · outer system'}</p>
          <h1>{cs ? 'Křídla' : 'Wings'}</h1>
          <p className="sky-sub">{cs ? 'Sedm světel a cesta' : 'Seven lights and a way'}</p>
        </div>
        <Link href="/uranus" className="saturn-back">
          ← {cs ? 'Uran' : 'Uranus'}
        </Link>
      </header>

      {phase === 'flying' && (
        <>
          <div className="sky-hud">
            <span className="sky-lights" aria-label={cs ? 'Sebraná světla' : 'Lights gathered'}>
              {Array.from({ length: stats.total }, (_, index) => (
                <i key={index} className={index < stats.lights ? 'is-on' : undefined} />
              ))}
              <b>
                {stats.lights}/{stats.total}
              </b>
            </span>
            <span className="sky-energy">
              <i style={{ width: `${Math.max(0, Math.min(100, stats.energy))}%` }} />
            </span>
            <span className="sky-time">{stats.time.toFixed(0)} s</span>
          </div>

          <p className="sky-hint">
            {coarse
              ? cs
                ? 'joystick = směr · ŠIPKA NAHORU = pláštěnka'
                : 'stick = direction · UP = cape'
              : cs
                ? 'šipky / WASD = směr · mezerník nebo ↑ = pláštěnka · proudy vzduchu tě nesou'
                : 'arrows / WASD = direction · space or ↑ = cape · air currents carry you'}
          </p>

          {missing > 0 ? (
            <p className="sky-goal">
              {cs ? `Do svatyně zbývá ${missing} světel` : `${missing} lights to the shrine`}
            </p>
          ) : (
            <p className="sky-goal is-open">{cs ? 'Svatyně je otevřená — doleť k ní' : 'The shrine is open — fly to it'}</p>
          )}

          {fragment && (
            <figure className="sky-fragment" key={fragment.id}>
              <cite>{fragment.text}</cite>
            </figure>
          )}

          {coarse && (
            <div className="sky-touch">
              <TouchButton code="ArrowUp" className="is-up">
                {cs ? 'VZHŮRU' : 'UP'}
              </TouchButton>
              <TouchButton code="ArrowLeft" className="is-left">
                ←
              </TouchButton>
              <TouchButton code="ArrowDown" className="is-down">
                ↓
              </TouchButton>
              <TouchButton code="ArrowRight" className="is-right">
                →
              </TouchButton>
            </div>
          )}
        </>
      )}

      {phase === 'intro' && (
        <section className="sky-panel">
          <h2>{cs ? 'Křídla' : 'Wings'}</h2>
          <p>{SKY_INTRO[cs ? 'cs' : 'en']}</p>
          <ul className="sky-rules">
            <li>{cs ? 'Pláštěnka tě zvedá, ale dochází. Klouzání ji dobíjí.' : 'The cape lifts you but runs out. Gliding refills it.'}</li>
            <li>{cs ? 'Proudy vzduchu nesou a dobíjejí — hledej je.' : 'Air currents carry you and refill you — look for them.'}</li>
            <li>{cs ? 'Svatyně se otevře, až když máš všech sedm.' : 'The shrine opens only when you have all seven.'}</li>
          </ul>
          <button type="button" className="park-btn sky-start" onClick={start}>
            {cs ? 'Vzlétnout' : 'Take off'}
          </button>
        </section>
      )}

      {phase === 'done' && (
        <section className="sky-panel is-done">
          <h2>{cs ? 'Světlo se vrátilo' : 'The light returned'}</h2>
          <p>{SKY_FINISH[cs ? 'cs' : 'en']}</p>
          <dl className="sky-score">
            <div>
              <dt>{cs ? 'světla' : 'lights'}</dt>
              <dd>
                {stats.lights}/{stats.total}
              </dd>
            </div>
            <div>
              <dt>{cs ? 'čas' : 'time'}</dt>
              <dd>{stats.time.toFixed(0)} s</dd>
            </div>
          </dl>
          {notice && <p className="sky-notice">{notice}</p>}
          <div className="sky-actions">
            <button type="button" className="park-btn" onClick={start}>
              {cs ? 'Znovu' : 'Again'}
            </button>
            <Link href="/uranus" className="arena-link">
              ← {cs ? 'zpět na Uran' : 'back to Uranus'}
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
