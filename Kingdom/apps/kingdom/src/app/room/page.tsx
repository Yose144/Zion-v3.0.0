import Link from 'next/link';
import { text } from '@zion/contract';
import { t } from '@zion/i18n';
import { placeMarker, type SceneMarker } from '@zion/world';
import { getLocale } from '@/core/locale.server';
import { portals } from '@/core/registry';
import { Frame } from '@/core/shell/Frame';
import { Icon } from '@/core/shell/Icon';
import { SceneHost } from '@/core/scene/SceneHost';

export default async function RoomPage() {
  const locale = await getLocale();

  /* Svět je generovaný Portal Contractem: portál s `ring` se objeví ve scéně. */
  const markers: SceneMarker[] = portals
    .filter((portal) => portal.ring)
    .map((portal) => {
      const position = placeMarker(portal.ring!);
      return {
        id: portal.id,
        title: text(portal.title, locale),
        hue: portal.ring!.hue,
        x: position.x,
        y: position.y,
        z: position.z,
        live: portal.status === 'live',
      };
    });

  return (
    <Frame locale={locale}>
      <SceneHost markers={markers} label={t(locale, 'roomScene')} />

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
              <span className="k-badge" data-tone={portal.status === 'live' ? 'live' : 'soon'}>
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
