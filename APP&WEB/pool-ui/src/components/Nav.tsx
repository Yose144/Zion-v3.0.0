'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/i18n';
import AuthButton from '@/components/AuthButton';

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

  useEffect(() => {
    document.body.classList.toggle('rasta-menu-open', open);
    return () => document.body.classList.remove('rasta-menu-open');
  }, [open]);

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href));

  return (
    <>
      <nav className="rasta-nav">
        <div className="rasta-nav-pill">
          <Link
            href="/"
            className="rasta-nav-logo-link"
            onClick={() => setOpen(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/zion-symbol.png"
              alt="ZION"
              width={38}
              height={38}
              className="rasta-nav-logo-img"
            />
            <div className="rasta-nav-logo-text">
              <span className="rasta-nav-brand">ZION Pool</span>
              <span className="rasta-nav-kicker">
                {t('TerraNova ekosystém', 'TerraNova ecosystem')}
              </span>
            </div>
          </Link>

          <div className="rasta-nav-menu rasta-desktop-menu">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rasta-nav-link ${isActive(l.href) ? 'active' : ''}`}
              >
                {lang === 'cs' ? l.cs : l.en}
              </Link>
            ))}
          </div>

          <div className="rasta-nav-right">
            <div className="rasta-nav-actions">
              <div className="flex overflow-hidden rounded-full border border-white/15 text-[0.68rem] font-bold">
                {(['cs', 'en'] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`px-2.5 py-1.5 uppercase transition-colors ${
                      lang === l
                        ? 'bg-rasta-gold text-black'
                        : 'text-white/50 hover:text-white'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <AuthButton />
            </div>
            <button
              className="rasta-hamburger"
              onClick={() => setOpen(!open)}
              aria-label="menu"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile slide-in menu */}
      <div className={`rasta-mobile-menu ${open ? 'open' : ''}`}>
        <div className="rasta-mobile-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/zion-symbol.png"
            alt="ZION"
            width={34}
            height={34}
            className="rasta-nav-logo-img"
          />
          <span className="rasta-nav-brand">ZION Pool</span>
        </div>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            onClick={() => setOpen(false)}
            className={`rasta-nav-link ${isActive(l.href) ? 'active' : ''}`}
          >
            {lang === 'cs' ? l.cs : l.en}
          </Link>
        ))}
        <div className="rasta-mobile-actions">
          <AuthButton />
          <div className="flex overflow-hidden rounded-full border border-white/15 text-[0.72rem] font-bold">
            {(['cs', 'en'] as const).map((l) => (
              <button
                key={l}
                onClick={() => {
                  setLang(l);
                  setOpen(false);
                }}
                className={`flex-1 px-3 py-2 uppercase transition-colors ${
                  lang === l
                    ? 'bg-rasta-gold text-black'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>
      {open && (
        <div
          className="fixed inset-0 z-[48] bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
