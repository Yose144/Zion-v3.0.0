import Link from 'next/link';
import { text } from '@zion/contract';
import { t } from '@zion/i18n';
import { getLocale } from '@/core/locale.server';
import { portals } from '@/core/registry';
import { SceneHost } from '@/core/scene/SceneHost';
import { Frame } from '@/core/shell/Frame';
import { Icon } from '@/core/shell/Icon';

export default async function RoomPage() {
  const locale = await getLocale();

  return (
    <Frame locale={locale}>
      <SceneHost locale={locale} />

      <div className="k-stage-head">
        <h1 className="k-title">{t(locale, 'room')}</h1>
        <p className="k-sub">{t(locale, 'roomLead')}</p>
      </div>

      <div className="k-grid">
        {portals.map((portal) => (
          <Link key={portal.id} href={`/portal/${portal.id}`} className="k-card" data-link="true">
            <div className="k-card-title">
              <Icon name={portal.icon} />
              {text(portal.title, locale)}
            </div>

            {portal.summary ? (
              <p className="k-card-desc">{text(portal.summary, locale)}</p>
            ) : null}

            <div className="k-meta">
              <span
                className="k-badge"
                data-tone={portal.status === 'live' ? 'live' : 'soon'}
              >
                {t(locale, portal.status === 'live' ? 'live' : 'placeholder')}
              </span>
              {portal.layer ? <span>{portal.layer}</span> : null}
              <span>{portal.reads.length} reads</span>
            </div>
          </Link>
        ))}
      </div>
    </Frame>
  );
}
