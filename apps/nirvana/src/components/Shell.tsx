'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { AccountPortal } from '@/components/AccountPortal';
import { BooksPortal } from '@/components/BooksPortal';
import { ChainPortal } from '@/components/ChainPortal';
import { HarborPortal } from '@/components/HarborPortal';
import { MarketPortal } from '@/components/MarketPortal';
import { PoolPortal } from '@/components/PoolPortal';
import { WorldCanvas } from '@/components/WorldCanvas';
import { WorldPortal } from '@/components/WorldPortal';
import { resolveGpuBackend, type GpuBackend } from '@/lib/gpuBackend';
import { useI18n } from '@/lib/i18n';
import { PORTALS } from '@/lib/portals';
import { parseWorlds, type WorldPoint } from '@/lib/worlds';

const PANELS = new Set(['world', 'mine', 'chain', 'harbor', 'books', 'market', 'account']);

export function Shell() {
  const { t, lang, setLang } = useI18n();
  const { user, loading, logout } = useAuth();
  const [backend, setBackend] = useState<GpuBackend | null>(null);
  const [worlds, setWorlds] = useState<WorldPoint[]>([]);
  const [worldsFailed, setWorldsFailed] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [portal, setPortal] = useState<string | null>(null);
  const [selectedWorld, setSelectedWorld] = useState<string | null>(null);

  function openPortal(id: string) {
    setPortal(PANELS.has(id) ? id : null);
  }

  function selectWorld(id: string) {
    setSelectedWorld(id);
    setPortal('world');
  }

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

  const address = user?.primaryAddress ?? '';
  const short = address.length > 16 ? `${address.slice(0, 10)}…${address.slice(-4)}` : address;

  return (
    <main className="shell">
      <div className="stage">
        {canvasReady && (
          <WorldCanvas
            worlds={worlds}
            onOpen={openPortal}
            onSelectWorld={selectWorld}
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
            <span key={item.id} className="stub">
              {item.title[lang]}
            </span>
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
      {portal === 'mine' && <PoolPortal onClose={() => setPortal(null)} />}
      {portal === 'chain' && <ChainPortal onClose={() => setPortal(null)} />}
      {portal === 'harbor' && <HarborPortal onClose={() => setPortal(null)} />}
      {portal === 'books' && <BooksPortal onClose={() => setPortal(null)} />}
      {portal === 'market' && <MarketPortal onClose={() => setPortal(null)} />}
      {portal === 'account' && <AccountPortal onClose={() => setPortal(null)} />}
    </main>
  );
}
