'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { COIN_META, UI_ID } from '@/lib/api';
import AuthButton from '@/components/AuthButton';
import CoinLogo from '@/components/CoinLogo';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import NavDropdown from '@/components/NavDropdown';

const LINKS = [
  { href: '/', cs: 'Přehled', en: 'Overview' },
  { href: '/start/', cs: 'Jak těžit', en: 'Start mining' },
  { href: '/blocks/', cs: 'Bloky', en: 'Blocks' },
  { href: '/payouts/', cs: 'Výplaty', en: 'Payouts' },
  { href: '/stats/', cs: 'Statistiky', en: 'Stats' },
  { href: '/api-docs/', cs: 'API', en: 'API' },
  { href: '/faq/', cs: 'FAQ', en: 'FAQ' },
];

// Coin menu groups — static metadata, same order as the homepage table.
const NATIVE_COIN_KEYS = ['zion', 'qtu', 'prl'];
const AUX_COIN_KEYS = Object.keys(COIN_META).filter(
  (k) => !NATIVE_COIN_KEYS.includes(k),
);
const coinItem = (key: string) => ({
  href: `/coin/${UI_ID[key]}/`,
  ticker: COIN_META[key].ticker,
  name: COIN_META[key].name,
  logo: COIN_META[key].logo,
  accent: COIN_META[key].accent,
});

// HeroMiners-style "Details" dropdown — grouped ecosystem links.
const ECOSYSTEM_GROUPS: {
  cs: string;
  en: string;
  items: { href: string; label: string; sub: string }[];
}[] = [
  {
    cs: 'Ekosystém',
    en: 'Ecosystem',
    items: [
      { href: 'https://zionterranova.com', label: 'ZION TerraNova', sub: 'zionterranova.com' },
      { href: 'https://app.zionterranova.com', label: 'Wallet & Explorer', sub: 'app.zionterranova.com' },
      { href: 'https://market.zionterranova.com', label: 'Marketplace', sub: 'market.zionterranova.com' },
      { href: 'https://oasis.zionterranova.com', label: 'Oasis AI', sub: 'oasis.zionterranova.com' },
    ],
  },
  {
    cs: 'Pro vývojáře',
    en: 'Developers',
    items: [
      { href: 'https://rpc.zionterranova.com', label: 'Public RPC', sub: 'rpc.zionterranova.com' },
      { href: 'https://github.com/Yose144/Zion-v3.0.0', label: 'GitHub', sub: 'Zion-v3.0.0' },
    ],
  },
];

