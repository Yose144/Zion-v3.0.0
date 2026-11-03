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
import { useI18n } from '@/core/i18n';
import { MobaGame, type MobaStats } from '@/core/moba/MobaGame';
import { MobaOnline } from '@/core/moba/MobaOnline';
import { MobaMinimap } from '@/core/moba/MobaMinimap';
import { NODE_SITES } from '@/core/moba/map';
import { ITEMS, ITEM_SLOTS, SELL_RATIO, WARD_STOCK_MAX, talentRole, totalXpAt, type BotSkill, type ItemId, type TalentRole } from '@/core/moba/sim';

/** Rychlé hledání itemu podle id — používá inventář i obchod. */
const ITEM_BY_ID = new Map(ITEMS.map((item) => [item.id, item]));
import { SCHOOL_LABEL, spellsForAvatar } from '@/core/moba/spells';
import { SpellIcon } from '@/core/moba/spellIcons';
import { portraitUrl } from '@/core/moba/portraits';
import { talentsFor } from '@/core/moba/sim';
import { SPELL_LABEL } from '@/core/moba/keys';
import { MobaTouch } from '@/core/moba/MobaTouch';

/** Dvanáct startovních hrdinů — zbytek rosteru jde vybrat na `/avatars`. */
const STARTERS = [0, 1, 2, 3, 4, 5, 82, 84, 85, 86, 19, 20];

type Phase = 'pick' | 'playing' | 'ended';
type Mode = 'solo' | 'online';
type OnlinePhase = 'connecting' | 'waiting' | 'countdown' | 'running' | 'ended' | 'offline';

const EMPTY_STATS: MobaStats | null = null;

