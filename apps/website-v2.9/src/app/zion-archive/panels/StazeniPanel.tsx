'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  CheckCircle2,
  Download,
  FileArchive,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { ARCHIVE_DOWNLOADS } from '@/lib/books/downloads';
import { Panel, PanelHeader, type Lang } from './shared';

const Copy = {
  kicker: { cs: 'Edice a soubory', en: 'Editions & files' },
  title: { cs: 'Ke stažení', en: 'Downloads' },
  sub: {
    cs: 'Kompletní edice ke čtení offline. Stahování je součástí ZION Passu — stejná brána jako reader.',
    en: 'Complete editions for offline reading. Downloads are part of the ZION Pass — the same gate as the reader.',
  },
  passNote: {
    cs: 'Soubory jsou pro osobní použití. Archiv Pass chrání knihovnu; odkaz na stažení ověřujeme na serveru, ne v prohlížeči.',
    en: 'Files are for personal use. The Archive Pass protects the library; the download link is verified on the server, not in the browser.',
  },
  download: { cs: 'Stáhnout ZIP', en: 'Download ZIP' },
  openBook: { cs: 'Otevřít knihu', en: 'Open the book' },
  updated: { cs: 'Aktualizováno', en: 'Updated' },
  comingTitle: { cs: 'Co připravujeme', en: 'What is coming' },
  coming: {
    cs: 'Samostatné edice dalších knih (PDF + EPUB), audio vybraných kapitol a tištěné edice na vyžádání.',
    en: 'Standalone editions of the other books (PDF + EPUB), audio for selected chapters, and print editions on request.',
  },
  empty: { cs: 'Zatím tu není žádná edice.', en: 'No editions yet.' },
};

export default function StazeniPanel({ lang }: { lang: Lang }) {
  const l = lang;
  const dateFmt = new Intl.DateTimeFormat(l === 'cs' ? 'cs-CZ' : 'en-GB', {
    dateStyle: 'medium',
  });

  return (
    <Panel id="stazeni">
      <div className="space-y-6">
        <PanelHeader
          id="stazeni"
          rc="52, 211, 153"
          kicker={Copy.kicker[l]}
          title={Copy.title[l]}
          sub={Copy.sub[l]}
        />

        <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <p className="text-xs leading-relaxed text-gray-400">{Copy.passNote[l]}</p>
        </div>

        {ARCHIVE_DOWNLOADS.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-xs text-gray-500">
            {Copy.empty[l]}
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {ARCHIVE_DOWNLOADS.map((item) => (
              <li key={item.id} className="h-full">
                <article
                  className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]"
                  style={{ '--rc': '52, 211, 153' } as CSSProperties}
                >
                  <div className="relative h-20 overflow-hidden border-b border-white/10 bg-[radial-gradient(120%_120%_at_85%_10%,rgba(52,211,153,0.28),rgba(52,211,153,0.05)_55%,transparent_78%)]">
                    <FileArchive className="pointer-events-none absolute -right-2 -top-2 h-20 w-20 text-emerald-300/20" />
                    <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
                        {item.formatLabel}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                        {item.sizeLabel}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col gap-2.5 p-4">
                    <h3 className="text-sm font-bold leading-snug text-white">{item.title[l]}</h3>
                    <p className="text-xs leading-relaxed text-gray-400">{item.description[l]}</p>

                    <ul className="space-y-1.5">
                      {item.highlights.map((highlight) => (
                        <li
                          key={highlight.cs}
                          className="flex items-start gap-2 text-[11px] leading-relaxed text-gray-300"
                        >
                          <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                          {highlight[l]}
                        </li>
                      ))}
                    </ul>

                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                      <span>{item.languages[l]}</span>
                      <span className="text-gray-700">·</span>
                      <span>
                        {Copy.updated[l]}: {dateFmt.format(new Date(item.updated))}
                      </span>
                    </p>

                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-1.5">
                      <a
                        href={`/api/archive/downloads/${item.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zion-gold/60"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {Copy.download[l]}
                      </a>
                      {item.bookHref && (
                        <Link
                          href={item.bookHref}
                          prefetch={false}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-400 transition-colors hover:border-white/25 hover:text-gray-200"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                          {Copy.openBook[l]}
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              </li>
            ))}

            <li className="h-full">
              <div className="flex h-full flex-col justify-center rounded-2xl border border-dashed border-white/15 p-5">
                <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500">
                  <Sparkles className="h-3.5 w-3.5 text-zion-gold" />
                  {Copy.comingTitle[l]}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-gray-500">{Copy.coming[l]}</p>
              </div>
            </li>
          </ul>
        )}
      </div>
    </Panel>
  );
}
