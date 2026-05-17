'use client';

import Link from 'next/link';
import { ArrowLeft, ExternalLink, ShieldCheck, ListChecks, AlertTriangle } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

export default function V3InternalAuditNewsPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  return (
    <div className="pt-28 pb-20">
      <div className="zion-container max-w-4xl">
        <Link
          href="/news"
          className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          {cs ? 'Zpět na novinky' : 'Back to news'}
        </Link>

        <div className="rounded-4xl border border-emerald-400/20 bg-emerald-400/5 p-7 sm:p-10 backdrop-blur">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/10">
              <ShieldCheck className="h-6 w-6 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">
                {cs ? 'Audit · 2026-05-04' : 'Audit · 2026-05-04'}
              </p>
              <h1 className="mt-2 text-3xl sm:text-4xl font-semibold text-white leading-tight">
                {cs
                  ? 'Interní audit ZION V3 dokončen'
                  : 'ZION V3 internal audit completed'}
              </h1>
              <p className="mt-4 text-base text-white/70 leading-relaxed">
                {cs
                  ? 'Zkonsolidovali jsme interní security audit V3 do jednoho čitelného snapshotu: co je mainnet-ready, co je dormant fix čekající na koordinovaný hard fork, a jaké operační kroky jsou nutné před Genesis.'
                  : 'We consolidated the V3 internal security audit into a single readable snapshot: what is mainnet-ready, what is a dormant fix waiting for a coordinated hard fork, and which operational steps are required before Genesis.'}
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <ListChecks className="h-4 w-4 text-emerald-400" />
                {cs ? 'Uzavřené nálezy' : 'Closed findings'}
              </div>
              <p className="mt-2 text-sm text-white/60 leading-relaxed">
                {cs
                  ? 'Kritické fixy jsou implementované a verifikované testy (F1, F3, F4, F5, F6 + další).'
                  : 'Critical fixes are implemented and verified by tests (F1, F3, F4, F5, F6 + more).'}
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <AlertTriangle className="h-4 w-4 text-zion-gold" />
                {cs ? 'Co ještě blokuje' : 'What still blocks'}
              </div>
              <p className="mt-2 text-sm text-white/60 leading-relaxed">
                {cs
                  ? 'Operační hygiena: rotace kompromitovaných klíčů, scrub historie, CI billing, a koordinované fork okno.'
                  : 'Operational hygiene: rotate compromised keys, scrub history, fix CI billing, and coordinate the fork window.'}
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <ShieldCheck className="h-4 w-4 text-zion-cyan" />
                {cs ? 'Aktivační plán' : 'Activation plan'}
              </div>
              <p className="mt-2 text-sm text-white/60 leading-relaxed">
                {cs
                  ? 'Hard fork: aktivace tx-hash v2 a Merkle F2 jako koordinovaný upgrade.'
                  : 'Hard fork: activate tx-hash v2 and Merkle F2 as a coordinated upgrade.'}
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/network"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              {cs ? 'Síťový snapshot' : 'Network snapshot'}
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              {cs ? 'Dokumentace' : 'Docs'}
            </Link>
            <a
              href="https://github.com/Yose144/2.9.6"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-5 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-400/15 transition-colors"
            >
              {cs ? 'Repo / audit soubory' : 'Repo / audit files'}
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

