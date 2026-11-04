'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  BookmarkCheck,
  Download,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { READER_BOOKS } from '../library-index';
import {
  clearReadingProgress,
  progressPercent,
  useReadingProgress,
} from '@/lib/books/progress';
import { removeBookmark, useBookmarks } from '@/lib/books/bookmarks';
import { Panel, PanelHeader, type Lang } from './shared';

const Copy = {
  kicker: { cs: 'Osobní přehled', en: 'Personal overview' },
  title: { cs: 'Moje knihovna', en: 'My library' },
  sub: {
    cs: 'Pass, rozečtené knihy a záložky — vše, co si archiv pamatuje ve tvém prohlížeči.',
    en: 'Your pass, open books and bookmarks — everything the archive remembers in your browser.',
  },
  passTitle: { cs: 'Přístup', en: 'Access' },
  passActive: { cs: 'Archiv je odemčený', en: 'The archive is unlocked' },
  passBuy: { cs: 'Marketplace', en: 'Marketplace' },
  readingTitle: { cs: 'Rozečtené knihy', en: 'Books in progress' },
  readingEmpty: {
    cs: 'Zatím nic rozečtené. Otevři první knihu v knihovně.',
    en: 'Nothing in progress yet. Open your first book in the library.',
  },
  bookmarksTitle: { cs: 'Záložky', en: 'Bookmarks' },
  bookmarksEmpty: {
    cs: 'Žádné záložky. V readeru klikni na „Záložka" u kapitoly.',
    en: 'No bookmarks. In the reader, click “Bookmark” on a chapter.',
  },
  ordersTitle: { cs: 'Moje objednávky', en: 'My orders' },
  ordersBody: {
    cs: 'Stav objednávky a doručený ZAP kód najdeš v marketplace.',
    en: 'Order status and the delivered ZAP code live in the marketplace.',
  },
  downloadsTitle: { cs: 'Ke stažení', en: 'Downloads' },
  downloadsBody: {
    cs: 'Kompletní edice ke čtení offline najdeš v sekci Ke stažení.',
    en: 'Complete editions for offline reading live in the Downloads section.',
  },
  openDownloads: { cs: 'Otevřít Ke stažení', en: 'Open Downloads' },
  openLibrary: { cs: 'Procházet knihovnu', en: 'Browse the library' },
  continue: { cs: 'Pokračovat', en: 'Continue' },
  open: { cs: 'Otevřít', en: 'Open' },
  clear: { cs: 'Vymazat historii čtení', en: 'Clear reading history' },
  remove: { cs: 'Odebrat záložku', en: 'Remove bookmark' },
  chapter: { cs: 'kapitola', en: 'chapter' },
};