/** Doporučený build podle archetypu — pro rychlý nákup na mobilu. */
const RECOMMENDED: Record<TalentRole, ItemId[]> = {
  aggressive: ['blade', 'boots', 'blink', 'aegis', 'lotus', 'crown'],
  support: ['aegis', 'barrier', 'boots', 'lotus', 'crown', 'blade'],
  control: ['boots', 'barrier', 'blade', 'lotus', 'crown', 'aegis'],
};

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
  cs,
  youId,
  minutes,
}: {
  heroes: MobaStats['snapshot']['heroes'];
  team: 'blue' | 'red';
  cs: boolean;
  youId: string | null;
  minutes: number;
}) {
  const list = heroes
    .filter((hero) => hero.team === team)
    .sort((a, b) => b.kills - a.kills || b.gold - a.gold);
  const gpm = (hero: (typeof list)[number]) => Math.round(hero.gold / Math.max(0.1, minutes));
  const xpm = (hero: (typeof list)[number]) => Math.round(totalXpAt(hero.level, hero.xp) / Math.max(0.1, minutes));

  return (
    <div className={`moba-board is-${team}`}>
      <strong>{team === 'blue' ? 'ZION' : cs ? 'OPOZICE' : 'OPPOSITION'}</strong>
      <table>
        <thead>
          <tr>
            <th>{cs ? 'Hrdina' : 'Hero'}</th>
            <th>Lv</th>
            <th>K/D</th>
            <th>{cs ? 'Zlato' : 'Gold'}</th>
            <th>GPM</th>
            <th>XPM</th>
            <th>{cs ? 'Dmg' : 'Dmg'}</th>
            <th>{cs ? 'Léčení' : 'Heal'}</th>
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
  const cs = lang === 'cs';
  const [heroId, setHeroId] = useState(0);
  const [foeId, setFoeId] = useState(82);
  const [phase, setPhase] = useState<Phase>('pick');
  const [mode, setMode] = useState<Mode>('solo');
  const [botSkill, setBotSkill] = useState<BotSkill>('normal');
  const [scoreboard, setScoreboard] = useState(false);
  const [onlinePhase, setOnlinePhase] = useState<OnlinePhase>('connecting');
  const [stats, setStats] = useState<MobaStats | null>(EMPTY_STATS);
  const buyRequest = useRef<ItemId | null>(null);
  const sellRequest = useRef<ItemId | null>(null);
  const buybackRequest = useRef(false);
  const talentRequest = useRef<{ tier: number; pick: number } | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [winner, setWinner] = useState<'blue' | 'red' | null>(null);

  /** Dotykové ovládání — na mobilu joystick + kouzla místo WASD a QWER. */
  const [coarse, setCoarse] = useState(false);

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

  // během hry na mobilu schovej navigaci a chat (celá obrazovka pro hru)
  useEffect(() => {
    if (!coarse) return;
    document.body.dataset.playing = phase === 'playing' ? '1' : '';
    return () => {
      document.body.dataset.playing = '';
    };
  }, [coarse, phase]);

  const hero = useMemo(() => AVATARS.find((entry) => entry.id === heroId) ?? AVATARS[0]!, [heroId]);
  const foe = useMemo(() => AVATARS.find((entry) => entry.id === foeId) ?? AVATARS[0]!, [foeId]);
  const spells = useMemo(() => spellsForAvatar(heroId), [heroId]);

  const start = useCallback(() => {
    setStats(null);
    setWinner(null);
    setOnlinePhase(mode === 'online' ? 'connecting' : 'running');
    setPhase('playing');
  }, [mode]);

  const onStats = useCallback((next: MobaStats) => setStats(next), []);
  const onEnd = useCallback((result: 'blue' | 'red') => {
    setWinner(result);
    setPhase('ended');
  }, []);

  const nexusBlue = stats?.snapshot.towers.find((tower) => tower.id === 'blue-nexus');
  const nexusRed = stats?.snapshot.towers.find((tower) => tower.id === 'red-nexus');
  const clock = stats ? `${Math.floor(stats.snapshot.time / 60)}:${String(Math.floor(stats.snapshot.time % 60)).padStart(2, '0')}` : '0:00';

  return (
    <main className={`moba ${phase === 'playing' ? 'is-live' : ''}`}>
      <header className="moba-head">
        <div>
          <p className="moba-kicker">{cs ? 'L4 · první svět · MOBA' : 'L4 · first world · MOBA'}</p>
          <h1>PRVNÍ SVĚT</h1>
          <p className="moba-sub">
            {cs
              ? 'Tři linky mezi ZIONem a Opozicí. Každá postava má čtyři kouzla ze svého kánonu.'
              : 'Three lanes between ZION and the Opposition. Every character brings four spells from its canon.'}
          </p>
        </div>
        <div className="moba-head-links">
          {phase !== 'playing' && (
            <Link href="/avatars" className="moba-link">
              {cs ? 'Celý roster' : 'Full roster'} ↗
            </Link>
          )}
          {phase === 'playing' && (
            <button type="button" className="moba-link" onClick={() => setPhase('pick')}>
              {cs ? 'Menu' : 'Menu'}
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
                {cs ? 'Sólo vs bot' : 'Solo vs bot'}
              </button>
              <button
                type="button"
                className={`moba-mode-btn${mode === 'online' ? ' is-active' : ''}`}
                onClick={() => setMode('online')}
              >
                {cs ? 'Online 2v2' : 'Online 2v2'}
              </button>
            </div>
            <h2>{cs ? 'Vyber si hrdinu' : 'Pick your hero'}</h2>
            <div className="moba-pick-grid">
              {STARTERS.map((id) => {
                const entry = AVATARS.find((candidate) => candidate.id === id);
                if (!entry) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`moba-pick-card${id === heroId ? ' is-active' : ''}`}
                    onClick={() => {
                      setHeroId(id);
                      setFoeId(id === 82 ? 85 : 82);
                    }}
                  >
                    <Portrait heroId={id} name={entry.name} size="card" />
                    <strong>{entry.name}</strong>
                    <span>{entry.subtitle}</span>
                    <em>CL {entry.cl}</em>
                  </button>
                );
              })}
            </div>
            {mode === 'solo' && (
              <div className="moba-difficulty">
                <span>{cs ? 'Obtížnost bota' : 'Bot difficulty'}</span>
                {(['easy', 'normal', 'hard'] as BotSkill[]).map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    className={`moba-mode-btn${botSkill === skill ? ' is-active' : ''}`}
                    onClick={() => setBotSkill(skill)}
                  >
                    {skill === 'easy' ? (cs ? 'Lehký' : 'Easy') : skill === 'hard' ? (cs ? 'Těžký' : 'Hard') : cs ? 'Normální' : 'Normal'}
                  </button>
                ))}
              </div>
            )}
            <p className="moba-pick-note">
              {cs
                ? `${hero.name} proti ${foe.name} · ${spells.map((spell) => spell.name).join(' · ')}`
                : `${hero.name} versus ${foe.name} · ${spells.map((spell) => spell.name).join(' · ')}`}
            </p>
          </div>

          <div className="moba-pick-block">
            <h2>{cs ? 'Jak se hraje' : 'How to play'}</h2>
            <ul className="moba-rules">
              <li>
                {coarse
                  ? cs
                    ? 'Joystick pohyb, ÚTOK útok, Q/F/E/R kouzla. Klepni do země a pak na kouzlo — sešle se tam.'
                    : 'Stick to move, ATTACK to strike, Q/F/E/R spells. Tap the ground, then a spell — it casts there.'
                  : cs
                    ? 'WASD pohyb, držené levé tlačítko útok.'
                    : 'WASD to move, hold left mouse to attack.'}
              </li>
              <li>{cs ? 'Q/W/E/R kouzlo na kurzor. Mana a cooldowny platí.' : 'Q/W/E/R casts at the cursor. Mana and cooldowns apply.'}</li>
              <li>{cs ? 'Chraň svůj Nex a znič protivníkův — nebo vyhraj na čas.' : 'Protect your Nexus, destroy theirs — or win on time.'}</li>
              <li>
                {cs
                  ? 'Uzly L5 (Kailash, Uluru, Ekam) převezmi stáním — každý držený uzel přidává 5 % poškození.'
                  : 'Capture L5 nodes (Kailash, Uluru, Ekam) by standing — each held node adds 5% damage.'}
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
                    {cs ? SCHOOL_LABEL[spell.school].cs : SCHOOL_LABEL[spell.school].en}
                  </small>
                </div>
              ))}
            </div>
            <button type="button" className="moba-start" onClick={start}>
              {phase === 'ended' ? (cs ? 'Hrát znovu' : 'Play again') : cs ? 'Vstoupit na Zemi' : 'Enter Earth'}
            </button>
          </div>
        </section>
      )}

      {phase === 'playing' && (
        <div className="moba-stage">
          {mode === 'solo' ? (
            <MobaGame
              playerHeroId={heroId}
              enemyHeroId={foeId}
              botSkill={botSkill}
              running
              onStats={onStats}
              onEnd={onEnd}
              buyRequest={buyRequest}
              sellRequest={sellRequest}
              buybackRequest={buybackRequest}
              talentRequest={talentRequest}
              autoAim={coarse}
              debug={typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mobaDebug') === '1'}
            />
          ) : (
            <MobaOnline
              heroId={heroId}
              onStats={onStats}
              onEnd={onEnd}
              onPhase={setOnlinePhase}
              buyRequest={buyRequest}
              sellRequest={sellRequest}
              buybackRequest={buybackRequest}
              talentRequest={talentRequest}
              autoAim={coarse}
              debug={typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mobaDebug') === '1'}
            />
          )}

          {coarse && <MobaTouch spells={spells} />}

          {mode === 'online' && (onlinePhase === 'connecting' || onlinePhase === 'waiting' || onlinePhase === 'countdown' || onlinePhase === 'offline') && (
            <div className="moba-status" role="status" aria-live="polite">
              <strong>
                {onlinePhase === 'offline'
                  ? cs
                    ? 'Server neodpovídá'
                    : 'Server offline'
                  : onlinePhase === 'countdown'
                    ? cs
                      ? 'Zápas začíná'
                      : 'Match starting'
                    : onlinePhase === 'waiting'
                      ? cs
                        ? 'Čekám na hráče'
                        : 'Waiting for players'
                      : cs
                        ? 'Připojuji se'
                        : 'Connecting'}
              </strong>
              <span>
                {onlinePhase === 'offline'
                  ? cs
                    ? 'Zkus to znovu za chvíli.'
                    : 'Try again in a moment.'
                  : cs
                    ? 'Volná sedla doplní boti, hra nečeká.'
                    : 'Empty seats are filled by bots, the game does not wait.'}
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
            <div className="moba-clock">
              <strong>{clock}</strong>
              <small>
                {cs ? 'vlna' : 'wave'} {stats?.snapshot.wave ?? 0} · {stats?.snapshot.nextWaveIn ?? 0}s
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
            {stats?.invisible && (
              <div className="moba-invisible" role="status">
                {cs ? 'NEVIDITELNÝ' : 'INVISIBLE'}
              </div>
            )}
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
              <div className="moba-bar is-xp" title={cs ? 'zkušenosti' : 'experience'}>
                <i style={{ width: `${((stats?.xp ?? 0) / (stats?.xpNeed ?? 1)) * 100}%` }} />
                <span>
                  XP {stats?.xp ?? 0} / {stats?.xpNeed ?? 1}
                </span>
              </div>
              <div className="moba-score">
                <Portrait heroId={stats?.playerHeroId ?? heroId} name={hero.name} />
                <strong>{hero.name}</strong>
                <span>
                  Lv {stats?.playerLevel ?? 1} · {stats?.kills ?? 0}/{stats?.deaths ?? 0}
                </span>
              </div>
            </div>

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
                          {spell.rank ? `T${spell.rank} · ${spell.mana} mp` : cs ? 'zamčeno do lv 6' : 'locked until lv 6'}
                        </small>
                      </div>
                    </div>
                    {cooldownPct > 0 && <i className="moba-slot-cd" style={{ height: `${cooldownPct}%` }} />}
                  </div>
                );
              })}
            </div>

            <div className="moba-shop" aria-label={cs ? 'Obchod' : 'Shop'}>
              <span className="moba-shop-gold" title={cs ? 'zlato' : 'gold'}>
                ◈ {stats?.gold ?? 0}
              </span>
              <span className="moba-ward-count" title={cs ? 'wardy (G položí)' : 'wards (G places)'}>
                🛡 {stats?.wards ?? 0}
              </span>
              <span className="moba-sentry-count" title={cs ? 'sentry (H položí) — odhalí neviditelné' : 'sentry (H places) — reveals invisible'}>
                🕯 {stats?.sentries ?? 0}
              </span>
              <button
                type="button"
                className={`moba-battlespell${(stats?.battleSpellIn ?? 0) > 0 ? ' is-cooling' : ''}`}
                title={cs ? 'Flicker (V) — krátký skok, 60 s' : 'Flicker (V) — short blink, 60 s'}
                disabled={(stats?.battleSpellIn ?? 0) > 0}
                onClick={() => {
                  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', bubbles: true }));
                }}
              >
                ⚡
                {(stats?.battleSpellIn ?? 0) > 0 && (
                  <small>{Math.ceil((stats?.battleSpellIn ?? 0) / 1000)}</small>
                )}
              </button>
              <div className="moba-inventory" title={cs ? 'inventář: 1–6 použije aktivní item, klik prodá' : 'inventory: 1–6 uses an active item, click sells'}>
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
                          ? `${item.name[cs ? 'cs' : 'en']} — ${item.note[cs ? 'cs' : 'en']}${item.active ? ` · ${cs ? 'klávesa' : 'key'} ${index + 1}` : ` · ${cs ? 'prodej' : 'sell'} +${Math.round(item.cost * SELL_RATIO)} ◈`}`
                          : cs
                            ? 'prázdný slot'
                            : 'empty slot'
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
                      {item ? item.name[cs ? 'cs' : 'en'] : '·'}
                      {item && <em className="moba-inv-key">{index + 1}</em>}
                      {cooldownPct > 0 && <i className="moba-inv-cd" style={{ height: `${cooldownPct}%` }} />}
                      {item?.active && (
                        <span
                          role="button"
                          tabIndex={-1}
                          className="moba-inv-sell"
                          title={cs ? 'prodat' : 'sell'}
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
                title={cs ? 'obchod' : 'shop'}
              >
                {shopOpen ? '×' : cs ? 'Obchod' : 'Shop'}
              </button>
            </div>

            {shopOpen && (
              <div className="moba-shop-panel">
                {(() => {
                  const items = stats?.items ?? [];
                  const role = talentRole(spells[0]?.school ?? 'cosmic');
                  const next = RECOMMENDED[role].find((id) => !items.includes(id));
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
                      <strong>{cs ? 'Doporučeno' : 'Recommended'}</strong>
                      <button
                        type="button"
                        className="moba-quickbuy-btn"
                        disabled={!affordable}
                        onClick={() => {
                          buyRequest.current = next;
                        }}
                      >
                        <span>{item.name[cs ? 'cs' : 'en']}</span>
                        <small>{price} ◈</small>
                      </button>
                    </div>
                  );
                })()}

                {(['base', 'built'] as const).map((group) => (
                  <div key={group} className="moba-shop-group">
                    <strong>{group === 'base' ? (cs ? 'Základ' : 'Base') : cs ? 'Složené' : 'Built'}</strong>
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
                            title={item.note[cs ? 'cs' : 'en']}
                            onClick={() => {
                              buyRequest.current = item.id;
                            }}
                          >
                            <strong>{item.name[cs ? 'cs' : 'en']}</strong>
                            <small>
                              {owned
                                ? cs
                                  ? 'koupeno'
                                  : 'owned'
                                : maxed
                                  ? cs
                                    ? 'plná zásoba'
                                    : 'full stock'
                                  : full
                                    ? cs
                                      ? 'plný inventář'
                                      : 'inventory full'
                                    : `${price} ◈${consumable ? ` · ${stock}/${WARD_STOCK_MAX}` : ''}`}
                            </small>
                            {item.components && (
                              <em>
                                {item.components
                                  .map((component) => ITEM_BY_ID.get(component)?.name[cs ? 'cs' : 'en'] ?? component)
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

            <div className="moba-tips">
              {coarse
                ? cs
                  ? 'joystick pohyb · Q/F/E/R kouzlo · ÚTOK'
                  : 'stick move · Q/F/E/R cast · ATTACK'
                : cs
                  ? 'WASD pohyb · Q/F/E/R kouzlo · 1–6 aktivní item · G ward · H sentry · Tab scoreboard · levé tlačítko útok'
                  : 'WASD move · Q/F/E/R cast · left click attack'}
            </div>
          </div>

          <MobaMinimap
            snapshot={stats?.snapshot ?? null}
            youId={stats?.youId ?? null}
            label={cs ? 'Minimapa Prvního světa' : 'First World minimap'}
          />

          {stats?.snapshot.banner && <div className="moba-banner">{stats.snapshot.banner}</div>}

          {stats?.talentPending != null && (
            <div className="moba-talent" role="dialog" aria-label={cs ? 'talent' : 'talent'}>
              <strong>
                {cs ? 'Talent' : 'Talent'} · {stats.talentPending}
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
                    <b>{talent.name[cs ? 'cs' : 'en']}</b>
                    <small>{talent.note[cs ? 'cs' : 'en']}</small>
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            className={`moba-scoreboard-toggle${scoreboard ? ' is-open' : ''}`}
            onClick={() => setScoreboard((open) => !open)}
            title={cs ? 'scoreboard (Tab)' : 'scoreboard (Tab)'}
          >
            Σ
          </button>

          {scoreboard && stats && (
            <div className="moba-scoreboard" role="dialog" aria-label={cs ? 'scoreboard' : 'scoreboard'}>
              <h3>{cs ? 'Scoreboard' : 'Scoreboard'} · {clock}</h3>
              <TeamBoard
                heroes={stats.snapshot.heroes}
                team="blue"
                cs={cs}
                youId={stats.youId}
                minutes={Math.max(0.1, stats.snapshot.time / 60)}
              />
              <TeamBoard
                heroes={stats.snapshot.heroes}
                team="red"
                cs={cs}
                youId={stats.youId}
                minutes={Math.max(0.1, stats.snapshot.time / 60)}
              />
            </div>
          )}

          {(stats?.respawnIn ?? 0) > 0 && (
            <div className="moba-respawn">
              <span>
                {cs ? 'obnova za' : 'respawn in'} {stats?.respawnIn}s
              </span>
              {(stats?.buybackCost ?? 0) > 0 && (
                <button
                  type="button"
                  className="moba-buyback"
                  onClick={() => {
                    buybackRequest.current = true;
                  }}
                >
                  {cs ? 'Buyback' : 'Buyback'} · {stats?.buybackCost} ◈
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {phase === 'ended' && (
        <div className="moba-result">
          <strong>{winner === 'blue' ? (cs ? 'ZION DRŽÍ ZEMI' : 'ZION HOLDS EARTH') : cs ? 'OPOZICE PROLOMILA LINII' : 'THE OPPOSITION BROKE THROUGH'}</strong>
          <span>
            {cs ? 'Kdo ovládne první svět, určí směr celého OASIS.' : 'Whoever holds the first world sets the course of OASIS.'}
          </span>
          {stats && (
            <div className="moba-result-board">
              <TeamBoard
                heroes={stats.snapshot.heroes}
                team="blue"
                cs={cs}
                youId={stats.youId}
                minutes={Math.max(0.1, stats.snapshot.time / 60)}
              />
              <TeamBoard
                heroes={stats.snapshot.heroes}
                team="red"
                cs={cs}
                youId={stats.youId}
                minutes={Math.max(0.1, stats.snapshot.time / 60)}
              />
            </div>
          )}
          <div className="moba-result-actions">
            <button type="button" className="moba-start" onClick={start}>
              {cs ? 'Hrát znovu' : 'Play again'}
            </button>
            <button type="button" className="moba-link" onClick={() => setPhase('pick')}>
              {cs ? 'Změnit hrdinu' : 'Change hero'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
