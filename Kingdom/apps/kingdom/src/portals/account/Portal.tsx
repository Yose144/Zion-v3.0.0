import type { Locale } from '@zion/contract';
import { t } from '@zion/i18n';
import { getSession } from '@/core/session/server';
import { LoginForm } from '@/core/session/LoginForm';
import { LogoutButton } from '@/core/session/LogoutButton';
import { DesktopWalletPanel } from './DesktopWalletPanel';

/**
 * Účet — jediné místo, kde Kingdom sahá na identitu.
 *
 * Session drží hostitel okna (cookie `zion_session` od ZIS). Portál ji jen
 * čte; nepřihlášený dostane formulář, přihlášený svou adresu a odhlášení.
 */
export default async function AccountPortal({ locale }: { locale: Locale }) {
  const user = await getSession();

  if (!user) {
    return (
      <>
        <LoginForm locale={locale} />
        <DesktopWalletPanel locale={locale} />
      </>
    );
  }

  const address = user.primaryAddress ?? user.linkedAddresses?.[0]?.address ?? '—';

  return (
    <>
    <div className="k-card" style={{ maxWidth: 640 }}>
      <div className="k-row" style={{ justifyContent: 'space-between' }}>
        <div className="k-card-title">{t(locale, 'signedIn')}</div>
        <LogoutButton locale={locale} />
      </div>

      <div className="k-stats" style={{ marginTop: 8 }}>
        <div className="k-stat">
          <div className="k-stat-label">{t(locale, 'primaryAddress')}</div>
          <div className="k-code" style={{ marginTop: 4 }}>
            {address}
          </div>
        </div>
        {user.displayName ? (
          <div className="k-stat">
            <div className="k-stat-label">{t(locale, 'displayName')}</div>
            <div className="k-stat-value" style={{ fontSize: 15 }}>
              {user.displayName}
            </div>
          </div>
        ) : null}
      </div>

      {user.linkedAddresses && user.linkedAddresses.length > 1 ? (
        <div className="k-meta" style={{ marginTop: 12 }}>
          <span>{user.linkedAddresses.length} adres</span>
          {user.linkedAddresses.map((linked) => (
            <span key={linked.id} className="k-badge">
              {linked.chainType}
            </span>
          ))}
        </div>
      ) : null}

      {user.oasisPlayer ? (
        <p className="k-sub" style={{ marginTop: 12 }}>
          {locale === 'cs' ? 'Propojeno s OASIS hráčem' : 'Linked to an OASIS player'}:{' '}
          {user.oasisPlayer.displayName ?? user.oasisPlayer.address}
        </p>
      ) : null}

      <p className="k-sub" style={{ marginTop: 14 }}>
        {locale === 'cs'
          ? 'Session platí pro celý ekosystém (*.zionterranova.com). Portály si nikdy nedrží vlastní login — jen čtou, kdo je přihlášený.'
          : 'The session covers the whole ecosystem (*.zionterranova.com). A portal never keeps its own login — it only reads who is signed in.'}
      </p>
    </div>
    <DesktopWalletPanel locale={locale} />
  </>
  );
}
