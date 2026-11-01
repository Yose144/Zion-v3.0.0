'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { ShoppingCart } from 'lucide-react';
import ConnectButton from './ConnectButton';
import { useCart } from './shop/CartContext';
import LanguageSwitcher from './LanguageSwitcher';
import { useLangT } from '@/lib/useTranslation';

const navLinkKeys = [
  { href: '/', key: 'nav.home' },
  { href: '/explore', key: 'nav.explore' },
  { href: '/shop', key: 'nav.shop' },
  { href: '/create', key: 'nav.create' },
  { href: '/ai', key: 'nav.ai' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const { count } = useCart();
  const { t } = useLangT();

  useEffect(() => {
    document.body.classList.toggle('rasta-menu-open', open);
    return () => document.body.classList.remove('rasta-menu-open');
  }, [open]);

  /* Close on route change so the drawer never stays open after navigation. */
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  /* Escape closes the drawer and returns focus to the hamburger. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  /* Focus trap: keep Tab inside the open drawer. */
  useEffect(() => {
    if (!open || !menuRef.current) return;
    const root = menuRef.current;
    const focusables = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
    const first = focusables()[0];
    first?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    root.addEventListener('keydown', onKeyDown);
    return () => root.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href));

  return (
    <>
      <nav className="rasta-nav">
        <div className="rasta-nav-pill">
          <Link href="/" className="rasta-nav-logo-link" onClick={() => setOpen(false)}>
            <img
              src="/logo/org/symbol-200x200.png"
              alt="ZION"
              width={38}
              height={38}
              className="rasta-nav-logo-img"
            />
            <div className="rasta-nav-logo-text">
              <span className="rasta-nav-brand">{t('nav.logoPrimary')}</span>
              <span className="rasta-nav-kicker">{t('nav.logoSecondary')}</span>
            </div>
          </Link>

          <div className="rasta-nav-menu rasta-desktop-menu">
            {navLinkKeys.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rasta-nav-link ${isActive(link.href) ? 'active' : ''}`}
              >
                {t(link.key as 'nav.home' | 'nav.explore' | 'nav.shop' | 'nav.create' | 'nav.ai')}
              </Link>
            ))}
            <a
              href="https://pool.zionterranova.com"
              target="_blank"
              rel="noreferrer"
              className="rasta-nav-link"
            >
              {t('nav.pool')}
            </a>
          </div>

          <div className="rasta-nav-right">
            <Link
              href="/cart"
              className="rasta-cart"
              aria-label={t('nav.cartAria')}
              onClick={() => setOpen(false)}
            >
              <ShoppingCart className="rasta-cart-icon" />
              {count > 0 && (
                <span className="rasta-cart-badge">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </Link>

            <div className="rasta-nav-actions">
              <LanguageSwitcher variant="rasta" />
              <ConnectButton variant="rasta" />
            </div>

            <button
              ref={toggleRef}
              onClick={() => setOpen(!open)}
              className={`rasta-hamburger ${open ? 'active' : ''}`}
              aria-label={open ? t('nav.close') : t('nav.open')}
              aria-expanded={open}
              aria-controls="rasta-mobile-menu"
            >
              <span className="bar" />
              <span className="bar" />
              <span className="bar" />
            </button>
          </div>
        </div>
      </nav>

      <div
        ref={menuRef}
        id="rasta-mobile-menu"
        className={`rasta-mobile-menu ${open ? 'open' : ''}`}
        aria-hidden={!open}
      >
        <div className="rasta-mobile-brand">
          <img
            src="/logo/org/symbol-200x200.png"
            alt="ZION"
            width={34}
            height={34}
            className="rasta-nav-logo-img"
          />
          <span className="rasta-nav-brand">{t('nav.logoPrimary')}</span>
        </div>

        {navLinkKeys.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setOpen(false)}
            className={`rasta-nav-link ${isActive(link.href) ? 'active' : ''}`}
          >
            {t(link.key as 'nav.home' | 'nav.explore' | 'nav.shop' | 'nav.create' | 'nav.ai')}
          </Link>
        ))}
        <a
          href="https://pool.zionterranova.com"
          target="_blank"
          rel="noreferrer"
          onClick={() => setOpen(false)}
          className="rasta-nav-link"
        >
          {t('nav.pool')}
        </a>

        <div className="rasta-mobile-actions">
          <LanguageSwitcher variant="rasta" />
          <ConnectButton variant="rasta" />
        </div>
      </div>
    </>
  );
}
