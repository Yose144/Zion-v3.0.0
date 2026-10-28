'use client';

import { useLang } from '@/lib/i18n';

export default function Footer() {
  const { t } = useLang();
  return (
    <footer className="rasta-footer relative mt-20 py-10">
      <div className="section-line absolute inset-x-0 top-0" />
      <div className="zion-container flex flex-col items-center text-center">
        <a href="/" className="opacity-90 transition-opacity duration-300 hover:opacity-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/zion-symbol.png"
            alt="ZION Pool"
            className="rasta-footer-logo mx-auto h-16 w-16"
          />
        </a>
        <p className="mt-3 text-sm font-bold text-white">
          ZION <span className="gradient-text">Pool</span>
        </p>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-white/40">
          {t(
            'Jeden pool, dvanáct coinů, jednotné ZION výplaty.',
            'One pool, twelve coins, unified ZION payouts.',
          )}
        </p>

        {/* internal nav */}
        <nav className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-gray-500">
          <a href="/start/" className="transition-colors hover:text-rasta-gold">
            {t('Začít těžit', 'Start mining')}
          </a>
          <a href="/stats/" className="transition-colors hover:text-rasta-gold">
            {t('Statistiky', 'Stats')}
          </a>
          <a href="/blocks/" className="transition-colors hover:text-rasta-gold">
            {t('Bloky', 'Blocks')}
          </a>
          <a href="/payouts/" className="transition-colors hover:text-rasta-gold">
            {t('Výplaty', 'Payouts')}
          </a>
          <a href="/faq/" className="transition-colors hover:text-rasta-gold">FAQ</a>
          <a href="/legal/" className="transition-colors hover:text-rasta-gold">
            {t('Právní info', 'Legal')}
          </a>
          <a href="/gdpr/" className="transition-colors hover:text-rasta-gold">GDPR</a>
        </nav>

        {/* ecosystem */}
        <nav className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-gray-600">
          <a href="https://zionterranova.com" className="transition-colors hover:text-rasta-gold">zionterranova.com</a>
          <a href="https://app.zionterranova.com" className="transition-colors hover:text-rasta-gold">app</a>
          <a href="https://market.zionterranova.com" className="transition-colors hover:text-rasta-gold">market</a>
          <a href="https://oasis.zionterranova.com" className="transition-colors hover:text-rasta-gold">oasis</a>
          <a href="https://freeworld.zionterranova.com" className="transition-colors hover:text-rasta-gold">freeworld</a>
          <a href="https://app.zionterranova.com/download" className="transition-colors hover:text-rasta-gold">
            {t('stáhnout miner', 'download miner')}
          </a>
        </nav>

        <p className="mt-6 text-[0.7rem] text-gray-600">
          {t(
            'Fee 1 % · PPLNS · výplaty v nativním coinu · open-source MIT',
            '1% fee · PPLNS · native-coin payouts · open-source MIT',
          )}
        </p>
        <p className="mt-2 text-xs text-gray-600">© 2026 Omnity.One s.r.o. · ZION Pool</p>
        <p className="mt-2 text-[0.65rem] text-gray-700">
          <a href="https://app.zionterranova.com/roadmap" className="transition-colors hover:text-rasta-gold">
            ZION v3.2 · Mainnet Beta
          </a>
        </p>
      </div>
    </footer>
  );
}
