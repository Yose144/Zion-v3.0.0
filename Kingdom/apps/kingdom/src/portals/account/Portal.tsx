import type { Locale } from '@zion/contract';
import { t } from '@zion/i18n';
import { EXTERNAL } from '@/core/api';

/**
 * Účet je jediné místo, kde Kingdom sahá na identitu. Dnes jen přiznává,
 * že přihlášení ještě není — v F4 sem přijde ZIS challenge a podpis Ed25519.
 * Nic se nepředstírá: žádné tlačítko, které nefunguje.
 */
export default function AccountPortal({ locale }: { locale: Locale }) {
  return (
    <div className="k-card">
      <div className="k-card-title">{t(locale, 'signIn')}</div>
      <p className="k-card-desc">{t(locale, 'signInNote')}</p>

      <div className="k-meta">
        <span className="k-badge">ZIS</span>
        <span className="k-badge">Ed25519</span>
        <span className="k-badge">zion_session</span>
      </div>

      <p className="k-sub" style={{ marginTop: 10 }}>
        {locale === 'cs'
          ? 'Session ponese hostitel okna. Portál si nikdy nedrží vlastní login — jen čte, kdo je přihlášený.'
          : 'The session belongs to the window host. A portal never keeps its own login — it only reads who is signed in.'}
      </p>

      <p style={{ marginTop: 14 }}>
        <a href={EXTERNAL.library} target="_blank" rel="noreferrer" style={{ color: 'var(--k-accent)' }}>
          {t(locale, 'docs')} →
        </a>
      </p>
    </div>
  );
}
