'use client';

import { useI18n } from '@/core/i18n';

export function ComputePortal({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n();
  const title = lang === 'cs' ? 'Strojovna' : 'Engine room';
  return (
    <aside className="portal" role="dialog" aria-label={title}>
      <header className="portal-head">
        <h2>{title}</h2>
        <button type="button" onClick={onClose}>
          {t('close')}
        </button>
      </header>
      <p className="muted">{t('computeStub')}</p>
    </aside>
  );
}
