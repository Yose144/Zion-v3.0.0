import Link from 'next/link';
import type { Locale } from '@zion/contract';
import { t } from '@zion/i18n';
import { EXTERNAL } from '@/core/api';
import { Icon } from './Icon';
import { LocaleSwitcher } from './LocaleSwitcher';

export function Topbar({ locale }: { locale: Locale }) {
  return (
    <header className="k-topbar">
      {/* Originální znak ZIONu (rasta Z-glyph) — klient má mít svoji identitu,
          ne tečku. Zdroj: apps/IntroPage/public/glyph-transparent.png. */}
      <Link href="/" className="k-brand" aria-label={t(locale, 'brand')}>
        <img src="/brand/zion-glyph.png" alt="" className="k-brand-glyph" width={132} height={44} />
        <span className="k-brand-name">{t(locale, 'brand')}</span>
      </Link>

      <nav className="k-nav">
        <Link href="/">{t(locale, 'gate')}</Link>
        <Link href="/room">{t(locale, 'room')}</Link>
      </nav>

      <span className="k-topbar-spacer" />

      <a className="k-ghost" href={EXTERNAL.library} target="_blank" rel="noreferrer">
        <Icon name="arrow" size={13} /> {t(locale, 'docs')}
      </a>
      <a className="k-ghost" href={EXTERNAL.ops} target="_blank" rel="noreferrer">
        {t(locale, 'ops')}
      </a>

      <LocaleSwitcher locale={locale} />
    </header>
  );
}
