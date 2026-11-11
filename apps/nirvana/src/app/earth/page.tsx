'use client';

/**
 * PRVNÍ SVĚT — MOBA na Zemi (L4 × L5).
 *
 * „Nejlepší hra prvního světa OASIS": tři linky mezi ZIONem a Opozicí,
 * vlny minionů, věže, Nexy a **tři uzly L5** (Kailash, Uluru, Ekam), které
 * se dají převzít a dávají týmu bonus k poškození.
 *
 * Každá postava má **čtyři kouzla z kánonu** — sloty Q/W/E/R (klávesy
 * Q/F/E/R, protože `W` je pohyb vpřed — viz `core/moba/keys.ts`) se odvozují z její
 * ability (`Dharma Shield`, `Agni Pariksha`, `Cosmic Vision`…), takže Krišna
 * hraje jinak než Šiva. Zdroj: `core/moba/spells.ts`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AVATARS } from '@/core/avatars/catalog';
import { AVATAR_MODELS } from '@/core/avatars/models';
import { fill, tx, useI18n, type Lang } from '@/core/i18n';
import { MobaGame, type MobaStats } from '@/core/moba/MobaGame';
import { MobaOnline } from '@/core/moba/MobaOnline';
import { useXr } from '@/core/xr';
import { VrButton } from '@/core/xr/VrButton';
import { MobaEmoteWheel } from '@/core/moba/MobaEmoteWheel';
import { useNet } from '@/core/net/useNet';
import { describeRun, nickname as pickNickname, recordRun } from '@/core/progress/run';
import { GameBoard } from '@/core/games/GameBoard';
import { watchRoom } from '@/core/net/watch';
import { SpectatorBar } from '@/core/net/SpectatorBar';
import {
  HERO_OF_DAY_BONUS,
  heroOfDay,
  loadMastery,
  masteryLevel,
  recordMastery,
  type MasteryBook,
} from '@/core/moba/mastery';
import { MobaMinimap } from '@/core/moba/MobaMinimap';
import { NODE_SITES } from '@/core/moba/map';
import { BATTLE_SPELLS, ITEMS, ITEM_SLOTS, SELL_RATIO, WARD_STOCK_MAX, talentRole, totalXpAt, type BattleSpellId, type BotSkill, type ItemId, type TalentRole } from '@/core/moba/sim';

/** Rychlé hledání itemu podle id — používá inventář i obchod. */
const ITEM_BY_ID = new Map(ITEMS.map((item) => [item.id, item]));
import { SCHOOL_LABEL, aspectsFor, schoolOfAvatar, spellsForAvatar, type AspectId } from '@/core/moba/spells';
import { SpellIcon } from '@/core/moba/spellIcons';
import { portraitUrl } from '@/core/moba/portraits';
import { recommendNextItem, standingFrom } from '@/core/moba/build';
import { talentsFor } from '@/core/moba/sim';
import { SPELL_LABEL } from '@/core/moba/keys';
import { loadMobaLoadout, saveMobaLoadout } from '@/core/moba/loadout';
import { MobaTouch } from '@/core/moba/MobaTouch';
import { EARTH_COPY, type EarthCopyKey } from './copy';

/**
 * Dvanáct startovních hrdinů — zbytek rosteru jde vybrat na `/avatars`.
 * Každé id musí mít reálný 3D model (filtr `PLAYABLE` níž), jinak by se
 * nabídka zmenšila; 82/84/85/86 modely nemají, proto je nahradily
 * Vyása, Saint Germain, Lumi a Kanaloa (školy i palety se liší).
 */
const STARTERS = [0, 1, 2, 3, 4, 5, 17, 26, 40, 66, 19, 20];
/** Nabízejí se jen hrdinové s reálným 3D modelem (staré procedurální figury jsou archiv). */
const PLAYABLE = new Set(Object.keys(AVATAR_MODELS).map(Number));
const STARTERS_PLAYABLE = STARTERS.filter((id) => PLAYABLE.has(id));

/** Ikony buffů — jen to, co hráč opravdu může mít. */
const BUFF_ICON: Record<string, string> = {
  strength: '⚔',
  ward: '🛡',
  speed: '💨',
  ancient: '🌟',
  regen: '✚',
  burn: '🔥',
  invisible: '👁',
};

type Phase = 'pick' | 'playing' | 'ended';
type Mode = 'solo' | 'online';
type OnlinePhase = 'connecting' | 'waiting' | 'countdown' | 'running' | 'ended' | 'offline';

const EMPTY_STATS: MobaStats | null = null;

/** Rychlé zprávy pro multiplayer (server je čistí i rate-limituje). */
const QUICK_CHAT = [
  { cs: 'Dobrá práce!', en: 'Well played!' },
  { cs: 'Potřebuji pomoc!', en: 'Need help!' },
  { cs: 'Jdeme na Nexu!', en: 'Go Nexus!' },
  { cs: 'Pozor, mlha.', en: 'Careful, fog.' },
];


/** Portrét hrdiny s fallbackem na iniciálu (katalog má mezery v id). */
function Portrait({
  heroId,
  name,
  size = 'md',
}: {
  heroId: number;
  name: string;
  size?: 'md' | 'card' | 'mini';
}) {
  const url = portraitUrl(heroId);
  if (!url) {
    return (
      <span className={`moba-portrait is-${size} is-fallback`} aria-hidden="true">
        {name.slice(0, 1)}
      </span>
    );
  }
  return (
    <img
      className={`moba-portrait is-${size}`}
      src={url}
      alt=""
      loading="lazy"
      draggable={false}
    />
  );
}

