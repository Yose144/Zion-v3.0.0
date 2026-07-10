'use client';

import Link from 'next/link';
import { Github, MessageCircle } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';
import { SITE_RELEASE_LABEL, SITE_RUNTIME_VERSION } from '@/lib/site';

const socialLinks = [
  { href: 'https://github.com/Zion-TerraNova', label: 'GitHub', Icon: Github },
  { href: 'https://discord.gg/zion-terranova', label: 'Discord', Icon: MessageCircle },
];

export default function Footer() {
  const { lang } = useLang();
  const footerGroups = [
    {
      title: tr('footer', 'group_info', lang),
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
    <footer className="relative overflow-hidden border-t border-white/10 bg-[rgba(2,4,12,0.82)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-zion-gold/50 to-transparent" />
      <div className="pointer-events-none absolute -left-32 top-0 h-72 w-72 rounded-full bg-zion-purple/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-72 w-72 rounded-full bg-zion-cyan/10 blur-3xl" />
      <div className="zion-container py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand column */}
          <div className="md:col-span-2 space-y-4">
            <h3 className="text-xl font-bold text-gradient-soft">ZION TerraNova</h3>
            <p className="text-sm text-gray-400 leading-relaxed max-w-sm">
              {tr('footer', 'tagline', lang)}
            </p>
            <div className="flex items-center gap-3 pt-2">
              {socialLinks.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-white/10 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all hover:-translate-y-0.5"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {footerGroups.map((group) => (
            <div key={group.title}>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-4">{group.title}</p>
              <ul className="space-y-2.5">
                {group.links.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-600 group-hover:bg-zion-gold transition-colors" />
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
          <p className="text-[11px] leading-relaxed text-gray-600 max-w-3xl">
            {tr('footer', 'disclaimer', lang)}
            {' '}{tr('footer', 'legal_suffix', lang)}{' '}
            <Link href="/docs#legal" className="text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors">
              {tr('footer', 'legal_disclaimer', lang)}
            </Link>{' '}
            {tr('footer', 'legal_suffix_tail', lang)}
          </p>
        </div>

        {/* Bottom bar */}
        <div className="mt-4 pt-4 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">
            © 2026 ZION Blockchain · {SITE_RELEASE_LABEL} · runtime {SITE_RUNTIME_VERSION}
          </p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-gray-500">{tr('footer', 'test_mainnet_active', lang)}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
