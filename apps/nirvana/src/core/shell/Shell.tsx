'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/core/session/AuthProvider';
import { GAME_LINKS } from '@/core/games/links';
import { useI18n } from '@/core/i18n';
import { PORTALS, type SceneSlot } from '@/core/portals/manifest';
import { backendForXr, resolveGpuBackend, type GpuBackend } from '@/core/scene/backends';
import { SceneRoot } from '@/core/scene/SceneRoot';
import { AccountPortal } from '@/portals/account/AccountPortal';
import { ArchaPortal } from '@/portals/archa/ArchaPortal';
import { BooksPortal } from '@/portals/books/BooksPortal';
import { ChainPortal } from '@/portals/chain/ChainPortal';
import { ComputePortal } from '@/portals/compute/ComputePortal';
import { HarborPortal } from '@/portals/freeworld/HarborPortal';
import { GatePortal } from '@/portals/gate/GatePortal';
import { FleetPortal } from '@/portals/fleet/FleetPortal';
import { MatrixPortal } from '@/portals/matrix/MatrixPortal';
import type { FleetLeg } from '@/core/scene/universe/SkyFleet';
import { HiranPortal } from '@/portals/hiran/HiranPortal';
import { ParkPortal } from '@/portals/park/ParkPortal';
import { IssobellaPortal } from '@/portals/issobella/IssobellaPortal';
import { MarketPortal } from '@/portals/market/MarketPortal';
import { PoolPortal } from '@/portals/pool/PoolPortal';
import { WorldPortal } from '@/portals/world/WorldPortal';
import { parseWorlds, type WorldPoint } from '@/lib/worlds';
import { normalizeHiranState, hiranReviewOverride, type HiranState } from '@/core/hiran/presence';
import { getGlobalLinkEngine } from '@/core/scene/universe/LinkEngine';

const PANELS = new Set(PORTALS.map((p) => p.id));

const SLOT_COLOR: Record<SceneSlot, string> = {
  core: '#7ec8ff',
  surface: '#066928',
  ring: '#f5f5f5',
  orbit: '#c084fc',
  gate: '#fcd116',
  ship: '#e41e2b',
  sun: '#ffd166',
  park: '#ffb46a',
  sea: '#1d8fb3',
  fleet: '#38bdf8',
  moon: '#c9c2b6',
};

/** Rozdělení portálů v konzoli — hry jsou zvlášť (jsou to routy, ne portály). */
const WORLDS = ['world', 'hiran', 'archa', 'fleet'];
const SYSTEM = ['chain', 'pool', 'market', 'books', 'harbor', 'account'];

function readHash(): { portal: string | null; world: string | null } {
  if (typeof window === 'undefined') return { portal: null, world: null };
  const hash = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(hash);
  const portal = params.get('portal');
  const world = params.get('world');
  return {
    portal: portal && PANELS.has(portal) ? portal : null,
    world,
  };
}

/** Panel po kliknutí na planetu — titulek, note, CTA. Klíč = hodnota `def.game`. */
const PLANET_PANELS: Record<'mars' | 'venus' | 'mercury' | 'park', {
  title: string;
  note: string;
  href: string;
  cta: string;
  portal?: string;
}> = {
  mars: {
    title: 'MARS',
    note: 'Aréna z krabic — rail, rakety, tři boti. Sólo i online proti lidem.',
    href: '/mars',
    cta: 'Hrát arénu',
  },
  venus: {
    title: 'VENUŠE',
    note: 'Okruh na hovercraftu, tři kola, tři soupeři. Sólo i online.',
    href: '/venus',
    cta: 'Na start',
  },
  mercury: {
    title: 'MERKUR',
    note: 'Klec na Merkuru — pěst, kop, blok. Best of 3. Cvičení proti stínu i online duel.',
    href: '/mercury',
    cta: 'Do klece',
  },
  park: {
    title: 'JUPITER',
    note: 'Jupiter Station — pouť, arkády, ruské kolo a tabule skóre.',
    href: '/park',
    cta: 'Na pouť',
    portal: 'park',
  },
};

