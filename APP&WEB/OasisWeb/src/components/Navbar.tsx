'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
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
  { href: '/onboarding', label: 'Onboarding', icon: BookOpen },
];

export default function Navbar() {
  const pathname = usePathname();

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
          className="bg-gradient-to-r from-oasis-cyan via-oasis-purple to-oasis-gold bg-clip-text text-xl font-bold text-transparent"
        >
          ZION OASIS
        </Link>

        <div className="hidden items-center gap-1 sm:flex">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`group relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'text-oasis-cyan'
                    : 'text-gray-300 hover:text-white'
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

        <div className="flex items-center gap-1 sm:hidden">
          {navItems.map(({ href, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-lg p-2 transition-colors ${
                  active ? 'text-oasis-cyan' : 'text-gray-300 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5" />
              </Link>
            );
          })}
        </div>
      </div>
    </motion.nav>
  );
}
