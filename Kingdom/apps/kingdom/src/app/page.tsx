import Link from 'next/link';
import { t } from '@zion/i18n';
import { EXTERNAL } from '@/core/api';
import { getLocale } from '@/core/locale.server';
import { Icon } from '@/core/shell/Icon';

export default async function GatePage() {
  const locale = await getLocale();

  return (
    <div className="k-gate">
      <div className="k-gate-bg" aria-hidden="true" />
      <div className="k-gate-ring" aria-hidden="true" />

      <div className="k-gate-inner">
        <span className="k-badge" data-tone="live">
          {t(locale, 'gateSub')}
        </span>

        <h1 className="k-gate-title">{t(locale, 'brand')}</h1>
        <p className="k-gate-text">{t(locale, 'gateLead')}</p>

        <div className="k-gate-links">
          <Link href="/room" className="k-btn">
            {t(locale, 'enter')}
            <Icon name="arrow" size={15} />
          </Link>
        </div>
      </div>

      <div className="k-gate-foot">
        <a href={EXTERNAL.library} target="_blank" rel="noreferrer">
          {t(locale, 'docs')}
        </a>
        <a href={EXTERNAL.ops} target="_blank" rel="noreferrer">
          {t(locale, 'ops')}
        </a>
      </div>
    </div>
  );
}
