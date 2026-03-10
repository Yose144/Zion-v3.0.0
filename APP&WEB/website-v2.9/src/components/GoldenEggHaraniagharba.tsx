import Link from 'next/link';
import { ArrowRight, Orbit, Sparkles, Stars } from 'lucide-react';

export default function GoldenEggHaraniagharba() {
  return (
    <section className="relative px-4 py-12 md:py-16">
      <div className="zion-container">
        <div className="relative overflow-hidden rounded-[32px] border border-amber-300/20 bg-[radial-gradient(circle_at_top,rgba(255,214,102,0.18),rgba(18,12,6,0.94)_55%,rgba(4,4,8,0.98)_100%)] p-6 md:p-8 shadow-[0_24px_120px_rgba(0,0,0,0.45)]">
          <div className="absolute right-[-40px] top-[-60px] h-44 w-44 rounded-full bg-amber-300/15 blur-3xl" />
          <div className="absolute left-[-20px] bottom-[-80px] h-52 w-52 rounded-full bg-zion-purple/10 blur-3xl" />

          <div className="relative grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="flex justify-center lg:justify-start">
              <div className="relative flex h-48 w-48 items-center justify-center rounded-full border border-amber-200/30 bg-[radial-gradient(circle_at_35%_30%,rgba(255,248,203,0.95),rgba(255,205,84,0.8)_32%,rgba(153,82,11,0.72)_72%,rgba(22,10,4,0.95)_100%)] shadow-[0_0_60px_rgba(251,191,36,0.35)] md:h-56 md:w-56">
                <div className="absolute inset-4 rounded-full border border-white/10" />
                <div className="absolute inset-10 rounded-full border border-amber-100/25" />
                <Sparkles className="h-8 w-8 text-amber-50" />
              </div>
            </div>

            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-200/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-amber-200">
                <Orbit className="h-4 w-4" />
                Hiranyagarbha · Golden Egg
              </div>

              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-amber-100/60">L4 signal, grounded in L1</p>
                <h2 className="mt-3 text-3xl font-semibold text-white md:text-5xl">
                  Golden Egg se vrací na homepage,
                  <span className="block bg-linear-to-r from-amber-200 via-zion-gold to-orange-300 bg-clip-text text-transparent">
                    ale bez vizuálního balastu.
                  </span>
                </h2>
              </div>

              <p className="max-w-2xl text-base leading-relaxed text-gray-300 md:text-lg">
                Hiranyagarbha zůstává součástí vize L4 Oasis, ale web teď stojí na tom, co je reálně živé:
                2.9.8 Deeksha code freeze, 3-node mesh a provozní telemetrie. Interaktivní Tree of Life je pod tímto blokem
                načítaný až na vyžádání, aby homepage přestala drhnout.
              </p>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-500">L1</p>
                  <p className="mt-2 text-lg font-semibold text-white">Deeksha live</p>
                  <p className="text-sm text-gray-400">Patch & Code Freeze</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-500">L4</p>
                  <p className="mt-2 text-lg font-semibold text-white">Golden Egg</p>
                  <p className="text-sm text-gray-400">Oasis roadmap signal</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-500">UX</p>
                  <p className="mt-2 text-lg font-semibold text-white">On-demand scene</p>
                  <p className="text-sm text-gray-400">No forced heavy render</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="#tree-of-life"
                  className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-amber-300 via-zion-gold to-orange-400 px-6 py-3 text-sm font-semibold text-black"
                >
                  <Stars className="h-4 w-4" />
                  Otevřít Tree of Life
                </Link>
                <Link
                  href="/roadmap"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:border-white/30"
                >
                  L4 roadmap
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
