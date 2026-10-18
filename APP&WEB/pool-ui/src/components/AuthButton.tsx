'use client';

// ZIS sign-in button + modal + authenticated user menu.
// Embedded methods: WebAuthn passkey and MetaMask SIWE; other methods
// (Zion Wallet, Google) are handled on the hosted app login — the SSO
// cookie is shared back to pool automatically.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Fingerprint,
  KeyRound,
  LogOut,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { passkeySupported, zisAvatarUrl, ZION_APP_LOGIN } from '@/lib/zis';

export default function AuthButton() {
  const { t } = useLang();
  const { user, loading, authenticated, loginWithPasskey, loginWithSiwe, logout } =
    useAuth();
  const [modal, setModal] = useState(false);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState<'passkey' | 'siwe' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const run = async (kind: 'passkey' | 'siwe') => {
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'passkey') await loginWithPasskey();
      else await loginWithSiwe();
      setModal(false);
    } catch (e) {
      setError((e as Error).message ?? 'Login failed');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <span className="inline-block h-8 w-8 animate-pulse rounded-full bg-white/10" />;
  }

  if (authenticated && user) {
    const name =
      user.displayName ||
      `${user.primaryAddress.slice(0, 8)}…${user.primaryAddress.slice(-4)}`;
    const avatar = user.avatar || zisAvatarUrl(user.id, { sz: 64 });
    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setMenu(!menu)}
          className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 py-1 pl-1 pr-2.5 transition hover:border-rasta-gold/50"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatar} alt="" className="h-6 w-6 rounded-lg" />
          <span className="max-w-[110px] truncate text-xs font-semibold text-white">
            {name}
          </span>
        </button>
        {menu && (
          <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-white/10 bg-[#141414] p-1.5 shadow-2xl">
            <div className="border-b border-white/8 px-3 py-2 text-[0.68rem] text-white/40">
              {user.email ?? user.primaryAddress.slice(0, 20) + '…'}
            </div>
            <Link
              href="/account/"
              onClick={() => setMenu(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/75 hover:bg-white/5 hover:text-white"
            >
              <UserRound size={13} />
              {t('Můj účet & těžba', 'My account & mining')}
            </Link>
            <button
              onClick={() => {
                logout();
                setMenu(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-rasta-red hover:bg-rasta-red/10"
            >
              <LogOut size={13} />
              {t('Odhlásit', 'Sign out')}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <button onClick={() => setModal(true)} className="btn-gold px-3.5 py-1.5 text-xs">
        {t('Přihlásit', 'Sign in')}
      </button>

      {modal && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setModal(false)}
        >
          <div
            className="pool-card w-full max-w-sm border border-white/10 bg-[#141414] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-white">
                  {t('Přihlášení přes ZIS', 'Sign in with ZIS')}
                </h3>
                <p className="mt-1 text-xs text-white/45">
                  {t(
                    'Jedna identita pro celý ZION ekosystém.',
                    'One identity across the ZION ecosystem.',
                  )}
                </p>
              </div>
              <button
                onClick={() => setModal(false)}
                className="text-white/40 hover:text-white"
                aria-label="close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-2.5">
              {passkeySupported() && (
                <button
                  onClick={() => run('passkey')}
                  disabled={busy !== null}
                  className="flex items-center gap-3 rounded-xl border border-rasta-gold/40 bg-rasta-gold/10 px-4 py-3 text-left transition hover:border-rasta-gold hover:bg-rasta-gold/15 disabled:opacity-50"
                >
                  <Fingerprint size={20} className="shrink-0 text-rasta-gold" />
                  <span>
                    <span className="block text-sm font-semibold text-white">
                      {busy === 'passkey'
                        ? t('Čekám na potvrzení…', 'Waiting for confirmation…')
                        : 'Passkey'}
                    </span>
                    <span className="block text-[0.68rem] text-white/45">
                      {t('Face ID, otisk, klíčenka — bez peněženky', 'Face ID, fingerprint, keychain — no wallet needed')}
                    </span>
                  </span>
                </button>
              )}

              <button
                onClick={() => run('siwe')}
                disabled={busy !== null}
                className="flex items-center gap-3 rounded-xl border border-white/12 bg-white/5 px-4 py-3 text-left transition hover:border-rasta-green/50 hover:bg-rasta-green/10 disabled:opacity-50"
              >
                <Wallet size={20} className="shrink-0 text-rasta-green" />
                <span>
                  <span className="block text-sm font-semibold text-white">
                    {busy === 'siwe' ? t('Čekám na podpis…', 'Waiting for signature…') : 'MetaMask / EVM'}
                  </span>
                  <span className="block text-[0.68rem] text-white/45">
                    {t('Přihlášení podpisem (SIWE)', 'Signature sign-in (SIWE)')}
                  </span>
                </span>
              </button>

              <a
                href={ZION_APP_LOGIN}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-xl border border-white/12 bg-white/5 px-4 py-3 text-left transition hover:border-rasta-red/50 hover:bg-rasta-red/10"
              >
                <KeyRound size={20} className="shrink-0 text-rasta-red" />
                <span>
                  <span className="block text-sm font-semibold text-white">
                    {t('Zion Wallet / Google', 'Zion Wallet / Google')}
                  </span>
                  <span className="block text-[0.68rem] text-white/45">
                    {t('přes app.zionterranova.com — SSO se přenese', 'via app.zionterranova.com — SSO carries over')}
                  </span>
                </span>
              </a>
            </div>

            {error && (
              <p className="mt-3 rounded-lg border border-rasta-red/30 bg-rasta-red/10 px-3 py-2 text-[0.7rem] text-rasta-red">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
