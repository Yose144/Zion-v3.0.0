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
import { ITEMS, type ItemId } from '@/core/moba/sim';
import { spellsForAvatar } from '@/core/moba/spells';
import { SPELL_LABEL } from '@/core/moba/keys';
import { MobaTouch } from '@/core/moba/MobaTouch';

/** Dvanáct startovních hrdinů — zbytek rosteru jde vybrat na `/avatars`. */
const STARTERS = [0, 1, 2, 3, 4, 5, 82, 84, 85, 86, 19, 20];

type Phase = 'pick' | 'playing' | 'ended';
type Mode = 'solo' | 'online';
type OnlinePhase = 'connecting' | 'waiting' | 'countdown' | 'running' | 'ended' | 'offline';

const EMPTY_STATS: MobaStats | null = null;

export default function EarthPage() {
  const { lang } = useI18n();
  const cs = lang === 'cs';
  const [heroId, setHeroId] = useState(0);
  const [foeId, setFoeId] = useState(82);
  const [phase, setPhase] = useState<Phase>('pick');
  const [mode, setMode] = useState<Mode>('solo');
  const [onlinePhase, setOnlinePhase] = useState<OnlinePhase>('connecting');
  const [stats, setStats] = useState<MobaStats | null>(EMPTY_STATS);
  const buyRequest = useRef<ItemId | null>(null);
  const [winner, setWinner] = useState<'blue' | 'red' | null>(null);

  /** Dotykové ovládání — na mobilu joystick + kouzla místo WASD a QWER. */
  const [coarse, setCoarse] = useState(false);

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
                    <strong>{entry.name}</strong>
                    <span>{entry.subtitle}</span>
                    <em>CL {entry.cl}</em>
                  </button>
                );
              })}
            </div>
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
                  <strong>{spell.name}</strong>
                  <small>
                    {spell.damage > 0 ? `${spell.damage} dmg` : spell.shield > 0 ? `${spell.shield} štít` : 'podpora'} ·{' '}
                    {Math.round(spell.cooldownMs / 100) / 10}s
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
              running
              onStats={onStats}
              onEnd={onEnd}
              buyRequest={buyRequest}
              debug={typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mobaDebug') === '1'}
            />
          ) : (
            <MobaOnline
              heroId={heroId}
              onStats={onStats}
              onEnd={onEnd}
              onPhase={setOnlinePhase}
              buyRequest={buyRequest}
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
              <div className="moba-score">
                <strong>{hero.name}</strong>
                <span>
                  Lv {stats?.playerLevel ?? 1} · {stats?.kills ?? 0}/{stats?.deaths ?? 0}
                </span>
              </div>
            </div>

            <div className="moba-spellbar">
              {(stats?.spells ?? spells.map((spell) => ({ ...spell, cooldown: 0 }))).map((spell) => {
                const cooldownPct = spell.cooldownMs ? Math.min(100, (spell.cooldown / spell.cooldownMs) * 100) : 0;
                return (
                  <div key={spell.slot} className="moba-slot" style={{ borderColor: `${spell.color}88` }}>
                    <span className="moba-slot-key">{SPELL_LABEL[spell.slot]}</span>
                    <strong>{spell.name}</strong>
                    <small>{spell.mana} mp</small>
                    {cooldownPct > 0 && <i className="moba-slot-cd" style={{ height: `${cooldownPct}%` }} />}
                  </div>
                );
              })}
            </div>

            <div className="moba-shop" aria-label={cs ? 'Obchod' : 'Shop'}>
              <span className="moba-shop-gold" title={cs ? 'zlato' : 'gold'}>
                ◈ {stats?.gold ?? 0}
              </span>
              {ITEMS.map((item) => {
                const owned = (stats?.items ?? []).includes(item.id);
                const affordable = (stats?.gold ?? 0) >= item.cost;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`moba-shop-item${owned ? ' is-owned' : ''}`}
                    disabled={owned || !affordable}
                    title={item.note[cs ? 'cs' : 'en']}
                    onClick={() => {
                      buyRequest.current = item.id;
                    }}
                  >
                    <strong>{item.name[cs ? 'cs' : 'en']}</strong>
                    <small>{owned ? (cs ? 'koupeno' : 'owned') : `${item.cost} ◈`}</small>
                  </button>
                );
              })}
            </div>

            <div className="moba-tips">
              {coarse
                ? cs
                  ? 'joystick pohyb · Q/F/E/R kouzlo · ÚTOK'
                  : 'stick move · Q/F/E/R cast · ATTACK'
                : cs
                  ? 'WASD pohyb · Q/F/E/R kouzlo · levé tlačítko útok'
                  : 'WASD move · Q/F/E/R cast · left click attack'}
            </div>
          </div>

          <MobaMinimap
            snapshot={stats?.snapshot ?? null}
            youId={stats?.youId ?? null}
            label={cs ? 'Minimapa Prvního světa' : 'First World minimap'}
          />

          {stats?.snapshot.banner && <div className="moba-banner">{stats.snapshot.banner}</div>}

          {(stats?.respawnIn ?? 0) > 0 && (
            <div className="moba-respawn">
              {cs ? 'obnova za' : 'respawn in'} {stats?.respawnIn}s
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
