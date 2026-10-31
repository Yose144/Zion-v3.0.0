'use client';

import { useI18n } from '@/core/i18n';

const OASIS_URL = 'https://oasis.zionterranova.com';

/**
 * Brána v liště. Samotná brána ve scéně vede rovnou do OASIS; tenhle panel je pro
 * ty, kdo ji hledají v menu, a nese stejnou akci.
 */
export function GatePortal({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n();
  const cs = lang === 'cs';
  return (
    <aside className="portal" role="dialog" aria-label={t('gate')}>
      <header className="portal-head">
        <h2>{t('gate')}</h2>
        <button type="button" onClick={onClose}>
          {t('close')}
        </button>
      </header>
      <p className="muted">
        {cs
          ? 'Brána je vstup do OASIS. Ve scéně do ní stačí kliknout; odsud vede stejná cesta.'
          : 'The gate is the entrance to OASIS. Click it in the scene, or take the same path from here.'}
      </p>
      <p>
        <a className="portal-link" href={OASIS_URL} target="_blank" rel="noopener noreferrer">
          {cs ? 'Vstoupit do OASIS ↗' : 'Enter OASIS ↗'}
        </a>
      </p>
    </aside>
  );
}
