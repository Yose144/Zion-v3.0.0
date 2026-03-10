'use client';

import Link from 'next/link';
import { SITE_VERSION } from '@/lib/site';

export default function AdminDashboard() {
  return (
    <div className="zion-shell min-h-screen pt-32 pb-20 overflow-x-hidden">
      <div className="zion-container max-w-7xl space-y-12">
        <div className="rounded-[32px] border border-white/10 bg-black/60 p-10 backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Control plane</p>
              <h1 className="text-5xl md:text-6xl font-semibold text-gradient">Admin</h1>
              <p className="mt-4 text-lg text-gray-300 max-w-2xl">
                Operátor pro mining pool, routing a NCL orchestrace. Záměrně bez dead-linků —
                jen stránky, které reálně existují.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold hover:border-white/30"
              >
                Zpět na Dashboard
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-black/40 px-6 py-3 text-sm font-semibold hover:border-white/30"
              >
                Zpět na Web
              </Link>
            </div>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Miners</p>
              <p className="mt-2 text-3xl font-semibold text-white">—</p>
              <p className="text-sm text-gray-300">live napojení přes API</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Hashrate</p>
              <p className="mt-2 text-3xl font-semibold text-white">—</p>
              <p className="text-sm text-gray-300">pool aggregate</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Active algo</p>
              <p className="mt-2 text-3xl font-semibold text-white">—</p>
              <p className="text-sm text-gray-300">auto / manual</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Build</p>
              <p className="mt-2 text-3xl font-semibold text-white">{SITE_VERSION}</p>
              <p className="text-sm text-gray-300">admin UX shell</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Link href="/admin/algo-manager" className="group rounded-[28px] border border-white/10 bg-black/50 p-6 hover:border-white/25">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Mining</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Algorithm manager</h2>
            <p className="mt-3 text-gray-300">
              Přepínání algoritmů, status aktivního routingu a (po napojení API) profitability engine.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white/5 px-4 py-3 text-sm font-semibold text-white border border-white/10 group-hover:border-white/25">
              Otevřít
              <span className="text-zion-cyan">→</span>
            </div>
          </Link>

          <Link href="/admin/pool-config" className="group rounded-[28px] border border-white/10 bg-black/50 p-6 hover:border-white/25">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Routing</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Pool konfigurace</h2>
            <p className="mt-3 text-gray-300">
              URL poolů, wallet adresy a health-check konektivity pro multi-algo režim.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white/5 px-4 py-3 text-sm font-semibold text-white border border-white/10 group-hover:border-white/25">
              Otevřít
              <span className="text-zion-gold">→</span>
            </div>
          </Link>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-black/50 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">NCL</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Proof of Useful Work split</h2>
              <p className="mt-2 text-sm text-gray-300">
                Přehled rozdělení práce podle NCL konceptu (whitepaper v 2.9.5).
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Mining</p>
              <p className="mt-2 text-3xl font-semibold text-white">50%</p>
              <p className="text-sm text-gray-300">primární PoW práce</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">AI compute</p>
              <p className="mt-2 text-3xl font-semibold text-white">30%</p>
              <p className="text-sm text-gray-300">NPU / task gateway</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Merged mining</p>
              <p className="mt-2 text-3xl font-semibold text-white">20%</p>
              <p className="text-sm text-gray-300">hybridní bridge práce</p>
            </div>
          </div>
        </div>

        <div className="text-center text-sm text-gray-500">
          ZION Admin {SITE_VERSION} · zabezpečeno middleware Basic Auth (pokud je nastaveno)
        </div>
      </div>
    </div>
  );
}
