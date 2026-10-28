'use client';

import { useLang } from '@/lib/i18n';

export default function Footer() {
  const { t } = useLang();
  return (
    <footer className="relative mt-20 border-t border-white/8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-px h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(228,30,43,.6), rgba(252,209,22,.6), rgba(7,137,48,.6), transparent)',
        }}
      />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <p className="mb-2 text-sm font-bold text-white">
            ZION <span className="gradient-text">Pool</span>
          </p>
          <p className="text-xs leading-relaxed text-white/40">
            {t(
              'Jeden pool, dvanáct coinů, jednotné ZION výplaty. Součást ZION TerraNova ekosystému.',
              'One pool, twelve coins, unified ZION payouts. Part of the ZION TerraNova ecosystem.',
            )}
          </p>
        </div>
        <div>
          <p className="kicker mb-3">{t('Ekosystém', 'Ecosystem')}</p>
          <div className="flex flex-col gap-1.5 text-xs text-white/55">
            <a href="https://zionterranova.com" className="hover:text-rasta-gold transition-colors">zionterranova.com</a>
            <a href="https://app.zionterranova.com" className="hover:text-rasta-gold transition-colors">app.zionterranova.com</a>
            <a href="https://market.zionterranova.com" className="hover:text-rasta-gold transition-colors">market.zionterranova.com</a>
            <a href="https://oasis.zionterranova.com" className="hover:text-rasta-gold transition-colors">oasis.zionterranova.com</a>
            <a href="https://freeworld.zionterranova.com" className="hover:text-rasta-gold transition-colors">freeworld.zionterranova.com</a>
            <a href="https://app.zionterranova.com/download" className="hover:text-rasta-gold transition-colors">
              {t('Stáhnout miner', 'Download miner')}
            </a>
          </div>
        </div>
        <div>
          <p className="kicker mb-3">{t('Transparentnost', 'Transparency')}</p>
          <div className="flex flex-col gap-1.5 text-xs text-white/55">
            <span>{t('Fee 1 % · 5 % humanitarian · 5 % issobella', 'Fee 1% · 5% humanitarian · 5% issobella')}</span>
            <span>{t('Výplaty v nativním coinu · PPLNS', 'Native-coin payouts · PPLNS')}</span>
            <span>{t('Open-source stack · MIT', 'Open-source stack · MIT')}</span>
          </div>
        </div>
        <div>
          <p className="kicker mb-3">{t('Právní', 'Legal')}</p>
          <div className="flex flex-col gap-1.5 text-xs text-white/55">
            <a href="/legal/" className="hover:text-white">
              {t('Právní informace', 'Legal information')}
            </a>
            <a href="/terms/" className="hover:text-white">
              {t('Podmínky používání', 'Terms of use')}
            </a>
            <a href="/gdpr/" className="hover:text-white">
              {t('Ochrana osobních údajů (GDPR)', 'Privacy (GDPR)')}
            </a>
            <span className="mt-1 text-white/35">Omnity.One s.r.o.</span>
          </div>
        </div>
      </div>
      <div className="border-t border-white/5 px-4 py-4 text-center text-[0.68rem] text-white/30">
        © 2026 ZION TerraNova · pool.zionterranova.com ·{' '}
        <a href="https://app.zionterranova.com/roadmap" className="hover:text-white/60">
          ZION v3.2 · Mainnet Beta
        </a>
      </div>
    </footer>
  );
}
