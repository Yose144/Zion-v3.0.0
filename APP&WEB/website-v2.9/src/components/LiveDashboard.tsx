'use client';

import { Activity, Construction, Info } from 'lucide-react';

export default function LiveDashboard() {
  return (
    <section className="py-20 px-4">
      <div className="zion-container">
        <div className="rounded-[28px] border border-amber-500/20 bg-amber-500/5 backdrop-blur-xl p-8 space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="inline-flex items-center gap-3 rounded-full border border-amber-500/30 px-4 py-2">
              <Activity className="w-5 h-5 text-amber-400 animate-pulse" />
              <span className="text-sm tracking-wide uppercase text-amber-300">Mission Console</span>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <Construction className="w-8 h-8 text-amber-400 shrink-0 mt-1" />
            <div>
              <h3 className="text-xl font-semibold text-amber-200 mb-2">
                Dashboard Under Reconstruction
              </h3>
              <p className="text-gray-300 leading-relaxed">
                The live blockchain telemetry dashboard is currently being rebuilt to resolve 
                compatibility issues with the latest Next.js rendering engine. We are working 
                to restore full functionality as soon as possible.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/40 p-4">
            <Info className="w-5 h-5 text-zion-cyan shrink-0 mt-0.5" />
            <p className="text-sm text-gray-400">
              In the meantime, you can visit the{' '}
              <a href="/explorer" className="text-zion-cyan hover:underline">Blockchain Explorer</a>
              {' '}or{' '}
              <a href="/dashboard" className="text-zion-cyan hover:underline">Full Dashboard</a>
              {' '}for live network data.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
