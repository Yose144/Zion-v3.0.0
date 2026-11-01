import Link from 'next/link';
import { notFound } from 'next/navigation';
import { t } from '@zion/i18n';
import { worldEntry } from '@zion/world';
import { getLocale } from '@/core/locale.server';
import { WorldHost } from '@/core/scene/WorldHost';

export default async function WorldPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = worldEntry(id);
  const locale = await getLocale();

  if (!entry) notFound();

  return (
    <div className="k-world">
      <WorldHost worldId={entry.id} locale={locale} />

      <div className="k-world-chrome">
        <Link href="/room" className="k-ghost">
          ← {t(locale, 'worldBack')}
        </Link>
        <span className="k-topbar-spacer" />
        <span className="k-world-title">{entry.title}</span>
        <span className="k-world-sub">{entry.subtitle[locale]}</span>
        <span className="k-badge">{entry.layer}</span>
      </div>

      <div className="k-world-hint">{t(locale, 'worldHint')}</div>
    </div>
  );
}
