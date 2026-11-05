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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { EMPTY_JOURNAL, isPathUnlocked, loadJournal, recordJourney, type LumiJournal } from '@/core/lumi/journal';
import { play, startWindLoop, type LoopHandle } from '@/core/audio/engine';
import { useNet } from '@/core/net/useNet';
import { InviteButton } from '@/core/net/InviteButton';
import type { LumiRemote } from '@/core/lumi/LumiScene';
import { unlock } from '@/core/audio/engine';
import { TouchButton } from '@/core/games/TouchPad';

type Phase = 'intro' | 'flying' | 'done';
type Gift = 'keep' | 'give';

const EMPTY: LumiStats = {
  lights: 0,
  speed: 0,
  lightIds: [],
  x: 0,
  y: 0,
  target: null,
  total: 7,
  energy: 100,
  time: 0,
  finished: false,
  lastLight: null,
};

export default function LumiPage() {
  const { lang } = useI18n();
  const cs = lang === 'cs';

  const [phase, setPhase] = useState<Phase>('intro');
  const [pathId, setPathId] = useState<LumiPathId>('calm');
  const [stats, setStats] = useState<LumiStats>(EMPTY);
  const [notice, setNotice] = useState<string | null>(null);
  const [fragment, setFragment] = useState<{ id: number; text: string } | null>(null);
  const [baseScore, setBaseScore] = useState(0);
  const [gift, setGift] = useState<Gift | null>(null);
  const [coarse, setCoarse] = useState(false);
  /** Klíč remountuje scénu — jinak by „Znovu" pokračovalo v doletěné cestě. */
  const [run, setRun] = useState(0);
  const recorded = useRef(false);
  /** Deník: sebraná světla zůstávají, i když hra skončí. */
  const [journal, setJournal] = useState<LumiJournal>(EMPTY_JOURNAL);
  const [journalOpen, setJournalOpen] = useState(false);
  /** Vítr běží jen během letu — po doletu zmlkne. */
  const wind = useRef<LoopHandle | null>(null);

  // ── společné létání ────────────────────────────────────────────────
  const { subscribe, joinLumi, leaveRoom, sendFly, connected, roomId } = useNet();
  /** `true` = letí se s ostatními; sólo zůstává výchozí. */
  const [coop, setCoop] = useState(false);
  /** Ostatní letci a sdílená světla — refy, protože chodí 15×/s. */
  const remotes = useRef<LumiRemote[]>([]);
  const sharedLights = useRef<number[]>([]);
  const [peers, setPeers] = useState(0);
  const [peerNames, setPeerNames] = useState<string[]>([]);

  const path = pathData(pathId);
  const missing = Math.max(0, stats.total - stats.lights);

  /**
   * Kompas k nejbližšímu světlu (a po sedmi ke svatyni).
   *
   * Otevřená obloha je bez kompasu slepá: sedm světel se rozprostírá po
   * mapě 118 × 118 a hráč nemá jak poznat, kterým směrem je to nejbližší.
   * Cíl počítá `nextTarget` ve flight.ts — stejná funkce jako simulace,
   * takže se kompas nemůže rozejít s tím, co hra opravdu považuje za cíl.
   */
  const compass = useMemo(() => {
    if (!stats.target) return null;
    const dx = stats.target.x - stats.x;
    const dy = stats.target.y - stats.y;
    const dist = Math.hypot(dx, dy);
    return {
      // Kamera kouká na scénu z +z, takže na obrazovce je +x vpravo a +y
      // nahoru — osa y se proto obrací (jinak by šipka mířila zrcadlově).
      // Šipka je kreslená jako „▲" (0° = nahoru), proto +90°.
      angle: (Math.atan2(-dy, dx) * 180) / Math.PI + 90,
      dist,
      kind: stats.target.kind,
    };
  }, [stats.target, stats.x, stats.y]);

  useEffect(() => {
    setJournal(loadJournal());
  }, []);

  // snapshoty společného letu
  useEffect(() => {
    if (!coop) return;
    return subscribe((message) => {
      if (message.t !== 'snapshot' || message.game !== 'lumi' || !message.lumi) return;
      remotes.current = message.lumi.flyers.map((flyer) => ({
        id: flyer.id,
        name: flyer.name,
        x: flyer.x,
        y: flyer.y,
        vx: flyer.vx,
        vy: flyer.vy,
        energy: flyer.energy,
        finished: flyer.finished,
      }));
      sharedLights.current = message.lumi.lights;
      setPeers(message.lumi.flyers.length);
      setPeerNames(message.lumi.flyers.map((flyer) => flyer.name).filter(Boolean).slice(0, 3));
    });
  }, [coop, subscribe]);

  // připojení / odpojení podle fáze
  useEffect(() => {
    if (!coop || phase !== 'flying' || !connected) return;
    joinLumi(pathId);
    return () => {
      leaveRoom();
      remotes.current = [];
      sharedLights.current = [];
      setPeers(0);
      setPeerNames([]);
    };
  }, [coop, phase, connected, joinLumi, leaveRoom, pathId]);

  // vítr: start s letem, stop při doletu i při odchodu ze stránky
  useEffect(() => {
    if (phase !== 'flying') return;
    wind.current = startWindLoop();
    return () => {
      wind.current?.stop();
      wind.current = null;
    };
  }, [phase]);

  useEffect(() => {
    wind.current?.setIntensity(Math.min(1, (stats.speed ?? 0) / 26));
  }, [stats.speed]);

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
    if (!isPathUnlocked(pathId, journal)) return;
    unlock();
    recorded.current = false;
    setStats({ ...EMPTY, total: pathData(pathId).lights.length });
    setNotice(null);
    setFragment(null);
    setGift(null);
    setBaseScore(0);
    setRun((value) => value + 1);
    setPhase('flying');
    play('lanternIgnite');
  }, [pathId, journal]);

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
      // deník: světla i volba zůstávají pro příště
      setJournal(recordJourney(stats.lightIds ?? [], kind, pathId));
      play(kind === 'give' ? 'gift' : 'shrineOpen');
      setNotice(
        describeRun(outcome, cs, [
          `${score} ${cs ? 'bodů' : 'points'}`,
          ...(kind === 'give' ? [cs ? 'darováno' : 'given'] : []),
        ]),
      );
    },
    [baseScore, cs, pathId, stats.lightIds],
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
          remotes={coop ? remotes : undefined}
          sharedLights={coop ? sharedLights : undefined}
          onFly={
            coop
              ? (state) => {
                  sendFly(state);
                }
              : undefined
          }
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
            {compass && (
              <span
                className={`lumi-compass${compass.kind === 'shrine' ? ' is-shrine' : ''}`}
                aria-label={
                  compass.kind === 'shrine'
                    ? cs
                      ? 'kompas ke svatyni'
                      : 'compass to the shrine'
                    : cs
                      ? 'kompas k nejbližšímu světlu'
                      : 'compass to the nearest light'
                }
                title={
                  compass.kind === 'shrine'
                    ? cs
                      ? `svatyně · ${Math.round(compass.dist)}`
                      : `shrine · ${Math.round(compass.dist)}`
                    : cs
                      ? `světlo · ${Math.round(compass.dist)}`
                      : `light · ${Math.round(compass.dist)}`
                }
              >
                <i aria-hidden>
                  {/* Otáčí se **atributem** uvnitř SVG, ne CSS transformem:
                      `transform: rotate()` na HTML prvku se v headless
                      rendereru (SwiftShader) kreslí o čtvrtinu otáčky jinde
                      a šipka pak míří špatně. Atribut je v obou světech
                      stejný a test ho umí změřit. */}
                  <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden focusable="false">
                    <g transform={`rotate(${compass.angle} 12 12)`}>
                      <path d="M12 3 L21 21 L3 21 Z" fill="currentColor" />
                    </g>
                  </svg>
                </i>
                <b>{Math.round(compass.dist)}</b>
              </span>
            )}
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

          {coop && (
            <div className="lumi-peers" role="status">
              <span>
                🌐{' '}
                {peers > 0
                  ? cs
                    ? `s tebou letí ${peers}${peerNames.length ? ` — ${peerNames.join(', ')}` : ''}`
                    : `${peers} flying with you${peerNames.length ? ` — ${peerNames.join(', ')}` : ''}`
                  : cs
                    ? 'hledám další…'
                    : 'looking for others…'}
              </span>
              <InviteButton roomId={roomId} className="lumi-invite" label={{ cs: 'pozvat', en: 'invite' }} />
            </div>
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
            {(Object.values(LUMI_PATHS) as (typeof LUMI_PATHS)[LumiPathId][]).map((option) => {
              const unlocked = isPathUnlocked(option.id, journal);
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={pathId === option.id}
                  disabled={!unlocked}
                  className={`lumi-path${pathId === option.id ? ' is-active' : ''}${unlocked ? '' : ' is-locked'}`}
                  onClick={() => unlocked && setPathId(option.id)}
                  title={
                    unlocked
                      ? option.note[cs ? 'cs' : 'en']
                      : cs
                        ? 'Odemkne se po dohrání obou cest'
                        : 'Unlocks after finishing both paths'
                  }
                >
                  <strong>
                    {unlocked ? '' : '🔒 '}
                    {option.name[cs ? 'cs' : 'en']}
                  </strong>
                  <span>
                    {unlocked
                      ? option.note[cs ? 'cs' : 'en']
                      : cs
                        ? 'nejdřív doleť obě předchozí cesty'
                        : 'finish the two earlier paths first'}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="lumi-coop" role="group" aria-label={cs ? 'S kým letět' : 'Fly with'}>
            <button
              type="button"
              className={`lumi-coop-btn${coop ? '' : ' is-active'}`}
              aria-pressed={!coop}
              onClick={() => setCoop(false)}
            >
              {cs ? 'Sólo' : 'Solo'}
            </button>
            <button
              type="button"
              className={`lumi-coop-btn${coop ? ' is-active' : ''}`}
              aria-pressed={coop}
              onClick={() => setCoop(true)}
              title={connected ? undefined : cs ? 'server není dostupný' : 'server unavailable'}
            >
              {cs ? 'S kamarádem' : 'With a friend'}
            </button>
          </div>

          <div className="lumi-intro-actions">
            <button type="button" className="park-btn lumi-start" onClick={start}>
              {cs ? 'Vzlétnout' : 'Take off'}
            </button>
            <button type="button" className="arena-link lumi-journal-open" onClick={() => setJournalOpen(true)}>
              {cs ? 'Deník' : 'Journal'} {journal.found.length}/7
            </button>
          </div>
        </section>
      )}

      {journalOpen && (
        <section className="lumi-journal" role="dialog" aria-modal="true" aria-label={cs ? 'Deník světel' : 'Journal of lights'}>
          <header>
            <div>
              <strong>{cs ? 'Deník světel' : 'Journal of lights'}</strong>
              <span>
                {cs
                  ? `${journal.found.length}/7 nalezeno · ${journal.runs} cest · darováno ${journal.gifts.give}×`
                  : `${journal.found.length}/7 found · ${journal.runs} journeys · given ${journal.gifts.give}×`}
              </span>
            </div>
            <button type="button" className="lumi-journal-close" onClick={() => setJournalOpen(false)} aria-label={cs ? 'Zavřít' : 'Close'}>
              ×
            </button>
          </header>
          <ol>
            {pathData('calm').lights.map((light) => {
              const found = journal.found.includes(light.id);
              return (
                <li key={light.id} className={found ? 'is-found' : undefined}>
                  <span className="lumi-journal-index">{light.id}</span>
                  <p>{found ? light.fragment[cs ? 'cs' : 'en'] : cs ? '— ještě nenalezeno —' : '— not found yet —'}</p>
                </li>
              );
            })}
          </ol>
          <p className="lumi-journal-note">
            {cs
              ? 'Deník se ukládá v prohlížeči. Cesty jsou dvě a světla jsou v obou stejná — jde o to je donést.'
              : 'The journal lives in your browser. There are two paths and the lights are the same in both — carrying them is the point.'}
          </p>
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
