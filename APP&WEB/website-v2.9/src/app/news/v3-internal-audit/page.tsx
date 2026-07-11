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

        <div className="zion-rainbow-card p-7 sm:p-10" style={{ '--rc': '239, 68, 68' } as React.CSSProperties}>
          <div className="flex items-start gap-4">
            <div className="zion-rainbow-sub flex h-12 w-12 shrink-0 items-center justify-center" style={{ '--rc': '239, 68, 68' } as React.CSSProperties}>
              <ShieldCheck className="h-6 w-6 text-red-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.35em] text-red-200/70">
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
            <div className="zion-rainbow-sub p-5" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
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
            <div className="zion-rainbow-sub p-5" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
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
            <div className="zion-rainbow-sub p-5" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
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
              className="zion-button-secondary px-5 py-2.5 text-sm"
            >
              {cs ? 'Síťový snapshot' : 'Network snapshot'}
            </Link>
            <Link
              href="/docs"
              className="zion-button-secondary px-5 py-2.5 text-sm"
            >
              {cs ? 'Dokumentace' : 'Docs'}
            </Link>
            <a
              href="https://github.com/Yose144/2.9.6"
              target="_blank"
              rel="noreferrer"
              className="zion-button-primary px-5 py-2.5 text-sm"
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

