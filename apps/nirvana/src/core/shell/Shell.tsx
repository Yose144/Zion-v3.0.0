'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/core/session/AuthProvider';
import { useI18n } from '@/core/i18n';
import { PORTALS, type SceneSlot } from '@/core/portals/manifest';
import { backendForXr, resolveGpuBackend, type GpuBackend } from '@/core/scene/backends';
import { SceneRoot } from '@/core/scene/SceneRoot';
import { AccountPortal } from '@/portals/account/AccountPortal';
import { BooksPortal } from '@/portals/books/BooksPortal';
import { ChainPortal } from '@/portals/chain/ChainPortal';
import { ComputePortal } from '@/portals/compute/ComputePortal';
import { HarborPortal } from '@/portals/freeworld/HarborPortal';
import { GatePortal } from '@/portals/gate/GatePortal';
import { IssobellaPortal } from '@/portals/issobella/IssobellaPortal';
import { MarketPortal } from '@/portals/market/MarketPortal';
import { PoolPortal } from '@/portals/pool/PoolPortal';
import { WorldPortal } from '@/portals/world/WorldPortal';
import { parseWorlds, type WorldPoint } from '@/lib/worlds';

const PANELS = new Set(PORTALS.map((p) => p.id));

const SLOT_COLOR: Record<SceneSlot, string> = {
  core: '#7ec8ff',
  surface: '#066928',
  ring: '#f5f5f5',
  orbit: '#c084fc',
  gate: '#fcd116',
  ship: '#e41e2b',
};

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

export function Shell() {
  const { t, lang, setLang } = useI18n();
  const { user, loading } = useAuth();
  const [backend, setBackend] = useState<GpuBackend | null>(null);
  const [worlds, setWorlds] = useState<WorldPoint[]>([]);
  const [worldsFailed, setWorldsFailed] = useState(false);
  const [portal, setPortal] = useState<string | null>(null);
  const [selectedWorld, setSelectedWorld] = useState<string | null>(null);
  const [xrWanted, setXrWanted] = useState(false);
  const [xrSupported, setXrSupported] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const hashInit = useRef(false);

  const openPortal = useCallback((id: string) => {
    setPortal(PANELS.has(id) ? id : null);
    setMenuOpen(false);
  }, []);

  const selectWorld = useCallback((id: string) => {
    setSelectedWorld(id);
    setPortal('world');
    setMenuOpen(false);
  }, []);

  // deep-link: #portal=<id>&world=<id>
  useEffect(() => {
    if (hashInit.current) return;
    hashInit.current = true;
    const { portal: p, world } = readHash();
    if (p) setPortal(p);
    if (world) setSelectedWorld(world);
    const onHash = () => {
      const next = readHash();
      setPortal(next.portal);
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

  function enterVr() {
    backendForXr();
    setBackend('webgl2');
    setXrWanted(true);
    setMenuOpen(false);
  }

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
          xr={xrWanted}
          label={t('gate')}
        />
      </div>
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
          {PORTALS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="holo-drawer-tile"
              style={{ borderLeftColor: SLOT_COLOR[p.scene.slot] }}
              onClick={() => openPortal(p.id)}
            >
              <span className="holo-drawer-dot" style={{ background: SLOT_COLOR[p.scene.slot] }} />
              {p.title[lang]}
              {p.status === 'stub' && <em className="holo-drawer-stub">·</em>}
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
    </main>
  );
}
