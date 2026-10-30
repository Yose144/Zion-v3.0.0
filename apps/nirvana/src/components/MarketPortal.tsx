'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';

interface ShelfItem {
  id: string;
  name: string;
  category: string;
  priceCzk: number;
  inStock: boolean;
}

function readShelf(payload: unknown): ShelfItem[] {
  if (!payload || typeof payload !== 'object') return [];
  const rows = (payload as { products?: unknown }).products;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const item = row as ShelfItem;
    if (typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.priceCzk !== 'number') {
      return [];
    }
    return [item];
  });
}

export function MarketPortal({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<ShelfItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch('/api/market/products', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<unknown>;
      })
      .then((body) => {
        if (live) setItems(readShelf(body));
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const title = lang === 'cs' ? 'Trh' : 'Market';

  return (
    <aside className="portal" role="dialog" aria-label={title}>
      <header className="portal-head">
        <h2>{title}</h2>
        <button type="button" onClick={onClose}>
          {t('close')}
        </button>
      </header>
      <p className="muted">{t('marketShelf')}</p>
      {failed && <p>{t('marketEmpty')}</p>}
      {!failed && items == null && <p>…</p>}
      {items && items.length === 0 && !failed && <p>{t('marketEmpty')}</p>}
      {items && items.length > 0 && (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <strong>{item.name}</strong>
              <span className="muted">
                {' '}
                · {item.priceCzk.toLocaleString(lang === 'cs' ? 'cs-CZ' : 'en-US')} Kč
                {item.category ? ` · ${item.category}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