export default function Nav() {
  const pathname = usePathname();
  const { lang, t } = useLang();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.body.classList.toggle('rasta-menu-open', open);
    return () => document.body.classList.remove('rasta-menu-open');
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const first = menuRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]), a[href]',
    );
    first?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !menuRef.current) return;

      const focusable = menuRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href]',
      );
      if (!focusable.length) return;
      const firstFocusable = focusable[0];
      const lastFocusable = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      menuButtonRef.current?.focus({ preventScroll: true });
    };
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
            <NavDropdown label={t('Coiny', 'Coins')}>
              <div className="rasta-nav-dropheader">{t('Nativní', 'Native')}</div>
              {NATIVE_COIN_KEYS.map((k) => {
                const c = coinItem(k);
                return (
                  <Link key={k} href={c.href} role="menuitem" className="rasta-nav-dropitem">
                    <CoinLogo logo={c.logo} ticker={c.ticker} accent={c.accent} size={22} />
                    <span className="rasta-nav-dropitem-main">
                      {c.ticker}
                      <span className="rasta-nav-dropitem-sub">{c.name}</span>
                    </span>
                  </Link>
                );
              })}
              <div className="rasta-nav-dropheader">{t('auxPoW — výplata v ZION', 'auxPoW — paid in ZION')}</div>
              {AUX_COIN_KEYS.map((k) => {
                const c = coinItem(k);
                return (
                  <Link key={k} href={c.href} role="menuitem" className="rasta-nav-dropitem">
                    <CoinLogo logo={c.logo} ticker={c.ticker} accent={c.accent} size={22} />
                    <span className="rasta-nav-dropitem-main">
                      {c.ticker}
                      <span className="rasta-nav-dropitem-sub">{c.name}</span>
                    </span>
                  </Link>
                );
              })}
            </NavDropdown>
            <NavDropdown label={t('Ekosystém', 'Ecosystem')}>
              {ECOSYSTEM_GROUPS.map((g) => (
                <div key={g.en}>
                  <div className="rasta-nav-dropheader">
                    {lang === 'cs' ? g.cs : g.en}
                  </div>
                  {g.items.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      role="menuitem"
                      className="rasta-nav-dropitem"
                    >
                      <span className="rasta-nav-dropitem-main">
                        {item.label}
                        <span className="rasta-nav-dropitem-sub">{item.sub}</span>
                      </span>
                      <ExternalLink size={12} className="rasta-nav-dropitem-ext" aria-hidden />
                    </a>
                  ))}
                </div>
              ))}
            </NavDropdown>
          </div>

          <div className="rasta-nav-right">
            <div className="rasta-nav-actions">
              <LanguageSwitcher />
              <AuthButton />
            </div>
            <button
              ref={menuButtonRef}
              type="button"
              className={`rasta-hamburger ${open ? 'active' : ''}`}
              onClick={() => setOpen(!open)}
              aria-label={open ? t('Zavřít menu', 'Close menu') : t('Otevřít menu', 'Open menu')}
              aria-expanded={open}
              aria-controls="pool-mobile-menu"
            >
              <span className="bar" />
              <span className="bar" />
              <span className="bar" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile slide-in menu */}
      <div
        ref={menuRef}
        id="pool-mobile-menu"
        className={`rasta-mobile-menu ${open ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pool-mobile-menu-title"
        aria-hidden={!open}
        inert={!open}
      >
        <div className="rasta-mobile-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/zion-symbol.png"
            alt=""
            width={34}
            height={34}
            className="rasta-nav-logo-img"
          />
          <span id="pool-mobile-menu-title" className="rasta-nav-brand">ZION Pool</span>
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
        <div className="rasta-mobile-subheader">{t('Coiny — nativní', 'Coins — native')}</div>
        {NATIVE_COIN_KEYS.map((k) => {
          const c = coinItem(k);
          return (
            <Link
              key={k}
              href={c.href}
              onClick={() => setOpen(false)}
              className="rasta-nav-dropitem"
            >
              <CoinLogo logo={c.logo} ticker={c.ticker} accent={c.accent} size={22} />
              <span className="rasta-nav-dropitem-main">
                {c.ticker}
                <span className="rasta-nav-dropitem-sub">{c.name}</span>
              </span>
            </Link>
          );
        })}
        <div className="rasta-mobile-subheader">{t('Coiny — auxPoW', 'Coins — auxPoW')}</div>
        {AUX_COIN_KEYS.map((k) => {
          const c = coinItem(k);
          return (
            <Link
              key={k}
              href={c.href}
              onClick={() => setOpen(false)}
              className="rasta-nav-dropitem"
            >
              <CoinLogo logo={c.logo} ticker={c.ticker} accent={c.accent} size={22} />
              <span className="rasta-nav-dropitem-main">
                {c.ticker}
                <span className="rasta-nav-dropitem-sub">{c.name}</span>
              </span>
            </Link>
          );
        })}
        {ECOSYSTEM_GROUPS.map((g) => (
          <div key={g.en}>
            <div className="rasta-mobile-subheader">
              {lang === 'cs' ? g.cs : g.en}
            </div>
            {g.items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                onClick={() => setOpen(false)}
                className="rasta-nav-dropitem"
              >
                <span className="rasta-nav-dropitem-main">
                  {item.label}
                  <span className="rasta-nav-dropitem-sub">{item.sub}</span>
                </span>
                <ExternalLink size={12} className="rasta-nav-dropitem-ext" aria-hidden />
              </a>
            ))}
          </div>
        ))}
        <div className="rasta-mobile-actions">
          <LanguageSwitcher />
          <AuthButton />
        </div>
      </div>
    </>
  );
}
