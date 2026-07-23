'use client';

import { Store, Cpu, Database, Server, Clock } from 'lucide-react';

const MarketplacePlaceholderCopy = {
  comingSoon: { cs: `Připravujeme`, en: `Coming Soon` },
  decentralizedMarketplaceForAiM: { cs: `Decentralizovaný marketplace pro AI modely, data a compute — poháněný ZION blockchainem.`, en: `Decentralized marketplace for AI models, data & compute — powered by ZION blockchain.` },
  launchQ32026: { cs: `Spuštění: Q3 2026`, en: `Launch: Q3 2026` },
};

const MARKETPLACE_ITEMS = [
  {
    icon: Cpu,
    titleCs: 'AI Modely',
    titleEn: 'AI Models',
    descCs: 'Fine-tuned modely pro blockchain, mining a analýzu',
    descEn: 'Fine-tuned models for blockchain, mining & analysis',
    color: 'zion-purple',
  },
  {
    icon: Database,
    titleCs: 'Trénovací Data',
    titleEn: 'Training Data',
    descCs: 'Kurátorské datasety pro ZION ekosystém',
    descEn: 'Curated datasets for the ZION ecosystem',
    color: 'zion-cyan',
  },
  {
    icon: Server,
    titleCs: 'GPU Compute',
    titleEn: 'GPU Compute',
    descCs: 'Pronájem výpočetního výkonu pro trénink a inferenci',
    descEn: 'Rent compute power for training & inference',
    color: 'zion-gold',
  },
];

export default function MarketplacePlaceholder({ lang = 'cs' }: { lang?: 'cs' | 'en' }) {
  return (
    <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-8 border border-zion-gold/30">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zion-gold/10 border border-zion-gold/30 mb-4">
          <Store className="w-4 h-4 text-zion-gold" />
          <span className="text-sm font-medium text-zion-gold">
            {MarketplacePlaceholderCopy.comingSoon[lang === 'cs' ? 'cs' : 'en']}
          </span>
        </div>
        <h2 className="text-3xl font-bold bg-gradient-to-r from-zion-gold via-zion-purple to-zion-cyan bg-clip-text text-transparent mb-3">
          AI Native Marketplace
        </h2>
        <p className="text-gray-400 max-w-xl mx-auto">
          {MarketplacePlaceholderCopy.decentralizedMarketplaceForAiM[lang === 'cs' ? 'cs' : 'en']}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {MARKETPLACE_ITEMS.map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={i}
              className={`rounded-xl p-6 border border-${item.color}/20 bg-${item.color}/5 hover:border-${item.color}/40 transition-all text-center`}
            >
              <div className={`w-12 h-12 rounded-xl bg-${item.color}/20 flex items-center justify-center mx-auto mb-4`}>
                <Icon className={`w-6 h-6 text-${item.color}`} />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {lang === 'cs' ? item.titleCs : item.titleEn}
              </h3>
              <p className="text-sm text-gray-400">
                {lang === 'cs' ? item.descCs : item.descEn}
              </p>
            </div>
          );
        })}
      </div>

      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/10 bg-white/5 text-gray-400 text-sm">
          <Clock className="w-4 h-4" />
          {MarketplacePlaceholderCopy.launchQ32026[lang === 'cs' ? 'cs' : 'en']}
        </div>
      </div>
    </div>
  );
}