/** Jedna tabulka scoreboardu — tým, K/D, zlato (+GPM), poškození, léčení. */
function TeamBoard({
  heroes,
  team,
  lang,
  youId,
  minutes,
}: {
  heroes: MobaStats['snapshot']['heroes'];
  team: 'blue' | 'red';
  lang: Lang;
  youId: string | null;
  minutes: number;
}) {
  /** Vlastní `l` — tabulka je samostatná komponenta, ne součást stránky. */
  const l = (key: EarthCopyKey) => tx(EARTH_COPY[key], lang);
  const list = heroes
    .filter((hero) => hero.team === team)
    .sort((a, b) => b.kills - a.kills || b.gold - a.gold);
  const gpm = (hero: (typeof list)[number]) => Math.round(hero.gold / Math.max(0.1, minutes));
  const xpm = (hero: (typeof list)[number]) => Math.round(totalXpAt(hero.level, hero.xp) / Math.max(0.1, minutes));

  return (
    <div className={`moba-board is-${team}`}>
      <strong>{team === 'blue' ? 'ZION' : l('opposition')}</strong>
      <table>
        <thead>
          <tr>
            <th>{l('hero')}</th>
            <th>Lv</th>
            <th>K/D</th>
            <th>{l('gold')}</th>
            <th>GPM</th>
            <th>XPM</th>
            <th>{l('damage')}</th>
            <th>{l('heal')}</th>
          </tr>
        </thead>
        <tbody>
          {list.map((hero) => (
            <tr key={hero.id} className={hero.id === youId ? 'is-you' : undefined}>
              <td>
                <Portrait heroId={hero.heroId} name={hero.name} size="mini" /> {hero.name}
              </td>
              <td>{hero.level}</td>
              <td>{hero.kills}/{hero.deaths}</td>
              <td>{Math.round(hero.gold)}</td>
              <td>{gpm(hero)}</td>
              <td>{xpm(hero)}</td>
              <td>{hero.damage ?? 0}</td>
              <td>{hero.healing ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function EarthPage() {
  const { lang } = useI18n();
  const { store: xrStore, presenting } = useXr();
  /** `?watch=<room>` = hlediště. Čte se v efektu (SSR `window` nemá). */
  const [watch, setWatch] = useState<string | null>(null);
  useEffect(() => {
    const room = watchRoom();
    if (!room?.startsWith('moba-')) return;
    setWatch(room);
    setMode('online');
    setPhase('playing');
  }, []);
  /** Texty obrazovky jdou přes `app/earth/copy.ts` — žádné `cs ? :` v JSX. */
  const l = useCallback(
    (key: EarthCopyKey, values?: Record<string, string | number>) => {
      const text = tx(EARTH_COPY[key], lang);
      return values ? fill(text, values) : text;
    },
    [lang],
  );
  const cs = lang === 'cs';
  const [heroId, setHeroId] = useState<number>(() => STARTERS_PLAYABLE[0] ?? 0);
  const [loadoutReady, setLoadoutReady] = useState(false);
  const [foeId, setFoeId] = useState<number>(() => STARTERS_PLAYABLE[1] ?? STARTERS_PLAYABLE[0] ?? 0);
  const [phase, setPhase] = useState<Phase>('pick');
  const [mode, setMode] = useState<Mode>('solo');
  const [botSkill, setBotSkill] = useState<BotSkill>('normal');
  const [battleSpell, setBattleSpell] = useState<BattleSpellId>('flicker');
  /** Aspekt kouzel — volba před zápasem (dvě varianty stejné školy). */
  const [aspect, setAspect] = useState<AspectId>('a');
  useEffect(() => {
    const pick = loadMobaLoadout();
    if (PLAYABLE.has(pick.heroId)) setHeroId(pick.heroId);
    setAspect(pick.aspect);
    setBattleSpell(pick.battleSpell);
    setLoadoutReady(true);
  }, []);
  useEffect(() => {
    if (!loadoutReady) return;
    saveMobaLoadout({ heroId, aspect, battleSpell });
  }, [loadoutReady, heroId, aspect, battleSpell]);
  const [emoteWheel, setEmoteWheel] = useState<{ x: number; y: number } | null>(null);
  const [scoreboard, setScoreboard] = useState(false);
  const [onlinePhase, setOnlinePhase] = useState<OnlinePhase>('connecting');
  const [stats, setStats] = useState<MobaStats | null>(EMPTY_STATS);
  const { sendChat, sendEmote } = useNet();
  const buyRequest = useRef<ItemId | null>(null);
  const sellRequest = useRef<ItemId | null>(null);
  const buybackRequest = useRef(false);
  const talentRequest = useRef<{ tier: number; pick: number } | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [winner, setWinner] = useState<'blue' | 'red' | null>(null);
  /** Hláška po zápase (žetony, rekord, výzva) — stejný text jako v ostatních hrách. */
  const [notice, setNotice] = useState<string | null>(null);
  /** Zápas se zapisuje jednou, i když se `winner` překreslí víckrát. */
  const recorded = useRef(false);
  /** Mistrovství se čte až po mountu (localStorage není na serveru). */
  const [mastery, setMastery] = useState<MasteryBook>({});
  const [masteryGain, setMasteryGain] = useState<{ hero: number; xp: number; level: number; title: string } | null>(null);
  const star = useMemo(() => heroOfDay(STARTERS_PLAYABLE), []);

  useEffect(() => {
    setMastery(loadMastery());
  }, [phase]);

  /** Dotykové ovládání — na mobilu joystick + kouzla místo WASD a Q/F/E/R. */
  const [coarse, setCoarse] = useState(false);

  // X = radiální emote menu (jen multiplayer; sólo nemá komu posílat)
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (watch || event.code !== 'KeyX' || mode !== 'online' || phase !== 'playing') return;
      event.preventDefault();
      setEmoteWheel((open) => open ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 });
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [mode, phase, watch]);

  // Tab = scoreboard (drží se jen během hry, aby nekradl fokus jinde)
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code !== 'Tab') return;
      if (phase !== 'playing') return;
      event.preventDefault();
      setScoreboard((open) => !open);
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [phase]);

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

  const hero = useMemo(() => AVATARS.find((entry) => entry.id === heroId) ?? AVATARS[0]!, [heroId]);
  const foe = useMemo(() => AVATARS.find((entry) => entry.id === foeId) ?? AVATARS[0]!, [foeId]);
  const spells = useMemo(() => spellsForAvatar(heroId, aspect), [heroId, aspect]);
  const aspectOptions = useMemo(() => aspectsFor(schoolOfAvatar(heroId)), [heroId]);

  const start = useCallback(() => {
    setStats(null);
    setWinner(null);
    setNotice(null);
    setMasteryGain(null);
    recorded.current = false;
    setOnlinePhase(mode === 'online' ? 'connecting' : 'running');
    setPhase('playing');
  }, [mode]);

  const onStats = useCallback((next: MobaStats) => setStats(next), []);
  const onEnd = useCallback((result: 'blue' | 'red') => {
    setWinner(result);
    setPhase('ended');
  }, []);

  /**
   * Zápis dohraného zápasu. Skóre je jedno číslo pro tabuli: výhra nese
   * nejvíc, pak zabití, level a zlato — aby se nedalo „vyhrát" jen útěkem.
   */
  useEffect(() => {
    if (watch) return;
    if (!winner || !stats || recorded.current) return;
    recorded.current = true;
    const won = winner === 'blue';
    const score = (won ? 600 : 0) + stats.kills * 30 + stats.playerLevel * 20 + Math.round(stats.gold / 50);
    const outcome = recordRun({
      game: 'moba',
      score,
      nickname: pickNickname(),
      metrics: {
        // zápas nemá ve snapshotu čas konce — bere se typická délka zápasu
        seconds: 240,
        completed: won,
        objectives: stats.kills,
        objectivesTotal: Math.max(1, stats.kills + (stats.deaths ?? 0)),
        setbacks: stats.deaths ?? 0,
      },
    });

    // ── mistrovství hrdiny (kosmetické, bez vlivu na hru) ──────────
    const mvpScore = (hero: MobaStats['snapshot']['heroes'][number]) =>
      hero.damage + hero.kills * 250 + hero.healing * 0.6 + hero.gold * 0.5;
    const table = [...stats.snapshot.heroes].sort((a, b) => mvpScore(b) - mvpScore(a));
    const mvpId = table[0]?.id ?? null;
    const me = stats.snapshot.heroes.find((entry) => entry.id === stats.youId);
    const gain = recordMastery(heroId, {
      won,
      kills: stats.kills,
      deaths: stats.deaths,
      damage: me?.damage ?? 0,
      mvp: mvpId === stats.youId,
      versusBots: mode === 'solo',
      bonus: heroId === star ? HERO_OF_DAY_BONUS : 1,
    });
    setMastery(loadMastery());
    setMasteryGain({
      hero: heroId,
      xp: gain.xp,
      level: gain.after.level,
      title: tx(gain.after.title, lang),
    });

    setNotice(
      describeRun(outcome, cs, [
        won ? (l('win')) : l('loss'),
        `+${gain.xp} ${l('mastery')}`,
      ]),
    );
  }, [winner, stats, cs, heroId, mode, star, watch]);

  const nexusBlue = stats?.snapshot.towers.find((tower) => tower.id === 'blue-nexus');
  const nexusRed = stats?.snapshot.towers.find((tower) => tower.id === 'red-nexus');
  const clock = stats ? `${Math.floor(stats.snapshot.time / 60)}:${String(Math.floor(stats.snapshot.time % 60)).padStart(2, '0')}` : '0:00';

  return (
    <main className={`moba ${phase === 'playing' ? 'is-live' : ''}`}>
      <header className="moba-head">
        <div>
          <p className="moba-kicker">{l('kicker')}</p>
          <h1>{l('title')}</h1>
          <p className="moba-sub">
            {l('intro')}
          </p>
        </div>
        <div className="moba-head-links">
          {phase !== 'playing' && (
            <Link href="/avatars" className="moba-link">
              {l('fullRoster')} ↗
            </Link>
          )}
          {phase === 'playing' && !watch && (
            <button type="button" className="moba-link" onClick={() => setPhase('pick')}>
              {l('menu')}
            </button>
          )}
        </div>
      </header>

      {phase !== 'playing' && (
        <section className="moba-pick">
          <div className="moba-pick-block">
            <div className="moba-mode">
              <button
                type="button"
                className={`moba-mode-btn${mode === 'solo' ? ' is-active' : ''}`}
                onClick={() => setMode('solo')}
              >
                {l('soloVsBot')}
              </button>
              <button
                type="button"
                className={`moba-mode-btn${mode === 'online' ? ' is-active' : ''}`}
                onClick={() => setMode('online')}
              >
                {l('online')}
              </button>
            </div>
            <h2>{l('pickHero')}</h2>
            {(() => {
              // Nejsilnější hrdina z mistrovství — pochvala, ne bonus.
              const entries = Object.entries(mastery)
                .map(([key, value]) => ({ heroId: Number(key), value }))
                .filter((entry) => Number.isFinite(entry.heroId) && entry.value.xp > 0)
                .sort((a, b) => b.value.xp - a.value.xp);
              const top = entries[0];
              if (!top) return null;
              const name = AVATARS.find((entry) => entry.id === top.heroId)?.name ?? `#${top.heroId}`;
              const level = masteryLevel(top.value.xp);
              return (
                <p className="moba-best-hero">
                  {l('mostPlayed')}: <strong>{name}</strong>{' '}
                  <span>
                    {tx(level.title, lang)} · level {level.level} · {top.value.matches}{' '}
                    {l('matches')}
                  </span>
                </p>
              );
            })()}
            <div className="moba-pick-grid">
              {STARTERS_PLAYABLE.map((id) => {
                const entry = AVATARS.find((candidate) => candidate.id === id);
                if (!entry) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`moba-pick-card${id === heroId ? ' is-active' : ''}`}
                    onClick={() => {
                      setHeroId(id);
                      const other = STARTERS_PLAYABLE.find((candidate) => candidate !== id);
                      setFoeId(other ?? id);
                    }}
                  >
                    {star === id && (
                      <i className="moba-pick-star" title={l('heroOfDay')}>
                        ★
                      </i>
                    )}
                    <Portrait heroId={id} name={entry.name} size="card" />
                    <strong>{entry.name}</strong>
                    <span>{entry.subtitle}</span>
                    <em>
                      CL {entry.cl}
                      {mastery[id] ? (
                        <b className="moba-mastery">
                          {(() => {
                            const level = masteryLevel(mastery[id]!.xp);
                            return `${level.level} · ${tx(level.title, lang)}`;
                          })()}
                        </b>
                      ) : null}
                    </em>
                  </button>
                );
              })}
            </div>
            {mode === 'solo' && (
              <div className="moba-difficulty">
                <span>{l('botDifficulty')}</span>
                {(['easy', 'normal', 'hard'] as BotSkill[]).map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    className={`moba-mode-btn${botSkill === skill ? ' is-active' : ''}`}
                    onClick={() => setBotSkill(skill)}
                  >
                    {skill === 'easy' ? (l('easy')) : skill === 'hard' ? (l('hard')) : l('normal')}
                  </button>
                ))}
              </div>
            )}
            <p className="moba-pick-note">
              {l('pickNote', {
              hero: hero.name,
              foe: foe.name,
              spells: spells.map((spell) => spell.name).join(' · '),
            })}
            </p>
          </div>

          <div className="moba-pick-block">
            <h2>{l('howTo')}</h2>
            <ul className="moba-rules">
              <li>
                {coarse
                  ? l('touchHow')
                  : l('mouseMove')}
              </li>
              <li>{l('castHow')}</li>
              <li>{l('goal')}</li>
              <li>
                {l('nodesHow')}
              </li>
            </ul>
            <div className="moba-spells">
              {spells.map((spell) => (
                <div key={spell.slot} className="moba-spell" style={{ borderColor: `${spell.color}66` }}>
                  <span className="moba-spell-key">{SPELL_LABEL[spell.slot]}</span>
                  <SpellIcon slot={spell.slot} color={spell.color} size={26} />
                  <strong>{spell.name}</strong>
                  <small>
                    {spell.damage > 0 ? `${spell.damage} dmg` : spell.shield > 0 ? `${spell.shield} štít` : 'podpora'} ·{' '}
                    {Math.round(spell.cooldownMs / 100) / 10}s ·{' '}
                    {tx(SCHOOL_LABEL[spell.school], lang)}
                  </small>
                </div>
              ))}
            </div>
            <div className="moba-difficulty moba-difficulty-start">
              <span>{l('aspect')}</span>
              {aspectOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`moba-mode-btn${aspect === option.id ? ' is-active' : ''}`}
                  title={tx(option.note, lang)}
                  onClick={() => setAspect(option.id)}
                >
                  {tx(option.name, lang)}
                </button>
              ))}
            </div>
            <p className="moba-aspect-note">
              {tx(aspectOptions.find((option) => option.id === aspect)?.note, lang)}
            </p>
            <div className="moba-difficulty moba-difficulty-start">
              <span>{l('battleSpell')}</span>
              {(['flicker', 'heal', 'purify'] as BattleSpellId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`moba-mode-btn${battleSpell === id ? ' is-active' : ''}`}
                  title={tx(BATTLE_SPELLS[id].note, lang)}
                  onClick={() => setBattleSpell(id)}
                >
                  {tx(BATTLE_SPELLS[id].name, lang)}
                </button>
              ))}
            </div>
            <button type="button" className="moba-start" onClick={start}>
              {phase === 'ended' ? (l('playAgain')) : l('enter')}
            </button>
            {notice && <p className="moba-pick-note">{notice}</p>}
            <GameBoard game="moba" className="moba-board-panel" />
          </div>
        </section>
      )}

      {watch && <SpectatorBar room={watch} />}

      {phase === 'playing' && (
        <div className="moba-stage">
          {mode === 'solo' ? (
            <MobaGame
              playerHeroId={heroId}
              enemyHeroId={foeId}
              botSkill={botSkill}
              battleSpell={battleSpell}
              running
              onStats={onStats}
              onEnd={onEnd}
              buyRequest={buyRequest}
              sellRequest={sellRequest}
              buybackRequest={buybackRequest}
              talentRequest={talentRequest}
              autoAim={coarse || presenting}
              xr={presenting}
              xrStore={xrStore}
              aspect={aspect}
              debug={typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mobaDebug') === '1'}
            />
          ) : (
            <MobaOnline
              heroId={heroId}
              battleSpell={battleSpell}
              onStats={onStats}
              onEnd={onEnd}
              onPhase={setOnlinePhase}
              buyRequest={buyRequest}
              sellRequest={sellRequest}
              buybackRequest={buybackRequest}
              talentRequest={talentRequest}
              autoAim={coarse || presenting}
              xr={presenting}
              xrStore={xrStore}
              watch={watch}
              aspect={aspect}
              debug={typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mobaDebug') === '1'}
            />
          )}

          {coarse && !watch && <MobaTouch spells={spells} />}

          {mode === 'online' && (onlinePhase === 'connecting' || onlinePhase === 'waiting' || onlinePhase === 'countdown' || onlinePhase === 'offline') && (
            <div className="moba-status" role="status" aria-live="polite">
              <strong>
                {onlinePhase === 'offline'
                  ? l('serverOffline')
                  : onlinePhase === 'countdown'
                    ? l('matchStarting')
                    : onlinePhase === 'waiting'
                      ? l('waitingPlayers')
                      : l('connecting')}
              </strong>
              <span>
                {onlinePhase === 'offline'
                  ? l('tryAgain')
                  : l('botsFill')}
              </span>
            </div>
          )}

          <div className="moba-hud-top">
            <div className="moba-nexus is-blue">
              <span>ZION</span>
              <div className="moba-nexus-bar">
                <i style={{ width: `${((nexusBlue?.hp ?? 0) / (nexusBlue?.maxHp ?? 1)) * 100}%` }} />
              </div>
            </div>
            <VrButton xr={{ store: xrStore, presenting }} className="arena-vr moba-vr" />
            <div className="moba-clock">
              <strong>{clock}</strong>
              <small>
                {l('wave')} {stats?.snapshot.wave ?? 0} · {stats?.snapshot.nextWaveIn ?? 0}s
              </small>
            </div>
            <div className="moba-nexus is-red">
              <span>OPOZICE</span>
              <div className="moba-nexus-bar">
                <i style={{ width: `${((nexusRed?.hp ?? 0) / (nexusRed?.maxHp ?? 1)) * 100}%` }} />
              </div>
            </div>
          </div>

          <div className="moba-nodes">
            {NODE_SITES.map((site) => {
              const owner = stats?.nodeOwner.find((node) => node.key === site.key)?.owner ?? null;
              return (
                <span key={site.key} className={`moba-node${owner ? ` is-${owner}` : ''}`}>
                  {site.name}
                </span>
              );
            })}
          </div>

          <div className="moba-hud-bottom">
            {!watch && (stats?.recallIn ?? 0) > 0 && (
              <div className="moba-recall-progress" role="status" aria-live="polite">
                <i style={{ width: `${100 - ((stats?.recallIn ?? 0) / 4000) * 100}%` }} />
                <span>{l('recalling')}</span>
              </div>
            )}
            {!watch && stats?.invisible && (
              <div className="moba-invisible" role="status">
                {l('invisible')}
              </div>
            )}
            {!watch && (
            <div className="moba-vitals">
              <div className="moba-bar is-hp">
                <i style={{ width: `${((stats?.playerHp ?? 0) / (stats?.playerMaxHp ?? 1)) * 100}%` }} />
                <span>
                  {stats?.playerHp ?? 0} / {stats?.playerMaxHp ?? 0}
                </span>
              </div>
              <div className="moba-bar is-mana">
                <i style={{ width: `${((stats?.playerMana ?? 0) / (stats?.playerMaxMana ?? 1)) * 100}%` }} />
                <span>
                  {stats?.playerMana ?? 0} / {stats?.playerMaxMana ?? 0}
                </span>
              </div>
              <div className="moba-bar is-xp" title={l('xp')}>
                <i style={{ width: `${((stats?.xp ?? 0) / (stats?.xpNeed ?? 1)) * 100}%` }} />
                <span>
                  XP {stats?.xp ?? 0} / {stats?.xpNeed ?? 1}
                </span>
              </div>
              {(() => {
                // Aktivní buffy vlastního hrdiny — týmová aura z řeky musí
                // být vidět, jinak si jí hráč nevšimne a nic nezmění.
                const me = stats?.snapshot.heroes.find((entry) => entry.id === stats.youId);
                const now = stats?.snapshot.time ?? 0;
                const active = (me?.buffs ?? [])
                  .filter((buff) => buff.until > now)
                  .slice(0, 4);
                if (active.length === 0) return null;
                return (
                  <div className="moba-buffs" aria-label={l('buffs')}>
                    {active.map((buff, index) => {
                      const left = Math.max(0, Math.ceil((buff.until - now) / 1000));
                      return (
                        <span key={`${buff.type}-${index}`} className={`moba-buff is-${buff.type}`}>
                          {BUFF_ICON[buff.type] ?? '✦'} {left}s
                        </span>
                      );
                    })}
                  </div>
                );
              })()}
              <div className="moba-score">
                <Portrait heroId={stats?.playerHeroId ?? heroId} name={hero.name} />
                <strong>{hero.name}</strong>
                <span>
                  Lv {stats?.playerLevel ?? 1} · {stats?.kills ?? 0}/{stats?.deaths ?? 0} ·{' '}
                  {tx(aspectOptions.find((option) => option.id === aspect)?.name, lang)}
                  {(stats?.streak ?? 0) >= 2 && (
                    <b className={`moba-streak${(stats?.streak ?? 0) >= 5 ? ' is-hot' : ''}`}>
                      🔥{stats?.streak}
                    </b>
                  )}
                </span>
              </div>
            </div>
            )}

            {!watch && (
            <div className="moba-spellbar">
              {(stats?.spells ?? spells.map((spell) => ({ slot: spell.slot, name: spell.name, school: spell.school, cooldown: 0, cooldownMs: spell.cooldownMs, mana: spell.mana, color: spell.color, rank: 1 }))).map((spell) => {
                const cooldownPct = spell.cooldownMs ? Math.min(100, (spell.cooldown / spell.cooldownMs) * 100) : 0;
                return (
                  <div key={spell.slot} className={`moba-slot${spell.rank ? '' : ' is-locked'}`} style={{ borderColor: `${spell.color}88` }}>
                    <span className="moba-slot-key">{SPELL_LABEL[spell.slot]}</span>
                    <div className="moba-slot-body">
                      <SpellIcon slot={spell.slot} color={spell.color} size={22} />
                      <div className="moba-slot-text">
                        <strong>{spell.name}</strong>
                        <small>
                          {spell.rank ? `T${spell.rank} · ${spell.mana} mp` : l('lockedLv6')}
                        </small>
                      </div>
                    </div>
                    {cooldownPct > 0 && <i className="moba-slot-cd" style={{ height: `${cooldownPct}%` }} />}
                  </div>
                );
              })}
            </div>
            )}

            {!watch && (
            <div className="moba-shop" aria-label={l('shop')}>
              <span className="moba-shop-gold" title={l('goldLower')}>
                ◈ {stats?.gold ?? 0}
              </span>
              <span className="moba-ward-count" title={l('wards')}>
                🛡 {stats?.wards ?? 0}
              </span>
              <span className="moba-sentry-count" title={l('sentry')}>
                🕯 {stats?.sentries ?? 0}
              </span>
              <button
                type="button"
                className={`moba-recall${(stats?.recallIn ?? 0) > 0 ? ' is-channeling' : ''}`}
                title={l('recall')}
                onClick={() => {
                  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB', bubbles: true }));
                }}
              >
                ↩
                {(stats?.recallIn ?? 0) > 0 && <small>{((stats?.recallIn ?? 0) / 1000).toFixed(1)}</small>}
              </button>
              <button
                type="button"
                className={`moba-battlespell${(stats?.battleSpellIn ?? 0) > 0 ? ' is-cooling' : ''}`}
                title={l('flicker')}
                disabled={(stats?.battleSpellIn ?? 0) > 0}
                onClick={() => {
                  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', bubbles: true }));
                }}
              >
                {stats?.battleSpell === 'heal' ? '✚' : stats?.battleSpell === 'purify' ? '✦' : '⚡'}
                {(stats?.battleSpellIn ?? 0) > 0 && (
                  <small>{Math.ceil((stats?.battleSpellIn ?? 0) / 1000)}</small>
                )}
              </button>
              <div className="moba-inventory" title={l('inventoryHow')}>
                {Array.from({ length: ITEM_SLOTS }).map((_, index) => {
                  const itemId = stats?.items[index];
                  const item = itemId ? ITEM_BY_ID.get(itemId) : undefined;
                  const cooldown = itemId ? stats?.itemCooldowns?.[itemId] ?? 0 : 0;
                  const cooldownPct = item?.active && cooldown > 0
                    ? Math.min(100, (cooldown / item.active.cooldownMs) * 100)
                    : 0;
                  return (
                    <button
                      key={index}
                      type="button"
                      className={`moba-inv-slot${item ? ' is-filled' : ''}${item?.active ? ' is-active' : ''}`}
                      disabled={!item}
                      title={
                        item
                          ? `${tx(item.name, lang)} — ${tx(item.note, lang)}${item.active ? ` · ${l('key')} ${index + 1}` : ` · ${l('sell')} +${Math.round(item.cost * SELL_RATIO)} ◈`}`
                          : l('emptySlot')
                      }
                      onClick={() => {
                        if (!itemId) return;
                        // Aktivní item se používá stejnou cestou jako klávesa 1–6 —
                        // dotyk tak nepotřebuje druhý vstup.
                        if (item?.active) {
                          window.dispatchEvent(new KeyboardEvent('keydown', { code: `Digit${index + 1}`, bubbles: true }));
                          return;
                        }
                        sellRequest.current = itemId;
                      }}
                    >
                      {item ? tx(item.name, lang) : '·'}
                      {item && <em className="moba-inv-key">{index + 1}</em>}
                      {cooldownPct > 0 && <i className="moba-inv-cd" style={{ height: `${cooldownPct}%` }} />}
                      {item?.active && (
                        <span
                          role="button"
                          tabIndex={-1}
                          className="moba-inv-sell"
                          title={l('sellVerb')}
                          onClick={(event) => {
                            event.stopPropagation();
                            sellRequest.current = itemId!;
                          }}
                        >
                          ×
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className={`moba-shop-toggle${shopOpen ? ' is-open' : ''}`}
                onClick={() => setShopOpen((open) => !open)}
                title={l('shopLower')}
              >
                {shopOpen ? '×' : l('shop')}
              </button>
            </div>
            )}

            {!watch && shopOpen && (
              <div className="moba-shop-panel">
                {(() => {
                  const items = stats?.items ?? [];
                  const role = talentRole(spells[0]?.school ?? 'cosmic');
                  const mine = stats?.snapshot.heroes.filter((hero) => hero.team === (stats?.snapshot.heroes.find((h) => h.id === stats?.youId)?.team ?? 'blue')) ?? [];
                  const theirs = stats?.snapshot.heroes.filter((hero) => hero.team !== (stats?.snapshot.heroes.find((h) => h.id === stats?.youId)?.team ?? 'blue')) ?? [];
                  const standing = standingFrom({
                    ally: mine.reduce((sum, hero) => sum + hero.kills, 0),
                    enemy: theirs.reduce((sum, hero) => sum + hero.kills, 0),
                  });
                  const next = recommendNextItem(role, items, standing);
                  if (!next) return null;
                  const item = ITEM_BY_ID.get(next);
                  if (!item) return null;
                  const owned = (item.components ?? []).filter((component) => items.includes(component));
                  const price = Math.max(
                    0,
                    item.cost - owned.reduce((sum, component) => sum + (ITEM_BY_ID.get(component)?.cost ?? 0), 0),
                  );
                  const affordable = (stats?.gold ?? 0) >= price;
                  return (
                    <div className="moba-quickbuy">
                      <strong>{l('recommended')}</strong>
                      <button
                        type="button"
                        className="moba-quickbuy-btn"
                        disabled={!affordable}
                        onClick={() => {
                          buyRequest.current = next;
                        }}
                      >
                        <span>{tx(item.name, lang)}</span>
                        <small>{price} ◈</small>
                      </button>
                    </div>
                  );
                })()}

                {(['base', 'built'] as const).map((group) => (
                  <div key={group} className="moba-shop-group">
                    <strong>{group === 'base' ? (l('base')) : l('built')}</strong>
                    <div className="moba-shop-grid">
                      {ITEMS.filter((item) => (item.components ? 'built' : 'base') === group).map((item) => {
                        const items = stats?.items ?? [];
                        const ownedComponents = (item.components ?? []).filter((component) => items.includes(component));
                        const price = Math.max(
                          0,
                          item.cost - ownedComponents.reduce((sum, component) => sum + (ITEM_BY_ID.get(component)?.cost ?? 0), 0),
                        );
                        const consumable = item.consumable === true;
                        const isSentry = item.id === 'sentry';
                        const stock = isSentry ? stats?.sentries ?? 0 : stats?.wards ?? 0;
                        const stockMax = isSentry ? 2 : WARD_STOCK_MAX;
                        const maxed = consumable && stock >= stockMax;
                        const owned = items.includes(item.id);
                        const slotsAfter = items.length - ownedComponents.length + 1;
                        const full = !consumable && slotsAfter > ITEM_SLOTS;
                        const affordable = (stats?.gold ?? 0) >= price;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`moba-shop-item${owned ? ' is-owned' : ''}${item.components ? ' is-built' : ''}`}
                            disabled={owned || full || maxed || !affordable}
                            title={tx(item.note, lang)}
                            onClick={() => {
                              buyRequest.current = item.id;
                            }}
                          >
                            <strong>{tx(item.name, lang)}</strong>
                            <small>
                              {owned
                                ? l('owned')
                                : maxed
                                  ? l('fullStock')
                                  : full
                                    ? l('fullInventory')
                                    : `${price} ◈${consumable ? ` · ${stock}/${WARD_STOCK_MAX}` : ''}`}
                            </small>
                            {item.components && (
                              <em>
                                {item.components
                                  .map((component) => tx(ITEM_BY_ID.get(component)?.name, lang) || component)
                                  .join(' + ')}
                              </em>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {mode === 'online' && !watch && (
              <div className="moba-emotes">
                <button
                  type="button"
                  className={`moba-emote-btn${emoteWheel ? ' is-open' : ''}`}
                  title={l('emotes')}
                  onClick={(event) => {
                    setEmoteWheel({ x: event.clientX, y: event.clientY });
                  }}
                >
                  😀
                </button>
              </div>
            )}


            {mode === 'online' && (
              <div className="moba-quickchat">
                {QUICK_CHAT.map((message) => (
                  <button
                    key={message.cs}
                    type="button"
                    className="moba-quickchat-btn"
                    onClick={() => {
                      sendChat(tx(message, lang));
                    }}
                  >
                    {tx(message, lang)}
                  </button>
                ))}
              </div>
            )}

            {!watch && (
            <div className="moba-tips">
              {coarse
                ? l('touchHint')
                : l('keysHint')}
            </div>
            )}
          </div>

          <MobaMinimap
            snapshot={stats?.snapshot ?? null}
            youId={stats?.youId ?? null}
            label={l('minimap')}
          />

          {stats?.snapshot.banner && <div className="moba-banner">{stats.snapshot.banner}</div>}

          {stats?.talentPending != null && (
            <div className="moba-talent" role="dialog" aria-label={l('talentLower')}>
              <strong>
                {l('talent')} · {stats.talentPending}
              </strong>
              {[0, 1].map((pick) => {
                const talent = talentsFor(spells[0]?.school ?? 'cosmic')[stats.talentPending!]?.[pick];
                if (!talent) return null;
                return (
                  <button
                    key={pick}
                    type="button"
                    className="moba-talent-btn"
                    onClick={() => {
                      talentRequest.current = { tier: stats.talentPending!, pick };
                    }}
                  >
                    <b>{tx(talent.name, lang)}</b>
                    <small>{tx(talent.note, lang)}</small>
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            className={`moba-scoreboard-toggle${scoreboard ? ' is-open' : ''}`}
            onClick={() => setScoreboard((open) => !open)}
            title={l('scoreboardTab')}
          >
            Σ
          </button>

          {scoreboard && stats && (
            <div className="moba-scoreboard" role="dialog" aria-label={l('scoreboardLower')}>
              <h3>{l('scoreboard')} · {clock}</h3>
              <TeamBoard
                heroes={stats.snapshot.heroes}
                team="blue"
                lang={lang}
                youId={stats.youId}
                minutes={Math.max(0.1, stats.snapshot.time / 60)}
              />
              <TeamBoard
                heroes={stats.snapshot.heroes}
                team="red"
                lang={lang}
                youId={stats.youId}
                minutes={Math.max(0.1, stats.snapshot.time / 60)}
              />
            </div>
          )}

          {!watch && (stats?.respawnIn ?? 0) > 0 && (
            <div className="moba-respawn">
              <span>
                {l('respawnIn')} {stats?.respawnIn}s
              </span>
              {(stats?.buybackCost ?? 0) > 0 && (
                <button
                  type="button"
                  className="moba-buyback"
                  onClick={() => {
                    buybackRequest.current = true;
                  }}
                >
                  {l('buyback')} · {stats?.buybackCost} ◈
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Radiální menu patří mimo `.moba-stage`: HUD má `transform`, takže
          `position: fixed` uvnitř něj je relativní k HUD a menu zmizí. */}
      {emoteWheel && (
        <MobaEmoteWheel
          origin={emoteWheel}
          language={lang}
          onPick={(index) => {
            sendEmote(index);
            setEmoteWheel(null);
          }}
          onClose={() => setEmoteWheel(null)}
        />
      )}

      {phase === 'ended' && (
        <div className="moba-result">
          <strong>{winner === 'blue' ? (l('zionHolds')) : l('oppositionBroke')}</strong>
          <span>
            {l('epilogue')}
          </span>
          {notice && <p className="moba-result-note">{notice}</p>}
          {masteryGain && (
            <p className="moba-mastery-gain">
              ★ <strong>{masteryGain.title}</strong> <span>· level {masteryGain.level}</span>{' '}
              <em>+{masteryGain.xp} XP</em>
            </p>
          )}
          {stats && (
            (() => {
              const score = (hero: MobaStats['snapshot']['heroes'][number]) =>
                hero.damage + hero.kills * 250 + hero.healing * 0.6 + hero.gold * 0.5;
              const mvp = [...stats.snapshot.heroes].sort((a, b) => score(b) - score(a))[0];
              if (!mvp) return null;
              return (
                <div className="moba-mvp">
                  <Portrait heroId={mvp.heroId} name={mvp.name} size="card" />
                  <div>
                    <strong>MVP · {mvp.name}</strong>
                    <span>
                      {mvp.kills}/{mvp.deaths} · {mvp.damage} dmg · {mvp.healing} heal ·{' '}
                      {Math.round(mvp.gold)} ◈
                    </span>
                  </div>
                </div>
              );
            })()
          )}

          {stats && (
            <div className="moba-result-board">
              <TeamBoard
                heroes={stats.snapshot.heroes}
                team="blue"
                lang={lang}
                youId={stats.youId}
                minutes={Math.max(0.1, stats.snapshot.time / 60)}
              />
              <TeamBoard
                heroes={stats.snapshot.heroes}
                team="red"
                lang={lang}
                youId={stats.youId}
                minutes={Math.max(0.1, stats.snapshot.time / 60)}
              />
            </div>
          )}
          <div className="moba-result-actions">
            <div className="moba-difficulty moba-difficulty-start">
              <span>{l('battleSpell')}</span>
              {(['flicker', 'heal', 'purify'] as BattleSpellId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`moba-mode-btn${battleSpell === id ? ' is-active' : ''}`}
                  title={tx(BATTLE_SPELLS[id].note, lang)}
                  onClick={() => setBattleSpell(id)}
                >
                  {tx(BATTLE_SPELLS[id].name, lang)}
                </button>
              ))}
            </div>
            <button type="button" className="moba-start" onClick={start}>
              {l('playAgain')}
            </button>
            <button type="button" className="moba-link" onClick={() => setPhase('pick')}>
              {l('changeHero')}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