export function Shell() {
  const { t, lang, setLang } = useI18n();
  const { user, loading } = useAuth();
  const [backend, setBackend] = useState<GpuBackend | null>(null);
  const [worlds, setWorlds] = useState<WorldPoint[]>([]);
  const [worldsFailed, setWorldsFailed] = useState(false);
  const [portal, setPortal] = useState<string | null>(null);
  const [selectedWorld, setSelectedWorld] = useState<string | null>(null);
  const [hiranState, setHiranState] = useState<HiranState>(() => hiranReviewOverride() ?? 'idle');
  const [reviewState] = useState<HiranState | null>(() => hiranReviewOverride());
  const [focus, setFocus] = useState<
    'earth' | 'sun' | 'jupiter' | 'mars' | 'venus' | 'mercury' | 'fleet' | 'moon'
  >('earth');
  /** Vybraná planeta = přiletěli jsme a nabízíme vstup do hry. ('jupiter' def používá key 'park'.) */
  const [planet, setPlanet] = useState<'mars' | 'venus' | 'mercury' | 'park' | null>(null);
  const [fleetLeg, setFleetLeg] = useState<FleetLeg | null>(null);
  const [xrWanted, setXrWanted] = useState(false);
  const [xrSupported, setXrSupported] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const hashInit = useRef(false);

  const openPortal = useCallback((id: string) => {
    const next = PANELS.has(id) ? id : null;
    setPortal(next);
    // Kanonizovat přes LinkEngine
    const linkEngine = getGlobalLinkEngine();
    if (next === 'hiran') {
      setFocus('sun');
      linkEngine.flyTo('sun', { camera: null as any, controls: null, clock: { elapsedTime: 0 }, earthPos: new (require('three').Vector3)(30, 0, 0), reducedMotion: false, lang });
    } else if (next === 'park') {
      setFocus('jupiter');
      linkEngine.flyTo('jupiter', { camera: null as any, controls: null, clock: { elapsedTime: 0 }, earthPos: new (require('three').Vector3)(30, 0, 0), reducedMotion: false, lang });
    } else if (next === 'fleet') {
      setFocus('fleet');
      linkEngine.flyTo('fleet', { camera: null as any, controls: null, clock: { elapsedTime: 0 }, earthPos: new (require('three').Vector3)(30, 0, 0), reducedMotion: false, lang });
    } else if (next === 'matrix') {
      setFocus('moon');
      linkEngine.flyTo('moon', { camera: null as any, controls: null, clock: { elapsedTime: 0 }, earthPos: new (require('three').Vector3)(30, 0, 0), reducedMotion: false, lang });
    } else if (next === 'archa') {
      setFocus('earth');
      linkEngine.flyTo('archa', { camera: null as any, controls: null, clock: { elapsedTime: 0 }, earthPos: new (require('three').Vector3)(30, 0, 0), reducedMotion: false, lang });
    } else if (next === 'issobella') {
      setFocus('earth');
      linkEngine.flyTo('issobella', { camera: null as any, controls: null, clock: { elapsedTime: 0 }, earthPos: new (require('three').Vector3)(30, 0, 0), reducedMotion: false, lang });
    } else {
      setFocus('earth');
      linkEngine.flyTo('earth', { camera: null as any, controls: null, clock: { elapsedTime: 0 }, earthPos: new (require('three').Vector3)(30, 0, 0), reducedMotion: false, lang });
    }
    setMenuOpen(false);
  }, [lang]);

  const closePortal = useCallback(() => {
    setPortal(null);
    setFocus('earth');
  }, []);

  const selectWorld = useCallback((id: string) => {
    setSelectedWorld(id);
    setPortal('world');
    setFocus('earth');
    setMenuOpen(false);
  }, []);

  // deep-link: #portal=<id>&world=<id>
  useEffect(() => {
    if (hashInit.current) return;
    hashInit.current = true;
    const { portal: p, world } = readHash();
    if (p) {
      setPortal(p);
      setFocus(p === 'hiran' ? 'sun' : p === 'park' ? 'jupiter' : p === 'fleet' ? 'fleet' : p === 'matrix' ? 'moon' : 'earth');
    }
    if (world) setSelectedWorld(world);
    const onHash = () => {
      const next = readHash();
      setPortal(next.portal);
      setFocus(next.portal === 'hiran' ? 'sun' : next.portal === 'park' ? 'jupiter' : next.portal === 'fleet' ? 'fleet' : next.portal === 'matrix' ? 'moon' : 'earth');
      if (next.world) setSelectedWorld(next.world);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (portal) params.set('portal', portal);
    if (selectedWorld) params.set('world', selectedWorld);
    const hash = params.toString();
    if (window.location.hash.replace(/^#/, '') !== hash) {
      history.replaceState(null, '', hash ? `#${hash}` : window.location.pathname);
    }
  }, [portal, selectedWorld]);

  useEffect(() => {
    let live = true;
    resolveGpuBackend().then((next) => {
      if (live) setBackend(next);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const xr = (navigator as Navigator & { xr?: { isSessionSupported?: (m: string) => Promise<boolean> } }).xr;
    if (!xr?.isSessionSupported) return;
    xr.isSessionSupported('immersive-vr').then(setXrSupported).catch(() => setXrSupported(false));
  }, []);

  // Katalog světů se načítá nezávisle — plátno se mountuje hned,
  // světy dosvítí jakmile dorazí (žádné „připravuji plátno" blokování).
  useEffect(() => {
    let live = true;
    fetch('/api/oasis/worlds', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<unknown>;
      })
      .then((body) => {
        if (!live) return;
        setWorlds(parseWorlds(body));
      })
      .catch(() => {
        if (live) setWorldsFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  // Hiran svítí i když je jeho okno zavřené — proto se stav zjišťuje jednou
  // při mountu. Offline není chyba, je to stav: Slunce dýchá dál, jen tišeji.
  // Revizní override pro art review: `?hiran=idle|thinking|offline|error`.
  useEffect(() => {
    // Revizní override `?hiran=` drží stav; jinak se zjistí jednou při mountu.
    if (reviewState) return;
    let live = true;
    fetch('/api/hiran', { cache: 'no-store' })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { available?: boolean };
        if (!live) return;
        setHiranState(res.ok && body.available === true ? 'idle' : 'offline');
      })
      .catch(() => {
        if (live) setHiranState('offline');
      });
    return () => {
      live = false;
    };
  }, [reviewState]);

  function enterVr() {
    backendForXr();
    setBackend('webgl2');
    setXrWanted(true);
    setMenuOpen(false);
  }

  /** Klik na planetu: přiletět a otevřít panel s CTA (ne rovnou skočit do hry). */
  const selectPlanet = useCallback((id: 'mars' | 'venus' | 'jupiter' | 'mercury') => {
    setPlanet(id === 'jupiter' ? 'park' : id);
    setFocus(id);
    setPortal(null);
    setMenuOpen(false);
  }, []);

  const backToEarth = useCallback(() => {
    setPlanet(null);
    setFocus('earth');
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'cs' ? 'en' : 'cs');
  }, [lang, setLang]);

  const address = user?.primaryAddress ?? '';
  const short = address.length > 16 ? `${address.slice(0, 10)}…${address.slice(-4)}` : address;

  return (
    <main className="shell">
      <div className="stage">
        <SceneRoot
          key={xrWanted ? 'xr' : (backend ?? 'boot')}
          worlds={worlds}
          portals={PORTALS}
          onOpen={openPortal}
          onSelectWorld={selectWorld}
          onSelectPlanet={selectPlanet}
          xr={xrWanted}
          label={t('gate')}
          focus={focus}
          hiranState={hiranState}
          fleetLeg={fleetLeg}
        />
      </div>
      {/* Přechod scéna ↔ portál: krátký závoj, který při každé změně portálu
          (otevření, zavření, přepnutí) jednou proběhne. `key` ho remountuje,
          takže animace startuje znovu; pointer-events: none, aby nic neblokoval. */}
      <div key={portal ?? 'home'} className="portal-veil" aria-hidden />
      <header className="chrome">
        <div>
          <strong>{t('title')}</strong>
          <span className="muted subtitle"> · {t('subtitle')}</span>
          {backend && <span className="badge">{backend}</span>}
        </div>
        <div className="chrome-actions">
          <span className="muted">
            {worlds.length} {t('worlds')}
          </span>
          <span className="muted">{loading ? '…' : user ? short : t('signedOut')}</span>
        </div>
      </header>
      {/* hamburger — navigace vysunutá z levého okraje */}
      <button
        type="button"
        className="holo-menu-btn"
        aria-label="navigace"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
      >
        ☰
      </button>
      {menuOpen && (
        <button
          type="button"
          className="holo-drawer-scrim"
          aria-label="zavřít navigaci"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <nav className={`holo-drawer${menuOpen ? ' open' : ''}`} aria-hidden={!menuOpen}>
        <header className="holo-drawer-head">
          <span className="holo-title">◈ KINGDOM CONSOLE</span>
          <button type="button" className="holo-btn" onClick={() => setMenuOpen(false)}>
            ×
          </button>
        </header>
        <div className="holo-drawer-tiles">
          <p className="holo-section">◈ {lang === 'cs' ? 'Hry' : 'Games'}</p>
          {GAME_LINKS.map((game) => (
            <Link
              key={game.id}
              href={game.href}
              className="holo-drawer-tile is-game"
              style={{ borderLeftColor: game.tone }}
            >
              <span className="holo-drawer-dot" style={{ background: game.tone }} />
              <span className="holo-drawer-name">{game.title[lang]}</span>
              <em className="holo-drawer-tag holo-drawer-tag-play">
                {lang === 'cs' ? 'hrát' : 'play'} →
              </em>
            </Link>
          ))}

          <p className="holo-section">◈ {lang === 'cs' ? 'Světy' : 'Worlds'}</p>
          {PORTALS.filter((p) => WORLDS.includes(p.id)).map((p) => (
            <button
              key={p.id}
              type="button"
              className="holo-drawer-tile"
              style={{ borderLeftColor: SLOT_COLOR[p.scene.slot] }}
              onClick={() => openPortal(p.id)}
            >
              <span className="holo-drawer-dot" style={{ background: SLOT_COLOR[p.scene.slot] }} />
              <span className="holo-drawer-name">{p.title[lang]}</span>
              <em className="holo-drawer-tag">{lang === 'cs' ? 'otevřít' : 'open'}</em>
            </button>
          ))}

          <p className="holo-section">◈ {lang === 'cs' ? 'Systém' : 'System'}</p>
          {PORTALS.filter((p) => SYSTEM.includes(p.id)).map((p) => (
            <button
              key={p.id}
              type="button"
              className="holo-drawer-tile"
              style={{ borderLeftColor: SLOT_COLOR[p.scene.slot] }}
              onClick={() => openPortal(p.id)}
            >
              <span className="holo-drawer-dot" style={{ background: SLOT_COLOR[p.scene.slot] }} />
              <span className="holo-drawer-name">{p.title[lang]}</span>
              <em className="holo-drawer-tag">{lang === 'cs' ? 'otevřít' : 'open'}</em>
            </button>
          ))}

          <p className="holo-section holo-section-dim">
            ◈ {lang === 'cs' ? 'Připravujeme' : 'Coming soon'}
          </p>
          {PORTALS.filter((p) => p.status === 'stub').map((p) => (
            <button
              key={p.id}
              type="button"
              className="holo-drawer-tile is-stub"
              style={{ borderLeftColor: 'rgba(246,231,216,0.25)' }}
              onClick={() => openPortal(p.id)}
            >
              <span className="holo-drawer-dot" style={{ background: 'rgba(246,231,216,0.3)' }} />
              <span className="holo-drawer-name">{p.title[lang]}</span>
              <em className="holo-drawer-tag holo-drawer-tag-soon">
                {lang === 'cs' ? 've výstavbě' : 'in progress'}
              </em>
            </button>
          ))}
        </div>
        <footer className="holo-drawer-foot">
          <button type="button" className="holo-btn" onClick={toggleLang}>
            {lang === 'cs' ? 'EN' : 'CS'}
          </button>
          {xrSupported && !xrWanted && (
            <button type="button" className="holo-btn holo-btn-vr" onClick={enterVr}>
              VR
            </button>
          )}
        </footer>
      </nav>
      {planet && PLANET_PANELS[planet] && (
        <section className="planet-panel" aria-label={planet}>
          <header>
            <strong>{PLANET_PANELS[planet].title}</strong>
            <button type="button" className="planet-panel-close" onClick={backToEarth} aria-label="×">
              ×
            </button>
          </header>
          <p>{PLANET_PANELS[planet].note}</p>
          <div className="planet-panel-actions">
            <Link
              href={PLANET_PANELS[planet].href}
              className="park-btn"
              onClick={() => setPlanet(null)}
            >
              {PLANET_PANELS[planet].cta}
            </Link>
            {PLANET_PANELS[planet].portal && (
              <button
                type="button"
                className="arena-link"
                onClick={() => {
                  setPlanet(null);
                  openPortal(PLANET_PANELS[planet].portal ?? 'park');
                }}
              >
                otevřít okno pouti
              </button>
            )}
            <button type="button" className="arena-link" onClick={backToEarth}>
              ← zpět k Zemi
            </button>
          </div>
        </section>
      )}

      {worldsFailed && <p className="notice">{t('worldsEmpty')}</p>}
      {portal === 'world' && (
        <WorldPortal
          worlds={worlds}
          selectedId={selectedWorld}
          failed={worldsFailed}
          onSelect={selectWorld}
          onClose={() => setPortal(null)}
        />
      )}
      {portal === 'pool' && <PoolPortal onClose={() => setPortal(null)} />}
      {portal === 'chain' && <ChainPortal onClose={() => setPortal(null)} />}
      {portal === 'harbor' && <HarborPortal onClose={() => setPortal(null)} />}
      {portal === 'books' && <BooksPortal onClose={() => setPortal(null)} />}
      {portal === 'market' && <MarketPortal onClose={() => setPortal(null)} />}
      {portal === 'account' && <AccountPortal onClose={() => setPortal(null)} />}
      {portal === 'gate' && <GatePortal onClose={() => setPortal(null)} />}
      {portal === 'issobella' && <IssobellaPortal onClose={() => setPortal(null)} />}
      {portal === 'compute' && <ComputePortal onClose={() => setPortal(null)} />}
      {portal === 'park' && <ParkPortal onClose={closePortal} />}
      {portal === 'archa' && <ArchaPortal onClose={closePortal} />}
      {portal === 'matrix' && <MatrixPortal onClose={closePortal} />}
      {portal === 'fleet' && (
        <FleetPortal onClose={closePortal} leg={fleetLeg} onSelectLeg={setFleetLeg} />
      )}
      {portal === 'hiran' && (
        <HiranPortal
          onClose={closePortal}
          state={hiranState}
          onStateChange={(next) => setHiranState(normalizeHiranState(next))}
          focus={focus === 'sun' ? 'sun' : 'earth'}
          onFocusSun={() => setFocus('sun')}
          onFocusEarth={() => setFocus('earth')}
          probe={!reviewState}
        />
      )}
    </main>
  );
}
