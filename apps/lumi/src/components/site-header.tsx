'use client';

import { useState, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Menu, ShoppingBag, X } from 'lucide-react';
import { NAV, SITE } from '@/data/site';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';
import { useCart } from '@/components/cart-provider';
import LanguageSwitcher from '@/components/language-switcher';
import ThemeToggle from '@/components/theme-toggle';
import { cn } from '@/lib/utils';

export default function SiteHeader() {
  const { lang } = useLang();
  const { count } = useCart();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const announcement = useMemo(() => pick(SITE.announcement, lang), [lang]);

  return (
    <header className="sticky top-0 z-40">
      <div className="bg-forest text-parchment">
        <div className="container-lumi flex items-center justify-center gap-2 py-2 text-center text-[11px] font-medium tracking-wide sm:text-xs">
          <span className="hidden h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400 sm:inline-block" />
          <span className="line-clamp-1">{announcement}</span>
        </div>
      </div>

      <div className="border-b border-line/80 bg-paper/90 backdrop-blur-md">
        <div className="container-lumi flex h-16 items-center justify-between gap-4">
          <Link href="/" className="group flex items-baseline gap-2" aria-label="Lumi — domů">
            <span className="h-display text-[1.7rem] font-semibold tracking-[0.14em] text-ink">LUMI</span>
            <span className="hidden whitespace-nowrap text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-muted sm:inline lg:hidden xl:inline">
              {pick(SITE.tagline, lang)}
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Hlavní navigace">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-full px-2.5 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                    active ? 'bg-ink/5 text-ink' : 'text-ink-soft hover:bg-ink/5 hover:text-ink',
                  )}
                >
                  {pick(item.label, lang)}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>
            <ThemeToggle />
            <Link
              href="/kosik"
              className="relative inline-flex h-10 items-center gap-2 rounded-full border border-ink/15 bg-card/60 px-3 text-sm font-semibold text-ink transition-colors hover:border-ink/40"
              aria-label={`${pick({ cs: 'Košík', en: 'Cart', de: 'Warenkorb' }, lang)} (${count})`}
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">{pick({ cs: 'Košík', en: 'Cart', de: 'Warenkorb' }, lang)}</span>
              {count > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-bold text-[#101C2B]">
                  {count}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink/15 bg-card/60 text-ink lg:hidden"
              aria-expanded={open}
              aria-label={open ? 'Zavřít menu' : 'Otevřít menu'}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="border-t border-line bg-paper lg:hidden">
            <nav className="container-lumi grid gap-1 py-4" aria-label="Mobilní navigace">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-3 text-base font-medium text-ink hover:bg-ink/5"
                >
                  {pick(item.label, lang)}
                </Link>
              ))}
              <p className="mt-3 border-t border-line px-3 pt-3 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-muted">
                {pick(SITE.tagline, lang)}
              </p>
              <div className="mt-3 flex items-center justify-between border-t border-line pt-4">
                <span className="text-xs uppercase tracking-[0.14em] text-muted">Jazyk</span>
                <LanguageSwitcher compact />
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
