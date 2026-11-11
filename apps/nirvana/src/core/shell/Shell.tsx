'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/core/session/AuthProvider';
import { GAME_LINKS } from '@/core/games/links';
import { langLabel, nextLang, tx, useI18n } from '@/core/i18n';
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
import { FREE_WORLD_MISSIONS, MISSION_ORIGIN, MISSION_STATUS_COLOR } from '@/lib/freeworld-sites';
import { normalizeHiranState, hiranReviewOverride, type HiranState } from '@/core/hiran/presence';
import type { PlanetGameId, PlanetId } from '@/core/scene/universe/planetCatalog';
import type { UniverseFocus } from '@/core/scene/universe/LinkEngine';
import { LinkNavHud } from '@/core/scene/universe/LinkNavHud';

const PANELS = new Set(PORTALS.map((p) => p.id));

/**
 * Portál → kam se má kamera přiblížit. Jediná mapa; dřív to bylo sedm
 * if-větví s `flyTo(..., { camera: null as any })`, které při kliknutí házely.
 */
const PORTAL_FOCUS: Record<string, UniverseFocus> = {
  hiran: 'sun',
  park: 'jupiter',
  fleet: 'fleet',
  matrix: 'moon',
  archa: 'archa',
  issobella: 'issobella',
  gate: 'gate',
};

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
const PLANET_PANELS: Record<PlanetGameId, {
  title: string;
  note: string;
  href: string;
  cta: string;
  portal?: string;
  /** Druhá cesta z panelu (Uran: archiv i hratelná Křídla). */
  href2?: string;
  cta2?: string;
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
    note: 'Ragdoll klec — fyzika místo kombinací. Souboj, fotbal, přežití, trénink. Sólo i online duel.',
    href: '/mercury',
    cta: 'Do klece',
  },
  saturn: {
    title: 'SATURN',
    note: 'Kroniky — archiv kruhů. Prstence jako hřbety knih: každý segment je jeden svět.',
    href: '/saturn',
    cta: 'Otevřít kroniky',
  },
  park: {
    title: 'JUPITER',
    note: 'Jupiter Station — pouť, arkády, ruské kolo a tabule skóre.',
    href: '/park',
    cta: 'Na pouť',
    portal: 'park',
  },
  uranus: {
    title: 'URAN',
    note: 'Ledový archiv — planeta nakloněná na bok. A nad ním Lumi: děvčátko s lucernou, sedm světel a cesta.',
    href: '/uranus',
    cta: 'Otevřít archiv',
    href2: '/lumi',
    cta2: 'Letět s Lumi',
  },
  neptune: {
    title: 'NEPTUN',
    note: 'Hlubina — sestup atmosférou: patnáct světel, víry a stěny proudu. Lucerna je čas, plášť je chyba.',
    href: '/neptune',
    cta: 'Sestoupit',
  },
  pluto: {
    title: 'PLUTO',
    note: 'Srdce na okraji — devět lamp na zmrzlé pláni. Teplo drží jen lucerna; každá zapálená lampa je nové ohniště.',
    href: '/pluto',
    cta: 'Ke srdci',
  },
};

