import Link from 'next/link';
import type { Locale } from '@zion/contract';
import { t } from '@zion/i18n';
import { EXTERNAL } from '@/core/api';
import { Icon } from './Icon';
import { LocaleSwitcher } from './LocaleSwitcher';

export function Topbar({ locale }: { locale: Locale }) {
  return (
    <header className="k-topbar">
      <Link href="/" className="k-brand">
        <span className="k-brand-dot" />
        <span>{t(locale, 'brand')}</span>
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
