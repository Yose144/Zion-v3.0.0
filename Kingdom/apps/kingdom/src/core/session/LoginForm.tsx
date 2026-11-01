'use client';

/**
 * Přihlášení do Kingdomu.
 *
 * Fráze se odvodí **v prohlížeči**, podepíše se challenge a do serveru jde jen
 * adresa, veřejný klíč a podpis. Fráze se po odeslání smaže z paměti i z pole.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@zion/contract';
import { deriveWalletFromMnemonic, isValidMnemonic, signMessage } from '@zion/session';
import { t } from '@zion/i18n';

type Status = 'idle' | 'working' | 'error';

export function LoginForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [phrase, setPhrase] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const valid = phrase.trim().length > 0 && isValidMnemonic(phrase);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || status === 'working') return;

    setStatus('working');
    setError(null);

    try {
      const wallet = deriveWalletFromMnemonic(phrase);

      const challengeResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ step: 'challenge', address: wallet.address }),
      });

      if (!challengeResponse.ok) throw new Error('challenge');
      const { challenge } = (await challengeResponse.json()) as { challenge: string };

      const signature = signMessage(wallet.privateKeySeed, challenge);

      const verifyResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          step: 'verify',
          address: wallet.address,
          publicKey: wallet.publicKey,
          signature,
        }),
      });

      if (!verifyResponse.ok) throw new Error('verify');

      setPhrase('');
      setStatus('idle');
      router.refresh();
    } catch {
      setPhrase('');
      setStatus('error');
      setError(locale === 'cs' ? 'Přihlášení se nepovedlo.' : 'Sign-in failed.');
    }
  }

  return (
    <form onSubmit={submit} className="k-card" style={{ gap: 12, maxWidth: 560 }}>
      <div className="k-card-title">{t(locale, 'signIn')}</div>
      <p className="k-card-desc">{t(locale, 'mnemonicHint')}</p>

      <textarea
        value={phrase}
        onChange={(event) => setPhrase(event.target.value)}
        placeholder={t(locale, 'mnemonic')}
        rows={3}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        className="k-input"
        aria-label={t(locale, 'mnemonic')}
      />

      <div className="k-row" style={{ gap: 10 }}>
        <button type="submit" className="k-btn" disabled={!valid || status === 'working'}>
          {status === 'working' ? t(locale, 'signingIn') : t(locale, 'signIn')}
        </button>
        {phrase.length > 0 ? (
          <button type="button" className="k-ghost" onClick={() => setPhrase('')}>
            {locale === 'cs' ? 'Smazat' : 'Clear'}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="k-sub" style={{ color: 'var(--k-err)' }}>
          {error}
        </p>
      ) : null}

      <div className="k-meta">
        <span className="k-badge">ZIS</span>
        <span className="k-badge">Ed25519</span>
        <span className="k-badge">zion_session</span>
      </div>
    </form>
  );
}
