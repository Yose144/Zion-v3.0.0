'use client';

/**
 * NotificationBell — ZIS notification inbox in the site nav.
 *
 * Renders only for authenticated users. Polls /api/notifications/unread-count
 * and shows a dropdown with the latest items; click marks read, link from
 * `data.href` (if the producer set one) navigates to the relevant page.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Sparkles, Pickaxe, ShoppingBag, Scale, ArrowLeftRight, Info } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LanguageContext';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  type ZisNotification,
} from '@/lib/zis';

const POLL_MS = 45_000;

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
  markAllRead: { cs: 'Označit vše jako přečtené', en: 'Mark all read' },
  empty: { cs: 'Žádné notifikace', en: 'No notifications' },
  showAll: { cs: 'Zobrazit vše', en: 'View all' },
};

function timeAgo(iso: string, cs: boolean): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return cs ? 'právě teď' : 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function NotificationBell() {
  const { authenticated } = useAuth();
  const { lang } = useLang();
  const router = useRouter();
  const cs = lang === 'cs';

  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<ZisNotification[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    try {
      setUnread(await getUnreadNotificationCount());
    } catch {
      /* keep previous count on transient errors */
    }
  }, []);

  const refreshList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await getNotifications({ limit: 10 });
      setItems(res.notifications);
      setUnread(res.unread);
    } catch {
      /* noop — bell stays stale */
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    void refreshCount();
    const t = setInterval(refreshCount, POLL_MS);
    return () => clearInterval(t);
  }, [authenticated, refreshCount]);

  /* Close on click outside / Escape */
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) void refreshList();
  };

  const openItem = async (n: ZisNotification) => {
    if (!n.read) {
      void markNotificationRead(n.id);
      setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((c) => Math.max(0, c - 1));
    }
    const href = (n.data as Record<string, unknown> | null)?.href;
    if (typeof href === 'string' && href.startsWith('/')) {
      setOpen(false);
      router.push(href);
    }
  };

  const markAll = async () => {
    const res = await markAllNotificationsRead();
    if (res.ok) {
      setItems((xs) => xs.map((x) => ({ ...x, read: true })));
      setUnread(0);
    }
  };

  if (!authenticated) return null;

  return (
    <div ref={rootRef} className="relative" data-notif-bell>
      <button
        onClick={toggle}
        title={COPY.notifications[cs ? 'cs' : 'en']}
        aria-label={COPY.notifications[cs ? 'cs' : 'en']}
        aria-expanded={open}
        className="relative inline-flex rounded-lg border border-white/15 bg-black/85 p-1.5 items-center justify-center shadow-[0_10px_28px_rgba(0,0,0,0.25)] transition-transform hover:-translate-y-0.5 hover:border-zion-gold/50"
      >
        <Bell className="w-3.5 h-3.5 text-white" />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] rounded-full bg-zion-gold text-black text-[9px] font-bold flex items-center justify-center px-0.5 shadow-[0_0_8px_rgba(252,209,22,0.55)]">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(340px,90vw)] rounded-2xl border border-white/10 bg-black/90 backdrop-blur-2xl shadow-[0_18px_60px_rgba(0,0,0,0.55)] z-50 overflow-hidden">
          <div className="h-0.5 w-full bg-linear-to-r from-zion-cyan/50 via-zion-gold/60 to-zion-purple/40" />
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <p className="text-[10px] uppercase tracking-[0.35em] text-zion-gold/70">
              {COPY.notifications[cs ? 'cs' : 'en']}
            </p>
            {unread > 0 && (
              <button
                onClick={markAll}
                className="inline-flex items-center gap-1 text-[10px] text-zion-cyan/80 hover:text-zion-cyan transition-colors"
              >
                <CheckCheck className="w-3 h-3" />
                {COPY.markAllRead[cs ? 'cs' : 'en']}
              </button>
            )}
          </div>

          <div className="max-h-[50vh] overflow-y-auto">
            {loadingList && items.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-gray-500 animate-pulse">…</div>
            )}
            {!loadingList && items.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-gray-500">
                {COPY.empty[cs ? 'cs' : 'en']}
              </div>
            )}
            {items.map((n) => {
              const Icon = TYPE_ICON[n.type] ?? Info;
              return (
                <button
                  key={n.id}
                  onClick={() => void openItem(n)}
                  className={`w-full text-left px-4 py-3 flex gap-3 border-t border-white/5 transition-colors hover:bg-white/5 ${
                    n.read ? 'opacity-55' : ''
                  }`}
                >
                  <span className={`mt-0.5 shrink-0 ${n.read ? 'text-gray-500' : 'text-zion-gold'}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={`text-xs font-semibold truncate ${n.read ? 'text-gray-400' : 'text-white'}`}>
                        {n.title}
                      </span>
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-zion-gold shrink-0" />}
                    </span>
                    <span className="block text-[11px] text-gray-400 leading-snug mt-0.5 line-clamp-2">
                      {n.body}
                    </span>
                    <span className="block text-[10px] text-gray-600 mt-1">
                      {timeAgo(n.createdAt, cs)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
