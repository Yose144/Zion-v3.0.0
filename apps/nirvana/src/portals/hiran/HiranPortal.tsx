'use client';

import { useRouter } from 'next/navigation';
import { useI18n } from '@/core/i18n';
import { HiranChat } from '@/core/hiran/HiranChat';
import type { HiranState } from '@/core/hiran/presence';

/** Okno Hirana ve vesmíru — chat, stav a cesta do chrámu. */
export function HiranPortal({
  onClose,
  state,
  onStateChange,
  focus,
  onFocusSun,
  onFocusEarth,
  probe = true,
}: {
  onClose: () => void;
  state: HiranState;
  onStateChange: (next: HiranState) => void;
  focus: 'earth' | 'sun';
  onFocusSun: () => void;
  onFocusEarth: () => void;
  /** Art review (`?hiran=`) drží stav, takže se nedotazuje na dostupnost. */
  probe?: boolean;
}) {
  const { t, lang } = useI18n();
  const router = useRouter();

  return (
    <aside className="portal hiran-portal" role="dialog" aria-label="Hiran">
      <header className="portal-head">
        <h2>
          Hiran <span className={`hiran-dot hiran-dot-${state}`} aria-hidden="true" />
        </h2>
        <button type="button" onClick={onClose}>
          {t('close')}
        </button>
      </header>

      <HiranChat state={state} onStateChange={onStateChange} probe={probe} />

      <div className="hiran-actions">
        <button type="button" className="hiran-temple" onClick={() => router.push('/present/hiran')}>
          {lang === 'cs' ? 'Vstoupit do chrámu' : 'Enter the temple'}
        </button>
        {focus === 'sun' ? (
          <button type="button" onClick={onFocusEarth}>
            {t('hiranBackToEarth')}
          </button>
        ) : (
          <button type="button" onClick={onFocusSun}>
            {t('hiranFocusSun')}
          </button>
        )}
      </div>
    </aside>
  );
}
