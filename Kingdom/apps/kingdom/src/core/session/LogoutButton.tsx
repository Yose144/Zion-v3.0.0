'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@zion/contract';
import { t } from '@zion/i18n';

export function LogoutButton({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="k-ghost" onClick={signOut} disabled={busy}>
      {busy ? '…' : t(locale, 'signOut')}
    </button>
  );
}