export function Shell() {
  const { t, lang, cycleLang } = useI18n();
  const { user, loading } = useAuth();
  const [backend, setBackend] = useState<GpuBackend | null>(null);
  const [worlds, setWorlds] = useState<WorldPoint[]>([]);
  const [worldsFailed, setWorldsFailed] = useState(false);
  const [portal, setPortal] = useState<string | null>(null);
  const [selectedWorld, setSelectedWorld] = useState<string | null>(null);
  const [hiranState, setHiranState] = useState<HiranState>(() => hiranReviewOverride() ?? 'idle');
  const [reviewState] = useState<HiranState | null>(() => hiranReviewOverride());
  const [focus, setFocus] = useState<string>('earth');
  /** Vybraná planeta = přiletěli jsme a nabízíme vstup do hry. ('jupiter' def používá key 'park'.) */
  const [planet, setPlanet] = useState<PlanetGameId | null>(null);
  /** Vybraná L5 misie na glóbu — stejný panel jako planeta. */
  const [missionKey, setMissionKey] = useState<string | null>(null);
  const [fleetLeg, setFleetLeg] = useState<FleetLeg | null>(null);
  const [xrWanted, setXrWanted] = useState(false);
  const [xrSupported, setXrSupported] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  const openPortal = useCallback(
    (id: string) => {
      const next = PANELS.has(id) ? id : null;
      setPortal(next);
      // Portál a planetární/mission panel sdílí stejnou plochu vpravo nahoře —
      // bez vyčištění by se vykreslily přes sebe.
      setPlanet(null);
      setMissionKey(null);
      // Jediná cesta: nastav fokus, přelet spustí `LinkEngine` přes `focus` prop.
      // Portál → cílový bod scény (kanonická mapa). World portál se vrací
      // na poslední vybraný svět; portály bez scény bodu jedou na Zemi.
      setFocus(
        next === 'world' && selectedWorld
          ? `world:${selectedWorld}`
          : (PORTAL_FOCUS[next ?? ''] ?? 'earth'),
      );
      setMenuOpen(false);
    },
    [selectedWorld],
  );

  // × portálu zavírá jen panel — kamera zůstává tam, kde je. Návrat domů
  // je explicitní navigace (← Země / Esc / linky), ne zavření okna.
  const closePortal = useCallback(() => {
    setPortal(null);
  }, []);

  const selectWorld = useCallback((id: string) => {
    setSelectedWorld(id);
    setPlanet(null);
    setMissionKey(null);
    setPortal('world');
    setFocus(`world:${id}`);
    setMenuOpen(false);
  }, []);

  // Přelety z LinkNavHud opouštějí kontext panelu — ten popisuje objekt,
  // u kterého kamera po přeletu už není. Bez zavření by visel nad cizím světem.
  const navFocus = useCallback((id: string) => {
    setFocus(id);
    setPortal(null);
    setPlanet(null);
    setMissionKey(null);
  }, []);

  /** Klik na L5 misii: přiletět na bod a otevřít stejný panel jako planeta. */
  const selectMission = useCallback((key: string) => {
    setMissionKey(key);
    setFocus(`mission:${key}`);
    setPortal(null);
    setPlanet(null);
    setMenuOpen(false);
  }, []);

  // deep-link: #portal=<id>&world=<id>
  // `world` bez `portal` otevře world portál na daném světě — sdílený odkaz
  // na svět je `#world=<id>`. `world` mimo world portál se ignoruje, ať
  // v URL nezůstane „duch" výběru, který se na obrazovce neprojeví.
  useEffect(() => {
    const apply = () => {
      const { portal: p, world } = readHash();
      const nextPortal = p ?? (world ? 'world' : null);
      if (nextPortal === 'world' && world) {
        setPortal('world');
        setSelectedWorld(world);
        setFocus(`world:${world}`);
      } else {
        setPortal(nextPortal);
        setSelectedWorld(null);
        setFocus(PORTAL_FOCUS[nextPortal ?? ''] ?? 'earth');
      }
      // Hash zadává jen portál — planetární/mission panel se otevírá klikem.
      setPlanet(null);
      setMissionKey(null);
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (portal) params.set('portal', portal);
    if (portal === 'world' && selectedWorld) params.set('world', selectedWorld);
    const hash = params.toString();
    // Sync beze ztráty query (`?sceneAudit=1`, `?hiran=`…) — jen hash se mění.
    const base = `${window.location.pathname}${window.location.search}`;
    const next = hash ? `${base}#${hash}` : base;
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== next) {
      history.replaceState(null, '', next);
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
  const selectPlanet = useCallback((id: PlanetId) => {
    setMissionKey(null);
    setPlanet(id === 'jupiter' ? 'park' : id);
    setFocus(id);
    setPortal(null);
    setMenuOpen(false);
  }, []);

  const backToEarth = useCallback(() => {
    setPlanet(null);
    setMissionKey(null);
    setFocus('earth');
  }, []);

  // Esc zavírá **horní** vrstvu: drawer → portál → planetární/mission panel.
  // Na `/` neběží hra, takže Esc tu nemůže ukrást pointer lock.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (menuOpen) {
        setMenuOpen(false);
        menuBtnRef.current?.focus();
      } else if (portal) {
        closePortal();
      } else if (planet || missionKey) {
        backToEarth();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen, portal, planet, missionKey, closePortal, backToEarth]);

  // Otevřený drawer převezme fokus na první položku — zavřený je
  // `visibility:hidden`, takže Tab do něj neuteče (opravuje a11y díru,
  // kterou `aria-hidden` sám nevyřeší: children zůstávají focusable).
  useEffect(() => {
    if (!menuOpen) return;
    const first = drawerRef.current?.querySelector<HTMLElement>('a[href], button:not([disabled])');
    first?.focus();
  }, [menuOpen]);

  const toggleLang = useCallback(() => {
    cycleLang();
  }, [cycleLang]);

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
          onSelectMission={selectMission}
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
      <LinkNavHud onFocus={navFocus} />
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
        ref={menuBtnRef}
        type="button"
        className="holo-menu-btn"
        aria-label="navigace"
        aria-expanded={menuOpen}
        aria-controls="holo-drawer"
        onClick={() => setMenuOpen((o) => !o)}
      >
        ☰
      </button>
      {menuOpen && (
        <button
          type="button"
          className="holo-drawer-scrim"
          aria-label="zavřít navigaci"
          onClick={() => {
            setMenuOpen(false);
            menuBtnRef.current?.focus();
          }}
        />
      )}
      <nav
        id="holo-drawer"
        ref={drawerRef}
        className={`holo-drawer${menuOpen ? ' open' : ''}`}
        aria-hidden={!menuOpen}
      >
        <header className="holo-drawer-head">
          <span className="holo-title">◈ KINGDOM CONSOLE</span>
          <button
            type="button"
            className="holo-btn"
            onClick={() => {
              setMenuOpen(false);
              menuBtnRef.current?.focus();
            }}
          >
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
              <span className="holo-drawer-name">{tx(game.title, lang)}</span>
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
              <span className="holo-drawer-name">{tx(p.title, lang)}</span>
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
              <span className="holo-drawer-name">{tx(p.title, lang)}</span>
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
              <span className="holo-drawer-name">{tx(p.title, lang)}</span>
              <em className="holo-drawer-tag holo-drawer-tag-soon">
                {lang === 'cs' ? 've výstavbě' : 'in progress'}
              </em>
            </button>
          ))}
        </div>
        <footer className="holo-drawer-foot">
          <button type="button" className="holo-btn" onClick={toggleLang}>
            {langLabel(nextLang(lang))}
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
            {PLANET_PANELS[planet].href2 && (
              <Link href={PLANET_PANELS[planet].href2!} className="arena-link" onClick={() => setPlanet(null)}>
                {PLANET_PANELS[planet].cta2}
              </Link>
            )}
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

      {focus === 'earth' && !planet && !missionKey && !portal && (
        <section className="planet-panel" aria-label="earth">
          <header>
            <strong>{lang === 'cs' ? 'PRVNÍ SVĚT' : 'FIRST WORLD'}</strong>
          </header>
          <p>
            {lang === 'cs'
              ? 'MOBA na Nové Zemi — tři linky, pět na pět, uzly L5.'
              : 'MOBA on New Earth — three lanes, five versus five, L5 nodes.'}
          </p>
          <div className="planet-panel-actions">
            <Link href="/earth" className="park-btn">
              {lang === 'cs' ? 'Hrát' : 'Play'}
            </Link>
          </div>
        </section>
      )}

      {missionKey &&
        (() => {
          const m = FREE_WORLD_MISSIONS.find((x) => x.key === missionKey);
          if (!m) return null;
          const statusLabel =
            m.status === 'built' ? 'stojí' : m.status === 'preparation' ? 'v přípravě' : 'vize';
          const href = m.present ?? `${MISSION_ORIGIN}${m.path}`;
          const inner = m.present ? (
            <Link href={href} className="park-btn" onClick={() => setMissionKey(null)}>
              Otevřít prezentaci
            </Link>
          ) : (
            <a href={href} className="park-btn" target="_blank" rel="noopener noreferrer">
              Otevřít stránku
            </a>
          );
          return (
            <section className="planet-panel" aria-label={m.name}>
              <header>
                <strong>{m.name}</strong>
                <button
                  type="button"
                  className="planet-panel-close"
                  onClick={backToEarth}
                  aria-label="×"
                >
                  ×
                </button>
              </header>
              <p>
                <span style={{ color: MISSION_STATUS_COLOR[m.status] }}>{statusLabel}</span>
                {' · L5 Free World'}
              </p>
              <div className="planet-panel-actions">
                {inner}
                <button type="button" className="arena-link" onClick={backToEarth}>
                  ← zpět k Zemi
                </button>
              </div>
            </section>
          );
        })()}

      {worldsFailed && <p className="notice">{t('worldsEmpty')}</p>}
      {portal === 'world' && (
        <WorldPortal
          worlds={worlds}
          selectedId={selectedWorld}
          failed={worldsFailed}
          onSelect={selectWorld}
          onClose={closePortal}
        />
      )}
      {portal === 'pool' && <PoolPortal onClose={closePortal} />}
      {portal === 'chain' && <ChainPortal onClose={closePortal} />}
      {portal === 'harbor' && <HarborPortal onClose={closePortal} />}
      {portal === 'books' && <BooksPortal onClose={closePortal} />}
      {portal === 'market' && <MarketPortal onClose={closePortal} />}
      {portal === 'account' && <AccountPortal onClose={closePortal} />}
      {portal === 'gate' && <GatePortal onClose={closePortal} />}
      {portal === 'issobella' && <IssobellaPortal onClose={closePortal} />}
      {portal === 'compute' && <ComputePortal onClose={closePortal} />}
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