export default function MojePanel({
  lang,
  passLabel,
  passVia,
}: {
  lang: Lang;
  passLabel: string | null;
  passVia: string | null;
}) {
  const l = lang;
  const progress = useReadingProgress();
  const bookmarks = useBookmarks();

  const reading = Object.values(progress).sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <Panel id="moje">
      <div className="space-y-7">
        <PanelHeader
          id="moje"
          rc="6, 182, 212"
          kicker={Copy.kicker[l]}
          title={Copy.title[l]}
          sub={Copy.sub[l]}
        />

        {/* pass */}
        <div className="zion-rainbow-sub flex flex-wrap items-center gap-3 p-4 sm:p-5" style={{ '--rc': '52, 211, 153' } as React.CSSProperties}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10">
            <ShieldCheck className="h-5 w-5 text-emerald-300" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">
              {Copy.passTitle[l]}
            </p>
            <p className="text-sm font-bold text-white">{passLabel ?? Copy.passActive[l]}</p>
            {passVia === 'zis-entitlement' && (
              <p className="text-[11px] text-gray-500">
                {l === 'cs' ? 'Pass je navázaný na tvůj ZIS účet.' : 'The pass is bound to your ZIS account.'}
              </p>
            )}
          </div>
          <a
            href="https://market.zionterranova.com/shop?category=books"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:border-white/30 hover:text-white"
          >
            {Copy.passBuy[l]}
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* reading progress */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-gray-200">
              {Copy.readingTitle[l]}
            </h3>
            {reading.length > 0 && (
              <button
                type="button"
                onClick={clearReadingProgress}
                className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] font-semibold text-gray-500 transition-colors hover:border-white/25 hover:text-gray-300"
              >
                <Trash2 className="h-3 w-3" />
                {Copy.clear[l]}
              </button>
            )}
          </div>

          {reading.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/15 p-5 text-xs text-gray-500">
              {Copy.readingEmpty[l]}
            </p>
          ) : (
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {reading.map((entry) => {
                const book = READER_BOOKS.find((b) => b.id === entry.bookId);
                const accent = book?.accent ?? '6, 182, 212';
                const pct = progressPercent(entry);
                return (
                  <li key={entry.bookId}>
                    <Link
                      href={`${entry.path}#${entry.chapterSlug}`}
                      prefetch={false}
                      className="group flex h-full items-center gap-3 rounded-xl border p-3.5 transition-colors"
                      style={{
                        borderColor: `rgba(${accent}, 0.25)`,
                        background: `rgba(${accent}, 0.05)`,
                      }}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                          {book?.groupLabel[l] ?? Copy.title[l]}
                        </span>
                        <span className="block truncate text-sm font-bold text-white group-hover:text-zion-gold">
                          {entry.bookTitle}
                        </span>
                        <span className="block truncate text-xs text-gray-400">{entry.chapterLabel}</span>
                        <span className="mt-2 flex items-center gap-2">
                          <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                            <span
                              className="block h-full rounded-full"
                              style={{ width: `${pct}%`, backgroundColor: `rgb(${accent})` }}
                            />
                          </span>
                          <span className="shrink-0 text-[10px] font-semibold text-gray-500">
                            {entry.chapterIndex + 1}/{entry.totalChapters} · {pct} %
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] font-semibold text-gray-400 group-hover:text-white">
                        {Copy.continue[l]}
                        <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* bookmarks */}
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-gray-200">
            <BookmarkCheck className="h-4 w-4 text-amber-300" />
            {Copy.bookmarksTitle[l]} · {bookmarks.length}
          </h3>
          {bookmarks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/15 p-5 text-xs text-gray-500">
              {Copy.bookmarksEmpty[l]}
            </p>
          ) : (
            <ul className="divide-y divide-white/5 rounded-xl border border-white/10 bg-white/[0.02]">
              {bookmarks.map((bookmark) => {
                const book = READER_BOOKS.find((b) => b.id === bookmark.bookId);
                return (
                  <li key={bookmark.id} className="flex items-center gap-2 px-3 py-2">
                    <Link
                      href={`${bookmark.path}#${bookmark.chapterSlug}`}
                      prefetch={false}
                      className="min-w-0 flex-1 rounded px-1 py-1 text-xs text-gray-300 transition-colors hover:text-white"
                    >
                      <span className="block truncate font-semibold">
                        {book?.title[l] ?? bookmark.bookTitle}
                      </span>
                      <span className="block truncate text-[11px] text-gray-500">
                        {bookmark.chapterLabel}
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => removeBookmark(bookmark.id)}
                      aria-label={Copy.remove[l]}
                      className="rounded p-1.5 text-gray-600 transition-colors hover:bg-white/10 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* downloads + library */}
        <div className="grid gap-2.5 sm:grid-cols-3">
          <a
            href="#stazeni"
            className="group flex items-center gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.05] p-4 transition-colors hover:border-emerald-400/50"
          >
            <Download className="h-5 w-5 shrink-0 text-emerald-300" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-white">{Copy.downloadsTitle[l]}</span>
              <span className="block text-xs text-gray-400">{Copy.downloadsBody[l]}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-emerald-300" />
          </a>
          <a
            href="#knihovna"
            className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-white/25"
          >
            <BookOpen className="h-5 w-5 shrink-0 text-zion-gold" />
            <span className="min-w-0 flex-1 text-sm font-bold text-white">{Copy.openLibrary[l]}</span>
            <ArrowRight className="h-4 w-4 shrink-0 text-gray-500" />
          </a>
          <a
            href="https://market.zionterranova.com/order-tracking"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-white/25"
          >
            <ShieldCheck className="h-5 w-5 shrink-0 text-zion-purple" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-white">{Copy.ordersTitle[l]}</span>
              <span className="block text-xs text-gray-400">{Copy.ordersBody[l]}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-gray-500" />
          </a>
        </div>
      </div>
    </Panel>
  );
}
