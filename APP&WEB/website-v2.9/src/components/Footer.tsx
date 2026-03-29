'use client';

import Link from 'next/link';
import { Github, MessageCircle, Globe, BookOpen, Compass, Map, Download, Pickaxe, FileText, Orbit, ArrowLeftRight } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';
import { SITE_RELEASE_LABEL, SITE_RUNTIME_VERSION } from '@/lib/site';

const footerGroups = [
  {
    title: 'Protocol',
    links: [
      { href: '/roadmap', label: 'Roadmap', Icon: Map },
      { href: '/download', label: 'Download', Icon: Download },
      { href: '/mining', label: 'Mining', Icon: Pickaxe },
      { href: '/network', label: 'Network', Icon: Globe },
    ],
  },
  {
    title: 'Explore',
    links: [
      { href: '/explorer', label: 'Explorer', Icon: Compass },
      { href: '/dashboard', label: 'Dashboard', Icon: Orbit },
      { href: '/pool', label: 'Pool', Icon: Pickaxe },
      { href: '/bridge', label: 'Bridge', Icon: ArrowLeftRight },
    ],
  },
  {
    title: 'Knowledge',
    links: [
      { href: '/docs', label: 'Docs', Icon: BookOpen },
      { href: '/api-reference', label: 'API Reference', Icon: FileText },
      { href: '/download', label: 'Downloads', Icon: Download },
    ],
  },
];

const socialLinks = [
  { href: 'https://github.com/Zion-TerraNova', label: 'GitHub', Icon: Github },
  { href: 'https://discord.gg/zion-terranova', label: 'Discord', Icon: MessageCircle },
];

export default function Footer() {
  const { lang } = useLang();
  return (
    <footer className="border-t border-white/10 bg-black/60 backdrop-blur-xl mt-20">
      <div className="zion-container py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand column */}
          <div className="md:col-span-2 space-y-4">
            <h3 className="text-xl font-bold text-gradient">ZION TerraNova</h3>
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
                  className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-white/10 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-colors"
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
                {group.links.map(({ href, label, Icon }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group"
                    >
                      <Icon className="w-3.5 h-3.5 text-gray-600 group-hover:text-zion-gold transition-colors" />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div className="mt-10 pt-6 border-t border-white/5">
          <p className="text-[11px] leading-relaxed text-gray-600 max-w-3xl">
            ZION is an experimental open-source protocol. Not an investment. No guarantees. 
            Use at your own risk. ZION tokens are mined through Proof-of-Work, not sold by any issuer. 
            Nothing published here constitutes financial, investment, or legal advice. 
            See{' '}
            <Link href="/legal" className="text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors">
              Legal Disclaimer
            </Link>{' '}
            for full terms.
          </p>
        </div>

        {/* Bottom bar */}
        <div className="mt-4 pt-4 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">
            © 2026 ZION Blockchain · {SITE_RELEASE_LABEL} · runtime {SITE_RUNTIME_VERSION}
          </p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-gray-500">Testnet Online</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
