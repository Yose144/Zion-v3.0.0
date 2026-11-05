'use client';

/**
 * KŘÍDLA — hratelný svět na Uranu.
 *
 * Cesta, ne soutěž: sedm světel v ledové obloze, svatyně na konci a text,
 * který se odemyká po jednom. Žádní nepřátelé, žádný časový limit —
 * kdyby hra trestala pomalé kochání, byla by to jiná hra.
 *
 * Dvě cesty a jedna volba na konci:
 *  - `calm` / `wind` — stejný příběh, jiný rozptyl (data v `world.ts`),
 *  - **nechat si světlo, nebo darovat** — darování dá bonus a jiný text.
 *    Je to volba, ne vylepšení: nic z toho neposiluje hru.
 *
 * Co stránka drží: fázi, HUD, texty a zápis dohrané cesty do společné
 * progrese (`recordRun`). Fyzika i scéna jsou v `core/sky/`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/core/i18n';
import { LumiCanvas, type LumiStats } from '@/core/lumi/LumiScene';
import {
  LUMI_FINISH,
  LUMI_GIFT,
  LUMI_GIFT_BONUS,
  LUMI_PATHS,
  pathData,
  type LumiPathId,
} from '@/core/lumi/world';
import { describeRun, nickname as pickNickname, recordRun } from '@/core/progress/run';
import { unlock } from '@/core/audio/engine';
import { TouchButton } from '@/core/games/TouchPad';

type Phase = 'intro' | 'flying' | 'done';
type Gift = 'keep' | 'give';

export default function KridlaPage() {
  const { lang } = useI18n();
  const cs = lang === 'cs';

  const [phase, setPhase] = useState<Phase>('intro');
  const [pathId, setPathId] = useState<LumiPathId>('calm');
  const [stats, setStats] = useState<LumiStats>({ lights: 0, total: 7, energy: 100, time: 0, finished: false, lastLight: null });
  const [notice, setNotice] = useState<string | null>(null);
  const [fragment, setFragment] = useState<{ id: number; text: string } | null>(null);
  const [baseScore, setBaseScore] = useState(0);
  const [gift, setGift] = useState<Gift | null>(null);
  const [coarse, setCoarse] = useState(false);
  /** Klíč remountuje scénu — jinak by „Znovu" pokračovalo v doletěné cestě. */
  const [run, setRun] = useState(0);
  const recorded = useRef(false);

  const path = pathData(pathId);
  const missing = Math.max(0, stats.total - stats.lights);

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
    const light = path.lights.find((entry) => entry.id === stats.lastLight);
    if (!light) return;
    setFragment({ id: light.id, text: light.fragment[cs ? 'cs' : 'en'] });
    const timer = window.setTimeout(() => setFragment(null), 8000);
    return () => window.clearTimeout(timer);
  }, [stats.lastLight, cs, path]);

  const start = useCallback(() => {
    unlock();
    recorded.current = false;
    setStats({ lights: 0, total: pathData(pathId).lights.length, energy: 100, time: 0, finished: false, lastLight: null });
    setNotice(null);
    setFragment(null);
    setGift(null);
    setBaseScore(0);
    setRun((value) => value + 1);
    setPhase('flying');
  }, [pathId]);

  /** Scéna jen oznámí dolet — zapisuje se až po volbě (nechat / darovat). */
  const finish = useCallback((score: number) => {
    setBaseScore(score);
    setPhase('done');
  }, []);

  const chooseGift = useCallback(
    (kind: Gift) => {
      if (recorded.current) return;
      recorded.current = true;
      setGift(kind);
      const score = baseScore + (kind === 'give' ? LUMI_GIFT_BONUS : 0);
      const outcome = recordRun({ game: 'lumi', score, nickname: pickNickname() });
      setNotice(
        describeRun(outcome, cs, [
          `${score} ${cs ? 'bodů' : 'points'}`,
          ...(kind === 'give' ? [cs ? 'darováno' : 'given'] : []),
        ]),
      );
    },
    [baseScore, cs],
  );

  return (
    <main className="sky">
      <div className="lumi-stage">
        <LumiCanvas
          key={`${pathId}-${run}`}
          path={path}
          onStats={setStats}
          onFinish={finish}
          paused={phase !== 'flying'}
          detail={!coarse}
        />
      </div>

      <header className="lumi-chrome">
        <div>
          <p className="lumi-kicker">{cs ? 'Uran · vnější soustava' : 'Uranus · outer system'}</p>
          <h1>Lumi</h1>
          <p className="lumi-sub">
            {cs ? 'děvčátko s lucernou' : 'the girl with the lantern'} · {path.name[cs ? 'cs' : 'en']}
          </p>
        </div>
        <Link href="/uranus" className="saturn-back">
          ← {cs ? 'Uran' : 'Uranus'}
        </Link>
      </header>

      {phase === 'flying' && (
        <>
          <div className="lumi-hud">
            <span className="lumi-lights" aria-label={cs ? 'Sebraná světla' : 'Lights gathered'}>
              {Array.from({ length: stats.total }, (_, index) => (
                <i key={index} className={index < stats.lights ? 'is-on' : undefined} />
              ))}
              <b>
                {stats.lights}/{stats.total}
              </b>
            </span>
            <span className="lumi-energy" title={cs ? 'světlo lucerny' : 'lantern light'}>
              <i style={{ width: `${Math.max(0, Math.min(100, stats.energy))}%` }} />
            </span>
            <span className="lumi-time">{stats.time.toFixed(0)} s</span>
          </div>

          <p className="lumi-hint">
            {coarse
              ? cs
                ? 'joystick = směr · ŠIPKA NAHORU = lucerna'
                : 'stick = direction · UP = lantern'
              : cs
                ? 'šipky / WASD = směr · mezerník nebo ↑ = lucerna · proudy vzduchu tě nesou'
                : 'arrows / WASD = direction · space or ↑ = lantern · air currents carry you'}
          </p>

          {missing > 0 ? (
            <p className="lumi-goal">
              {cs ? `Do svatyně zbývá ${missing} světel` : `${missing} lights to the shrine`}
            </p>
          ) : (
            <p className="lumi-goal is-open">{cs ? 'Svatyně je otevřená — doleť k ní' : 'The shrine is open — fly to it'}</p>
          )}

          {fragment && (
            <figure className="lumi-fragment" key={fragment.id}>
              <cite>{fragment.text}</cite>
            </figure>
          )}

          {coarse && (
            <div className="lumi-touch">
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
        <section className="lumi-panel">
          <h2>Lumi</h2>
          <p>{path.intro[cs ? 'cs' : 'en']}</p>
          <ul className="lumi-rules">
            <li>
              {cs
                ? 'Lucerna svítí a nese, ale dohořívá. Klouzání ji dobíjí.'
                : 'The lantern shines and carries you, but it burns down. Gliding refills it.'}
            </li>
            <li>{cs ? 'Proudy vzduchu nesou a dobíjejí — hledej je.' : 'Air currents carry you and refill you — look for them.'}</li>
            <li>{cs ? 'Svatyně se otevře, až když máš všech sedm.' : 'The shrine opens only when you have all seven.'}</li>
          </ul>

          <div className="lumi-paths" role="radiogroup" aria-label={cs ? 'Cesta' : 'Path'}>
            {(Object.values(LUMI_PATHS) as (typeof LUMI_PATHS)[LumiPathId][]).map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={pathId === option.id}
                className={`lumi-path${pathId === option.id ? ' is-active' : ''}`}
                onClick={() => setPathId(option.id)}
              >
                <strong>{option.name[cs ? 'cs' : 'en']}</strong>
                <span>{option.note[cs ? 'cs' : 'en']}</span>
              </button>
            ))}
          </div>

          <button type="button" className="park-btn lumi-start" onClick={start}>
            {cs ? 'Vzlétnout' : 'Take off'}
          </button>
        </section>
      )}

      {phase === 'done' && (
        <section className="lumi-panel is-done">
          <h2>{cs ? 'Světlo se vrátilo' : 'The light returned'}</h2>
          <p>{gift ? LUMI_GIFT[gift].text[cs ? 'cs' : 'en'] : LUMI_FINISH[cs ? 'cs' : 'en']}</p>

          <dl className="lumi-score">
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
            <div>
              <dt>{cs ? 'cesta' : 'path'}</dt>
              <dd>{path.name[cs ? 'cs' : 'en']}</dd>
            </div>
          </dl>

          {!gift ? (
            <div className="lumi-gift" role="group" aria-label={cs ? 'Co uděláš se světlem' : 'What you do with the light'}>
              <button type="button" className="park-btn" onClick={() => chooseGift('keep')}>
                {LUMI_GIFT.keep.label[cs ? 'cs' : 'en']}
              </button>
              <button type="button" className="park-btn lumi-gift-give" onClick={() => chooseGift('give')}>
                {LUMI_GIFT.give.label[cs ? 'cs' : 'en']}
                <em>+{LUMI_GIFT_BONUS}</em>
              </button>
            </div>
          ) : (
            <p className="lumi-gift-done">
              {gift === 'give'
                ? cs
                  ? 'Dal jsi světlo dál.'
                  : 'You passed the light on.'
                : cs
                  ? 'Nechal jsi si světlo.'
                  : 'You kept the light.'}
            </p>
          )}

          {notice && <p className="lumi-notice">{notice}</p>}

          <div className="lumi-actions">
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
