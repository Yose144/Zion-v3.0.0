'use client';

import { useLang } from '@/lib/i18n';

const linkBase =
  'text-sm text-zion-gold/70 transition-all duration-200 inline-block';

function FooterColumn({
  title,
  barClass,
  hoverClass,
  links,
}: {
  title: string;
  barClass: string;
  hoverClass: string;
  links: { href: string; label: string; external?: boolean }[];
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className={`h-4 w-1 rounded-full bg-gradient-to-b ${barClass}`} />
        <p className="text-xs uppercase tracking-[0.25em] font-semibold text-zion-gold">
          {title}
        </p>
      </div>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <a
              className={`${linkBase} ${hoverClass} hover:pl-1`}
              href={l.href}
              {...(l.external ? { target: '_blank', rel: 'noreferrer' } : {})}
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  const { t } = useLang();
  return (
    <footer className="relative overflow-hidden mt-20 border-t border-white/10 bg-[rgba(13,13,13,0.88)] backdrop-blur-xl">
      {/* gradient top line — same as the app footer */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-zion-purple via-zion-gold to-zion-cyan" />
      {/* ambient glows */}
      <div className="pointer-events-none absolute -left-32 top-0 h-72 w-72 rounded-full bg-zion-purple/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-72 w-72 rounded-full bg-zion-cyan/10 blur-3xl" />

      <div className="zion-container py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* brand block */}
          <div className="sm:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/zion-symbol.png"
                alt="ZION TerraNova"
                width={48}
                height={48}
                loading="lazy"
                decoding="async"
                className="w-12 h-12 rounded-xl object-contain border border-white/10 rasta-footer-logo"
              />
              <h3 className="text-2xl font-extrabold gradient-text tracking-tight">
                ZION Pool
              </h3>
            </div>
            <p className="text-sm text-zion-gold/70 leading-relaxed max-w-sm font-medium">
              {t(
                'Jeden pool, dvanáct coinů, jednotné ZION výplaty. Nativní Rust těžba.',
                'One pool, twelve coins, unified ZION payouts. Native Rust mining.',
              )}
            </p>
            <div className="h-1 w-16 rounded-full bg-gradient-to-r from-zion-purple via-zion-gold to-zion-cyan" />
          </div>

          <FooterColumn
            title="Pool"
            barClass="from-zion-purple to-transparent"
            hoverClass="hover:text-zion-purple"
            links={[
              { href: '/start/', label: t('Začít těžit', 'Start mining') },
              { href: '/stats/', label: t('Statistiky', 'Stats') },
              { href: '/blocks/', label: t('Bloky', 'Blocks') },
              { href: '/payouts/', label: t('Výplaty', 'Payouts') },
              { href: '/miner/', label: t('Hledat minera', 'Miner lookup') },
              { href: '/faq/', label: 'FAQ' },
              { href: '/legal/', label: t('Právní info', 'Legal') },
              { href: '/gdpr/', label: 'GDPR' },
            ]}
          />

          <FooterColumn
            title={t('Ekosystém', 'Ecosystem')}
            barClass="from-zion-gold to-transparent"
            hoverClass="hover:text-zion-gold"
            links={[
              { href: 'https://zionterranova.com', label: 'zionterranova.com', external: true },
              { href: 'https://app.zionterranova.com', label: t('App · Hub', 'App · Hub'), external: true },
              { href: 'https://market.zionterranova.com', label: 'L2 Multichain Market', external: true },
              { href: 'https://app.zionterranova.com/explorer', label: 'Explorer', external: true },
              { href: 'https://oasis.zionterranova.com', label: 'L4 Oasis', external: true },
              { href: 'https://freeworld.zionterranova.com', label: 'L5 Free World', external: true },
              { href: 'https://app.zionterranova.com/download', label: t('Stáhnout miner', 'Download miner'), external: true },
            ]}
          />

          <FooterColumn
            title="Info"
            barClass="from-zion-cyan to-transparent"
            hoverClass="hover:text-zion-cyan"
            links={[
              { href: 'https://app.zionterranova.com/docs', label: t('Dokumentace', 'Docs'), external: true },
              { href: 'https://app.zionterranova.com/api-reference', label: 'API', external: true },
              { href: 'https://app.zionterranova.com/roadmap', label: t('Plán', 'Roadmap'), external: true },
              { href: 'https://app.zionterranova.com/mining', label: t('Těžba & Nód', 'Mining & Node'), external: true },
              { href: 'https://app.zionterranova.com/network', label: t('Síť', 'Network'), external: true },
            ]}
          />
        </div>

        <hr className="mt-10 border-0 h-px bg-white/10" />

        <div className="pt-6">
          <p className="text-[11px] leading-relaxed text-zion-gold/55 max-w-3xl">
            {t(
              'ZION je experimentální open-source protokol. Nejde o investiční produkt a neposkytuje žádné záruky. Používáš jej na vlastní riziko. Tokeny ZION vznikají těžbou pomocí Proof of Work, nejsou prodávány žádným emitentem. Nic na tomto webu nepředstavuje finanční, investiční ani právní poradenství. Úplné podmínky najdeš v',
              'ZION is an experimental open-source protocol. It is not an investment product and provides no guarantees — use it at your own risk. ZION tokens are created through Proof-of-Work mining and are not sold by any issuer. Nothing on this site constitutes financial, investment or legal advice. Full terms are in the',
            )}{' '}
            <a
              className="text-zion-gold/70 hover:text-zion-gold underline underline-offset-2 transition-colors"
              href="/legal/"
            >
              {t('Právní upozornění', 'Legal notice')}
            </a>
            .
          </p>
        </div>

        <div className="mt-4 pt-4 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zion-gold/55">
            © 2026 <span className="text-zion-gold">ZION Pool</span> ·{' '}
            <span className="text-zion-purple">v3.2.0 &quot;One Love&quot;</span> ·{' '}
            {t(
              'fee 1 % · PPLNS · výplaty v nativním coinu',
              '1% fee · PPLNS · native-coin payouts',
            )}
          </p>
          <span className="text-xs text-zion-gold/60">
            {t('Mainnet Beta aktivní', 'Mainnet Beta live')}
          </span>
        </div>
      </div>
    </footer>
  );
}
