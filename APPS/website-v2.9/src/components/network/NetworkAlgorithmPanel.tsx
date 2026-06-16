'use client';

import { useState } from 'react';
import { Cpu, Flame, Snowflake, Info, ChevronDown } from 'lucide-react';

interface AlgorithmInfo {
  id: string;
  name: string;
  nameCs: string;
  icon: React.ReactNode;
  scratchpad: string;
  aesRounds: string;
  thermal: string;
  desc: string;
  descCs: string;
  seasonal?: boolean;
  active?: boolean;
}

export default function NetworkAlgorithmPanel({ cs }: { cs: boolean }) {
  const [open, setOpen] = useState(false);

  const algorithms: AlgorithmInfo[] = [
    {
      id: 'deeksha_lite_v1',
      name: 'Deeksha Lite v1',
      nameCs: 'Deeksha Lite v1',
      icon: <Snowflake className="h-5 w-5 text-cyan-400" />,
      scratchpad: '2 MiB',
      aesRounds: '3 + 3',
      thermal: 'Low',
      desc: 'Default CPU-optimized algorithm with minimal thermal footprint. Ideal for sustained desktop and server mining.',
      descCs: 'Výchozí algoritmus optimalizovaný pro CPU s minimální tepelnou stopou. Ideální pro trvalé desktopové a serverové těžení.',
      active: true,
    },
    {
      id: 'deeksha_lite_fire',
      name: 'Deeksha Lite Fire',
      nameCs: 'Deeksha Lite Fire',
      icon: <Flame className="h-5 w-5 text-orange-400" />,
      scratchpad: '512 KiB',
      aesRounds: '4 + 4',
      thermal: 'High',
      desc: 'Thermal-intensive variant for GPU and high-performance rigs. Higher power draw, maximum hashrate.',
      descCs: 'Termicky intenzivní varianta pro GPU a výkonné stroje. Vyšší spotřeba, maximální hashrate.',
      seasonal: true,
    },
    {
      id: 'cosmic_harmony_ekam',
      name: 'Cosmic Harmony Ekam',
      nameCs: 'Cosmic Harmony Ekam',
      icon: <Cpu className="h-5 w-5 text-purple-400" />,
      scratchpad: '4 MiB',
      aesRounds: '5 + 5',
      thermal: 'Medium',
      desc: 'Advanced variant with larger scratchpad and additional AES rounds. Balanced between CPU and GPU performance.',
      descCs: 'Pokročilá varianta s větším scratchpadem a dodatečnými AES koly. Vyvážená mezi CPU a GPU výkonem.',
      seasonal: true,
    },
  ];

  return (
    <section className="rounded-4xl border border-white/10 bg-black/40 p-8">
      <div className="flex flex-col gap-2 mb-6">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Algoritmus' : 'Algorithm'}</p>
        <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
          <Cpu className="h-7 w-7 text-zion-cyan" />
          {cs ? 'Aktivní PoW algoritmus' : 'Active PoW Algorithm'}
        </h2>
        <p className="text-sm text-gray-400">
          {cs
            ? 'ZION používá rodinu Cosmic Harmony algoritmů s dynamickým přepínáním podle sezóny a hardwaru.'
            : 'ZION uses the Cosmic Harmony algorithm family with dynamic switching based on season and hardware.'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {algorithms.map((algo) => (
          <div
            key={algo.id}
            className={`rounded-3xl border p-6 transition-all ${
              algo.active
                ? 'border-emerald-400/30 bg-emerald-500/5'
                : 'border-white/10 bg-white/5 hover:border-white/20'
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-black/40 border border-white/10">
                {algo.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{cs ? algo.nameCs : algo.name}</p>
                {algo.active && (
                  <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">
                    {cs ? 'Aktivní' : 'Active'}
                  </span>
                )}
                {algo.seasonal && !algo.active && (
                  <span className="text-[10px] uppercase tracking-wider text-gray-500">
                    {cs ? 'Sezónní' : 'Seasonal'}
                  </span>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-4">{cs ? algo.descCs : algo.desc}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-center">
                <p className="text-gray-500 mb-0.5">{cs ? 'Scratchpad' : 'Scratchpad'}</p>
                <p className="text-white font-mono">{algo.scratchpad}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-center">
                <p className="text-gray-500 mb-0.5">AES</p>
                <p className="text-white font-mono">{algo.aesRounds}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-center">
                <p className="text-gray-500 mb-0.5">{cs ? 'Teplo' : 'Thermal'}</p>
                <p className={`font-mono ${algo.thermal === 'High' ? 'text-orange-400' : algo.thermal === 'Low' ? 'text-cyan-400' : 'text-yellow-400'}`}>
                  {algo.thermal}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition w-full"
        >
          <Info className="h-4 w-4 text-zion-gold" />
          <span className="flex-1 text-left">
            {cs ? 'Jak funguje sezónní přepínání algoritmů?' : 'How does seasonal algorithm switching work?'}
          </span>
          <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="mt-3 text-sm text-gray-400 leading-relaxed border-t border-white/10 pt-3">
            {cs ? (
              <>
                <p className="mb-2">
                  <strong className="text-white">Deeksha Lite v1</strong> je výchozí algoritmus celoročně — optimalizovaný pro CPU s nízkým odběrem.{' '}
                  <strong className="text-white">Deeksha Lite Fire</strong> se aktivuje v zimních měsících nebo na vyhrazených GPU rigů pro maximální výkon.{' '}
                  <strong className="text-white">Ekam</strong> je pokročilá varianta s větším scratchpadem pro vyvážené těžení.
                </p>
                <p>
                  Miner si vybere algoritmus přes <code className="text-zion-gold font-mono text-xs">ZION_MINER_ALGORITHM</code> a ohlásí ho poolu v Hello zprávě. Pool pak validuje share pomocí daného algoritmu.
                </p>
              </>
            ) : (
              <>
                <p className="mb-2">
                  <strong className="text-white">Deeksha Lite v1</strong> is the default year-round algorithm — CPU-optimized with low power draw.{' '}
                  <strong className="text-white">Deeksha Lite Fire</strong> activates in winter months or on dedicated GPU rigs for maximum performance.{' '}
                  <strong className="text-white">Ekam</strong> is the advanced variant with a larger scratchpad for balanced mining.
                </p>
                <p>
                  The miner selects the algorithm via <code className="text-zion-gold font-mono text-xs">ZION_MINER_ALGORITHM</code> and advertises it to the pool in the Hello message. The pool then validates shares using that algorithm.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
