'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft, FileText, Anchor, ShieldCheck, ExternalLink,
  BookOpen, Users, Clock, Hash, AlertCircle,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { tx5, t5 } from '@/lib/i18n-tx';

type Paper = {
  id: string;
  title: string;
  authors: string; // JSON array
  abstract_text: string | null;
  content_url: string | null;
  content_sha256: string;
  status: string;
  anchor_txid: string | null;
  anchor_height: number | null;
  anchor_mode: string | null;
  created_at: string;
  anchored_at: string | null;
  published_at: string | null;
};

const Copy = {
  badge: { cs: 'L6 · Issobella · DeSci', en: 'L6 · Issobella · DeSci' },
  title: { cs: 'Vědecké výstupy', en: 'Research Papers' },
  titleAccent: { cs: 's L1 kotvou', en: 'with L1 anchor' },
  body: {
    cs: 'Každý publikovaný výstup nese kryptografický důkaz existence a integrity na ZION L1 — hash obsahu je timestamp-anchorován v transakčním memu. Publikovaný obsah nelze zpětně pozměnit bez detekce.',
    en: 'Every published output carries a cryptographic proof of existence and integrity on ZION L1 — the content hash is timestamp-anchored in a transaction memo. Published content cannot be altered retroactively without detection.',
  },
  back: { cs: 'Zpět na Issobellu', en: 'Back to Issobella' },
  loading: { cs: 'Načítám repozitář…', en: 'Loading repository…' },
  empty: {
    cs: 'Zatím žádné publikované výstupy. První papers dorazí po schválení v L6 Radě.',
    en: 'No published papers yet. The first papers arrive after L6 Council approval.',
  },
  upstreamDown: {
    cs: 'Repozitář je dočasně nedostupný.',
    en: 'The repository is temporarily unavailable.',
  },
  anchoredAt: { cs: 'Anchorováno v bloku', en: 'Anchored at block' },
  pendingAnchor: { cs: 'Čeká na L1 kotvu', en: 'Awaiting L1 anchor' },
  verify: { cs: 'Ověřit důkaz', en: 'Verify proof' },
  viewTx: { cs: 'Zobrazit tx', en: 'View tx' },
  authors: { cs: 'Autoři', en: 'Authors' },
  hash: { cs: 'blake3 obsahu', en: 'content blake3' },
  batchMode: { cs: 'merkle batch', en: 'merkle batch' },
  memoMode: { cs: 'přímá kotva', en: 'direct anchor' },
  submittedAt: { cs: 'Odevzdáno', en: 'Submitted' },
  howItWorks: { cs: 'Jak ověřit', en: 'How to verify' },
  howSteps: {
    cs: [
      'Stáhni soubor a přepočti jeho blake3 hash (b3sum).',
      'Porovnej ho s content_sha256 výstupu.',
      'Otevři anchor transakci v exploreru — memo nese hash (ISSPAPER:v1:… nebo ISSANCHOR:v1:…).',
    ],
    en: [
      'Download the file and recompute its blake3 hash (b3sum).',
      'Compare it with the output’s content_sha256.',
      'Open the anchor transaction in the explorer — the memo carries the hash (ISSPAPER:v1:… or ISSANCHOR:v1:…).',
    ],
  },
} as const;

function parseAuthors(raw: string): string[] {
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

export default function IssobellaPapersPage() {
  const { lang } = useLang();
  const cs = lang !== 'en';
  const [papers, setPapers] = useState<Paper[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/issobella/papers', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j?.success && Array.isArray(j.data)) setPapers(j.data);
        else setError(true);
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#050505] text-zinc-100">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Link
          href="/l6-issobella"
          className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zion-cyan"
        >
          <ArrowLeft className="h-4 w-4" /> {tx5(Copy.back, lang)}
        </Link>

        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-zion-cyan/80">
            {tx5(Copy.badge, lang)}
          </p>
          <h1 className="text-3xl font-bold sm:text-4xl">
            {tx5(Copy.title, lang)}{' '}
            <span className="bg-gradient-to-r from-zion-cyan to-zion-purple bg-clip-text text-transparent">
              {tx5(Copy.titleAccent, lang)}
            </span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400">
            {tx5(Copy.body, lang)}
          </p>
        </motion.header>

        <section className="space-y-4">
          {papers === null && !error && (
            <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-6 text-sm text-zinc-400">
              <Clock className="h-4 w-4 animate-pulse" /> {tx5(Copy.loading, lang)}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-300">
              <AlertCircle className="h-4 w-4" /> {tx5(Copy.upstreamDown, lang)}
            </div>
          )}

          {papers !== null && papers.length === 0 && !error && (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center">
              <BookOpen className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
              <p className="text-sm text-zinc-400">{tx5(Copy.empty, lang)}</p>
            </div>
          )}

          {papers?.map((p, i) => {
            const anchored = p.anchor_txid && p.anchor_height != null;
            return (
              <motion.article
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.4) }}
                className="rounded-xl border border-white/5 bg-white/[0.02] p-5 transition-colors hover:border-zion-cyan/20"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="flex items-start gap-2 text-base font-semibold leading-snug">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-zion-purple" />
                      {p.content_url ? (
                        <a
                          href={p.content_url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-zion-cyan hover:underline"
                        >
                          {p.title}
                        </a>
                      ) : (
                        p.title
                      )}
                    </h2>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                      <Users className="h-3 w-3" />
                      {parseAuthors(p.authors).join(', ') || '—'}
                    </p>
                  </div>

                  {anchored ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
                      <Anchor className="h-3 w-3" />
                      {tx5(Copy.anchoredAt, lang)} #{p.anchor_height}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-300">
                      <Clock className="h-3 w-3" />
                      {tx5(Copy.pendingAnchor, lang)}
                    </span>
                  )}
                </div>

                {p.abstract_text && (
                  <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-zinc-400">
                    {p.abstract_text}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-zinc-500">
                  <span className="inline-flex items-center gap-1 font-mono">
                    <Hash className="h-3 w-3" />
                    {tx5(Copy.hash, lang)}: {p.content_sha256.slice(0, 16)}…
                  </span>
                  {p.anchor_mode && (
                    <span className="text-zinc-600">
                      {p.anchor_mode.startsWith('merkle-batch')
                        ? tx5(Copy.batchMode, lang)
                        : tx5(Copy.memoMode, lang)}
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-3">
                    <a
                      href={`/api/issobella/papers/${encodeURIComponent(p.id)}/proof`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-zion-cyan hover:underline"
                    >
                      <ShieldCheck className="h-3 w-3" /> {tx5(Copy.verify, lang)}
                    </a>
                    {p.anchor_txid && (
                      <Link
                        href={`/explorer/tx?hash=${encodeURIComponent(p.anchor_txid)}`}
                        className="inline-flex items-center gap-1 text-zinc-400 hover:text-zion-cyan"
                      >
                        <ExternalLink className="h-3 w-3" /> {tx5(Copy.viewTx, lang)}
                      </Link>
                    )}
                  </span>
                </div>
              </motion.article>
            );
          })}
        </section>

        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-12 rounded-xl border border-white/5 bg-white/[0.02] p-6"
        >
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <ShieldCheck className="h-4 w-4 text-zion-cyan" />
            {tx5(Copy.howItWorks, lang)}
          </h3>
          <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-zinc-400">
            {(cs ? Copy.howSteps.cs : Copy.howSteps.en).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </motion.section>
      </div>
    </main>
  );
}
