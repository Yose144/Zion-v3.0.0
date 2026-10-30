'use client';

import { useI18n } from '@/core/i18n';

export function IssobellaPortal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <aside className="portal" role="dialog" aria-label="Issobella">
      <header className="portal-head">
        <h2>Issobella</h2>
        <button type="button" onClick={onClose}>
          {t('close')}
        </button>
      </header>
      <p className="muted">{t('issobellaStub')}</p>
    </aside>
  );
}
