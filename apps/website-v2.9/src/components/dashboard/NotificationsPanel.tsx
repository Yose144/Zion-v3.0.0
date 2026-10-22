'use client';

/**
 * NotificationsPanel — full notification inbox for /account.
 *
 * Lists all ZIS notifications with mark-read / delete / load-more.
 * Bell dropdown in Navigation shows only the latest 10; this is the
 * complete history view.
 */

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell, CheckCheck, Trash2, Sparkles, Pickaxe, ShoppingBag,
  Scale, ArrowLeftRight, Info, Loader2,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  type ZisNotification,
} from '@/lib/zis';

const PAGE = 25;

const TYPE_ICON: Record<string, typeof Info> = {
  oasis_achievement: Sparkles,
  market_sale: ShoppingBag,
  market_listing: ShoppingBag,
  mining_payout: Pickaxe,
  dao_vote: Scale,
  bridge_complete: ArrowLeftRight,
  dex_swap: ArrowLeftRight,
  system: Info,
};

const COPY = {
  notifications: { cs: 'Notifikace', en: 'Notifications' },
  unread: { cs: 'nepřečtené', en: 'unread' },
  markAllRead: { cs: 'Označit vše jako přečtené', en: 'Mark all read' },
  empty: { cs: 'Zatím žádné notifikace. Nové události z ekosystému se objeví tady.', en: 'No notifications yet. New ecosystem events will appear here.' },
  loadMore: { cs: 'Načíst další', en: 'Load more' },
  loading: { cs: 'Načítám…', en: 'Loading…' },
};

function fmtDate(iso: string, cs: boolean): string {
  return new Date(iso).toLocaleString(cs ? 'cs-CZ' : 'en-US', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function NotificationsPanel() {
  const { lang } = useLang();
  const router = useRouter();
  const cs = lang === 'cs';

  const [items, setItems] = useState<ZisNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (offset = 0, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const res = await getNotifications({ limit: PAGE, offset });
      setItems((xs) => (append ? [...xs, ...res.notifications] : res.notifications));
      setTotal(res.total);
      setUnread(res.unread);
    } catch {
      /* keep current state */
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const open = async (n: ZisNotification) => {
    if (!n.read) {
      void markNotificationRead(n.id);
      setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((c) => Math.max(0, c - 1));
    }
    const href = (n.data as Record<string, unknown> | null)?.href;
    if (typeof href === 'string' && href.startsWith('/')) router.push(href);
  };

  const remove = async (id: string) => {
    const res = await deleteNotification(id);
    if (res.ok) {
      const wasUnread = items.find((x) => x.id === id)?.read === false;
      setItems((xs) => xs.filter((x) => x.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      if (wasUnread) setUnread((c) => Math.max(0, c - 1));
    }
  };

  const markAll = async () => {
    const res = await markAllNotificationsRead();
    if (res.ok) {
      setItems((xs) => xs.map((x) => ({ ...x, read: true })));
      setUnread(0);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-zion-gold" />
          <h2 className="text-lg font-bold text-white">{COPY.notifications[cs ? 'cs' : 'en']}</h2>
          {unread > 0 && (
            <span className="rounded-full bg-zion-gold/15 border border-zion-gold/40 px-2 py-0.5 text-[10px] font-semibold text-zion-gold">
              {unread} {COPY.unread[cs ? 'cs' : 'en']}
            </span>
          )}
        </div>
        {unread > 0 && (
          <button
            onClick={markAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zion-cyan/30 bg-zion-cyan/10 px-3 py-1.5 text-xs text-zion-cyan hover:bg-zion-cyan/20 transition-colors"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {COPY.markAllRead[cs ? 'cs' : 'en']}
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm">{COPY.loading[cs ? 'cs' : 'en']}</span>
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center">
          <Bell className="h-8 w-8 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500">{COPY.empty[cs ? 'cs' : 'en']}</p>
        </div>
      )}

      <div className="space-y-2">
        {items.map((n) => {
          const Icon = TYPE_ICON[n.type] ?? Info;
          return (
            <div
              key={n.id}
              role="button"
              tabIndex={0}
              onClick={() => void open(n)}
              onKeyDown={(e) => { if (e.key === 'Enter') void open(n); }}
              className={`zion-rainbow-sub p-4 flex items-start gap-3 cursor-pointer transition-colors hover:border-white/25 ${
                n.read ? 'opacity-60' : ''
              }`}
              style={{ '--rc': '252, 209, 22' } as CSSProperties}
            >
              <span className={`mt-0.5 shrink-0 ${n.read ? 'text-gray-500' : 'text-zion-gold'}`}>
                <Icon className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${n.read ? 'text-gray-400' : 'text-white'}`}>
                    {n.title}
                  </span>
                  {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-zion-gold shrink-0" />}
                </div>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">{n.body}</p>
                <p className="text-[10px] text-gray-600 mt-1.5 font-mono">{fmtDate(n.createdAt, cs)}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); void remove(n.id); }}
                className="shrink-0 rounded-lg border border-white/10 p-1.5 text-gray-500 hover:text-red-400 hover:border-red-400/40 transition-colors"
                aria-label="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {items.length < total && (
        <div className="mt-4 text-center">
          <button
            onClick={() => void load(items.length, true)}
            disabled={loadingMore}
            className="zion-button-secondary px-4 py-2 text-xs inline-flex items-center gap-2"
          >
            {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {COPY.loadMore[cs ? 'cs' : 'en']} ({items.length}/{total})
          </button>
        </div>
      )}
    </div>
  );
}
