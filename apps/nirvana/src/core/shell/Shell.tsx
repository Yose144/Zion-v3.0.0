'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/core/session/AuthProvider';
import { useI18n } from '@/core/i18n';
import { PORTALS, portalById } from '@/core/portals/manifest';
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

const PANELS = new Set(PORTALS.filter((p) => p.status === 'wired' || p.scene.slot === 'gate' || p.scene.slot === 'ring' || p.id === 'compute').map((p) => p.id));

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
  const { user, loading, logout } = useAuth();
  const [backend, setBackend] = useState<GpuBackend | null>(null);
  const [worlds, setWorlds] = useState<WorldPoint[]>([]);
  const [worldsFailed, setWorldsFailed] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [portal, setPortal] = useState<string | null>(null);
  const [selectedWorld, setSelectedWorld] = useState<string | null>(null);
  const [xrWanted, setXrWanted] = useState(false);
  const [xrSupported, setXrSupported] = useState<boolean | null>(null);
  const hashInit = useRef(false);

  const openPortal = useCallback((id: string) => {
    setPortal(PANELS.has(id) ? id : null);
  }, []);

  const selectWorld = useCallback((id: string) => {
    setSelectedWorld(id);
    setPortal('world');
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
    if (!xr?.isSessionSupported) {
      setXrSupported(false);
      return;
    }
    xr.isSessionSupported('immersive-vr').then(setXrSupported).catch(() => setXrSupported(false));
  }, []);

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
      })
      .finally(() => {
        if (live) setCanvasReady(true);
      });
    return () => {
      live = false;
    };
  }, []);

  function enterVr() {
    // XR session → WebGL2 backend (XRGPUBinding není venku) → remount canvas
    backendForXr();
    setBackend('webgl2');
    setXrWanted(true);
  }

  const address = user?.primaryAddress ?? '';
  const short = address.length > 16 ? `${address.slice(0, 10)}…${address.slice(-4)}` : address;

  return (
    <main className="shell">
      <div className="stage">
        {canvasReady && (
          <SceneRoot
            key={xrWanted ? 'xr' : (backend ?? 'boot')}
            worlds={worlds}
            portals={PORTALS}
            onOpen={openPortal}
            onSelectWorld={selectWorld}
            xr={xrWanted}
            label={t('gate')}
          />
        )}
      </div>
      <header className="chrome">
        <div>
          <strong>{t('title')}</strong>
          <span className="muted"> · {t('subtitle')}</span>
          {backend && <span className="badge">{backend}</span>}
        </div>
        <div className="chrome-actions">
          {xrSupported && !xrWanted && (
            <button type="button" onClick={enterVr} title="WebXR">
              {t('enterVr')}
            </button>
          )}
          {xrSupported === false && <span className="muted">{t('vrUnsupported')}</span>}
          <span className="muted">
            {worlds.length} {t('worlds')}
          </span>
          <button type="button" onClick={() => setLang(lang === 'cs' ? 'en' : 'cs')}>
            {lang === 'cs' ? 'EN' : 'CS'}
          </button>
          <button type="button" className="account" title={t('session')} onClick={() => openPortal('account')}>
            {loading ? '…' : user ? short : t('signedOut')}
          </button>
          {user && (
            <button type="button" onClick={() => void logout()}>
              {t('signOut')}
            </button>
          )}
        </div>
      </header>
      {worldsFailed && <p className="notice">{t('worldsEmpty')}</p>}
      {!canvasReady && <p className="notice">{t('loading')}</p>}
      <nav className="dock" aria-label={t('title')}>
        {PORTALS.map((item) =>
          item.status === 'wired' ? (
            <button
              key={item.id}
              type="button"
              aria-pressed={portal === item.id}
              onClick={() => openPortal(item.id)}
            >
              {item.title[lang]}
            </button>
          ) : (
            <button
              key={item.id}
              type="button"
              className="stub-btn"
              aria-pressed={portal === item.id}
              onClick={() => openPortal(item.id)}
            >
              {item.title[lang]}
            </button>
          ),
        )}
      </nav>
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
