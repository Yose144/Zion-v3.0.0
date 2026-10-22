'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import {
  Home,
  User,
  Users,
  Swords,
  Trophy,
  BookOpen,
  Globe,
  Shield,
  Egg,
  Pickaxe,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/dashboard', label: 'Dashboard', icon: User },
  { href: '/avatars', label: 'Avatars', icon: Users },
  { href: '/quests', label: 'Quests', icon: Swords },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/territories', label: 'Territories', icon: Globe },
  { href: '/guilds', label: 'Guilds', icon: Shield },
  { href: '/golden-egg', label: 'Golden Egg', icon: Egg },
  { href: '/miner', label: 'Miner', icon: Pickaxe },
  { href: '/onboarding', label: 'Onboarding', icon: BookOpen },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <motion.nav
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed top-0 left-0 right-0 z-40 border-b border-white/10 bg-oasis-black/60 backdrop-blur-md"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="bg-gradient-to-r from-oasis-cyan via-oasis-purple to-oasis-gold bg-clip-text text-lg font-bold text-transparent sm:text-xl"
        >
          ZION OASIS
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 lg:flex">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`group relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'text-oasis-cyan'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
                {active && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 -z-10 rounded-lg bg-oasis-cyan/10 ring-1 ring-oasis-cyan/30"
                    transition={{ type: 'spring', duration: 0.5 }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* Tablet: scrollable icon bar (sm to lg) */}
        <div className="hidden items-center gap-0.5 overflow-x-auto sm:flex lg:hidden"
          style={{ scrollbarWidth: 'none' }}
        >
          {navItems.map(({ href, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`shrink-0 rounded-lg p-2 transition-colors ${
                  active ? 'text-oasis-cyan' : 'text-white/80 hover:text-white'
                }`}
                title={href === '/' ? 'Home' : href.slice(1).charAt(0).toUpperCase() + href.slice(2)}
              >
                <Icon className="h-5 w-5" />
              </Link>
            );
          })}
        </div>

        {/* Mobile: hamburger menu (< sm) */}
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white sm:hidden"
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile dropdown menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/10 bg-oasis-black/95 backdrop-blur-lg sm:hidden"
          >
            <div className="grid grid-cols-2 gap-1 p-3">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-oasis-cyan/10 text-oasis-cyan ring-1 ring-oasis-cyan/30'
                        : 'text-white/80 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{label}</span>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
