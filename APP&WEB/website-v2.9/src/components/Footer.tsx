'use client';

import Link from 'next/link';
import { useLang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';
import { SITE_RELEASE_LABEL, SITE_RUNTIME_VERSION } from '@/lib/site';

export default function Footer() {
  const { lang } = useLang();
  const footerGroups = [
    {
      title: tr('footer', 'group_info', lang),
      accent: 'text-zion-purple',
      hover: 'hover:text-zion-purple',
      bar: 'from-zion-purple',
      links: [
        { href: '/', label: tr('nav', 'home', lang) },
        { href: '/news', label: tr('nav', 'news', lang) },
        { href: '/network', label: tr('nav', 'network', lang) },
        { href: '/explorer', label: tr('nav', 'explorer', lang) },
        { href: '/dashboard', label: tr('nav', 'dashboard', lang) },
        { href: '/pool', label: tr('nav', 'pool', lang) },
        { href: '/mining', label: tr('nav', 'mining', lang) },
        { href: '/benchmarks', label: tr('nav', 'benchmarks', lang) },
        { href: '/miner-stats', label: tr('nav', 'miner_stats', lang) },
        { href: '/download', label: tr('nav', 'download', lang) },
        { href: '/roadmap', label: tr('nav', 'roadmap', lang) },
        { href: '/api-reference', label: tr('nav', 'api', lang) },
      ],
    },
    {
      title: tr('footer', 'group_layers', lang),
      accent: 'text-zion-gold',
      hover: 'hover:text-zion-gold',
      bar: 'from-zion-gold',
      links: [
        { href: '/defi', label: `L2 ${tr('nav', 'defi', lang)}` },
        { href: '/cex', label: tr('nav', 'cex_listings', lang) },
        { href: '/wallet', label: tr('nav', 'wallet', lang) },
        { href: '/dao', label: tr('nav', 'dao', lang) },
        { href: '/bridge', label: tr('nav', 'bridge', lang) },
        { href: '/l3-hiran', label: tr('nav', 'l3_hiran', lang) },
        { href: '/warp', label: tr('nav', 'warp', lang) },
        { href: '/ai-native', label: tr('nav', 'ai_native', lang) },
        { href: '/l4-oasis', label: tr('nav', 'l4_oasis', lang) },
        { href: '/l5-free-world', label: tr('nav', 'l5_free_world', lang) },
        { href: '/l6-issobella', label: tr('nav', 'l6_issobella', lang) },
      ],
    },
    {
      title: tr('footer', 'group_wiki', lang),
      accent: 'text-zion-gold',
      hover: 'hover:text-white',
      bar: 'from-zion-gold',
      links: [
        { href: '/wiki', label: tr('nav', 'wiki_group', lang) },
        { href: '/terranova', label: tr('nav', 'terranova', lang) },
        { href: '/tree-of-life', label: tr('nav', 'tree_of_life', lang) },
        { href: '/genesis', label: tr('nav', 'genesis', lang) },
        { href: '/docs', label: tr('nav', 'docs', lang) },
      ],
    },
  ];

  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-[rgba(13,13,13,0.88)] backdrop-blur-xl">
      {/* Top rasta tri-color accent line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-linear-to-r from-zion-purple via-zion-gold to-zion-cyan" />
      <div className="pointer-events-none absolute -left-32 top-0 h-72 w-72 rounded-full bg-zion-purple/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-72 w-72 rounded-full bg-zion-cyan/10 blur-3xl" />
      <div className="zion-container py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand column */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <img
                src="/symbol-200x200.png"
                alt="ZION TerraNova"
                width={48}
                height={48}
                className="w-12 h-12 rounded-xl object-contain border border-white/10"
              />
              <h3 className="text-2xl font-extrabold text-gradient tracking-tight">ZION TerraNova</h3>
            </div>
            <p className="text-sm text-zion-gold/70 leading-relaxed max-w-sm font-medium">
              {tr('footer', 'tagline', lang)}
            </p>
            <div className="h-1 w-16 rounded-full bg-linear-to-r from-zion-purple via-zion-gold to-zion-cyan" />
          </div>

          {/* Link columns */}
          {footerGroups.map((group) => (
            <div key={group.title}>
              <div className="flex items-center gap-2 mb-4">
                <div className={`h-4 w-1 rounded-full bg-linear-to-b ${group.bar} to-transparent`} />
                <p className={`text-xs uppercase tracking-[0.25em] font-semibold ${group.accent}`}>{group.title}</p>
              </div>
              <ul className="space-y-2.5">
                {group.links.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className={`text-sm text-zion-gold/70 ${group.hover} hover:pl-1 transition-all duration-200 inline-block`}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <hr className="zion-divider mt-10" />

        <div className="pt-6">
          <p className="text-[11px] leading-relaxed text-zion-gold/55 max-w-3xl">
            {tr('footer', 'disclaimer', lang)}
            {' '}{tr('footer', 'legal_suffix', lang)}{' '}
            <Link href="/docs#legal" className="text-zion-gold/70 hover:text-zion-gold underline underline-offset-2 transition-colors">
              {tr('footer', 'legal_disclaimer', lang)}
            </Link>{' '}
            {tr('footer', 'legal_suffix_tail', lang)}
          </p>
        </div>

        {/* Bottom bar */}
        <div className="mt-4 pt-4 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zion-gold/55">
            © 2026 <span className="text-zion-gold">ZION Blockchain</span> · <span className="text-zion-purple">{SITE_RELEASE_LABEL}</span> · runtime <span className="text-zion-gold">{SITE_RUNTIME_VERSION}</span>
          </p>
          <span className="text-xs text-zion-gold/60">{tr('footer', 'test_mainnet_active', lang)}</span>
        </div>
      </div>
    </footer>
  );
}
