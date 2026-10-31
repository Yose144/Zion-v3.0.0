import Link from 'next/link';
import type { Locale } from '@zion/contract';
import { text } from '@zion/contract';
import { t } from '@zion/i18n';
import { portals } from '@/core/registry';

export function Rail({ locale, activeId }: { locale: Locale; activeId?: string }) {
  return (
    <aside className="k-rail" aria-label={t(locale, 'portals')}>
      <div className="k-rail-label">{t(locale, 'portals')}</div>

      {portals.map((portal) => (
        <Link
          key={portal.id}
          href={`/portal/${portal.id}`}
          className="k-rail-item"
          data-active={portal.id === activeId}
          data-status={portal.status}
          title={text(portal.title, locale)}
        >
          <span className="k-rail-dot" />
          <span>{text(portal.title, locale)}</span>
          {portal.layer ? (
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--k-text-faint)' }}>
              {portal.layer}
            </span>
          ) : null}
        </Link>
      ))}
    </aside>
  );
}
