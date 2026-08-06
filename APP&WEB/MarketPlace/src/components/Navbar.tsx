'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
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
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { count } = useCart();
  const { t } = useLangT();

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
          <Link href="/" className="rasta-nav-logo-link" onClick={() => setOpen(false)}>
            <img
              src="/symbol-200x200.png"
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
                {t(link.key as 'nav.home' | 'nav.explore' | 'nav.shop' | 'nav.create')}
              </Link>
            ))}
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
              onClick={() => setOpen(!open)}
              className={`rasta-hamburger ${open ? 'active' : ''}`}
              aria-label={open ? t('nav.close') : t('nav.open')}
              aria-expanded={open}
            >
              <span className="bar" />
              <span className="bar" />
              <span className="bar" />
            </button>
          </div>
        </div>
      </nav>

      <div className={`rasta-mobile-menu ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="rasta-mobile-brand">
          <img
            src="/symbol-200x200.png"
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
            {t(link.key as 'nav.home' | 'nav.explore' | 'nav.shop' | 'nav.create')}
          </Link>
        ))}

        <div className="rasta-mobile-actions">
          <LanguageSwitcher variant="rasta" />
          <ConnectButton variant="rasta" />
        </div>
      </div>
    </>
  );
}
