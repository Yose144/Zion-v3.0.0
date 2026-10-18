'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Gem, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useLang } from '@/lib/i18n';

const LINKS = [
  { href: '/', cs: 'Přehled', en: 'Overview' },
  { href: '/start/', cs: 'Jak těžit', en: 'Start mining' },
  { href: '/blocks/', cs: 'Bloky', en: 'Blocks' },
  { href: '/payouts/', cs: 'Výplaty', en: 'Payouts' },
  { href: '/stats/', cs: 'Statistiky', en: 'Stats' },
  { href: '/faq/', cs: 'FAQ', en: 'FAQ' },
];

export default function Nav() {
  const pathname = usePathname();
  const { lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);

  return (
    <header className="pool-nav sticky top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-zion-gold to-zion-purple">
            <Gem className="h-4.5 w-4.5 text-black" size={18} strokeWidth={2.4} />
          </span>
          <span className="text-[0.95rem] font-bold tracking-tight text-white">
            ZION <span className="gradient-text">Pool</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`nav-link ${pathname === l.href ? 'nav-link-active' : ''}`}
            >
              {lang === 'cs' ? l.cs : l.en}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-white/15 text-[0.72rem] font-bold">
            {(['cs', 'en'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-2.5 py-1.5 uppercase transition-colors ${
                  lang === l
                    ? 'bg-zion-gold text-black'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <button
            className="p-2 text-white/70 md:hidden"
            onClick={() => setOpen(!open)}
            aria-label="menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-white/10 px-4 py-3 md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`nav-link mb-1 block ${pathname === l.href ? 'nav-link-active' : ''}`}
            >
              {lang === 'cs' ? l.cs : l.en}
            </Link>
          ))}
        </nav>
      )}
      <span className="hidden">{t('', '')}</span>
    </header>
  );
}
