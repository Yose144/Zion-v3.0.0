import type { ReactNode } from 'react';
import type { Locale } from '@zion/contract';
import { Rail } from './Rail';
import { Topbar } from './Topbar';

/**
 * Rám Místnosti: lišta + prsteny portálů + plocha okna.
 * Server komponenta — do klienta jde jen přepínač jazyka.
 */
export function Frame({
  locale,
  activeId,
  children,
}: {
  locale: Locale;
  activeId?: string;
  children: ReactNode;
}) {
  return (
    <div className="k-app">
      <Topbar locale={locale} />
      <div className="k-body">
        <Rail locale={locale} activeId={activeId} />
        <main className="k-stage">{children}</main>
      </div>
    </div>
  );
}
