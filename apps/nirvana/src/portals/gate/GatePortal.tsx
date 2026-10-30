'use client';

import { useI18n } from '@/core/i18n';

export function GatePortal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <aside className="portal" role="dialog" aria-label={t('gate')}>
      <header className="portal-head">
        <h2>{t('gate')}</h2>
        <button type="button" onClick={onClose}>
          {t('close')}
        </button>
      </header>
      <p className="muted">{t('gateStub')}</p>
    </aside>
  );
}
