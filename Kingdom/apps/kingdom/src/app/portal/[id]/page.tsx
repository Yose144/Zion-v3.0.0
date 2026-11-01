import Link from 'next/link';
import { notFound } from 'next/navigation';
import { text } from '@zion/contract';
import { t } from '@zion/i18n';
import { getLocale } from '@/core/locale.server';
import { portalById } from '@/core/registry';
import { Frame } from '@/core/shell/Frame';
import { Icon } from '@/core/shell/Icon';

export default async function PortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const search = await searchParams;
  const locale = await getLocale();
  const entry = portalById(id);

  if (!entry) notFound();

  const { manifest, view: View } = entry;

  return (
    <Frame locale={locale} activeId={manifest.id}>
      <div className="k-stage-head">
        <h1 className="k-title">
          <span className="k-row" style={{ gap: 10 }}>
            <Icon name={manifest.icon} size={20} />
            {text(manifest.title, locale)}
          </span>
        </h1>
        <span className="k-badge" data-tone={manifest.status === 'live' ? 'live' : 'soon'}>
          {t(locale, manifest.status === 'live' ? 'live' : 'placeholder')}
        </span>
        {manifest.layer ? <span className="k-sub">{manifest.layer}</span> : null}
      </div>

      <View locale={locale} search={search} />

      <p style={{ marginTop: 28 }}>
        <Link href="/room" className="k-sub">
          ← {t(locale, 'back')}
        </Link>
      </p>
    </Frame>
  );
}
