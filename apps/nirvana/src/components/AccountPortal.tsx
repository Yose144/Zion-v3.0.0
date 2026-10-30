'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useI18n } from '@/lib/i18n';

export function AccountPortal({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n();
  const { user, login, logout } = useAuth();
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const title = lang === 'cs' ? 'Účet' : 'Account';

  async function submit(event: FormEvent) {
    event.preventDefault();
    const words = phrase;
    setBusy(true);
    setFailed(false);
    try {
      await login(words);
      setPhrase('');
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="portal" role="dialog" aria-label={title}>
      <header className="portal-head">
        <h2>{title}</h2>
        <button type="button" onClick={onClose}>
          {t('close')}
        </button>
      </header>
      {user ? (
        <>
          <p>{user.displayName || user.primaryAddress}</p>
          {user.displayName && <p className="muted">{user.primaryAddress}</p>}
          <button type="button" onClick={() => void logout()}>
            {t('signOut')}
          </button>
        </>
      ) : (
        <form onSubmit={(event) => void submit(event)}>
          <p className="muted">{t('phrase')}</p>
          <textarea
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            rows={3}
            required
          />
          {failed && <p>{t('signInFailed')}</p>}
          <button type="submit" disabled={busy || phrase.trim().length === 0}>
            {busy ? '…' : t('signIn')}
          </button>
        </form>
      )}
    </aside>
  );
}
