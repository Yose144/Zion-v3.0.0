'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import ConnectButton from './ConnectButton';
import { useCart } from './shop/CartContext';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/explore', label: 'Explore' },
  { href: '/shop', label: 'Shop' },
  { href: '/create', label: 'Create' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { count } = useCart();

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/5" style={{ background: 'rgba(9, 10, 15, 0.92)' }}>
      {/* Top accent line */}
      <div className="section-line absolute top-0 inset-x-0" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-oasis-cyan via-oasis-purple to-oasis-gold flex items-center justify-center font-black text-oasis-black text-base group-hover:scale-110 transition-transform duration-300">
                Z
              </div>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-oasis-cyan via-oasis-purple to-oasis-gold blur-md opacity-40 group-hover:opacity-60 transition-opacity" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-lg font-black tracking-tight text-gradient font-display">
                ZION Market
              </span>
              <span className="zion-kicker mt-1" style={{ padding: '0.1rem 0.5rem', fontSize: '0.55rem' }}>
                OASIS Artifacts
              </span>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const active = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
                    active
                      ? 'text-white bg-white/10 shadow-sm'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <Link
              href="/cart"
              className="relative zion-button-icon zion-button-ghost text-gray-300 hover:text-white"
              aria-label="Košík"
            >
              <ShoppingCart className="w-5 h-5" />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center bg-oasis-gold text-oasis-black text-[10px] font-black rounded-full">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </Link>
            <ConnectButton />
            <button
              onClick={() => setOpen(!open)}
              className="md:hidden zion-button-icon zion-button-ghost"
              aria-label="Menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {open ? (
                  <path d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden pb-4 flex flex-col gap-1 animate-fade-in">
            {navLinks.map((link) => {
              const active = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                    active ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
