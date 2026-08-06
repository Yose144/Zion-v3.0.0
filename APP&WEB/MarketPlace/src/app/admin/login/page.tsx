'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setAdminKey } from '@/lib/admin-auth';
import { useLangT } from '@/lib/useTranslation';

export default function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { t } = useLangT();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = (await res.json()) as { success: boolean; apiKey?: string; error?: string };

      if (res.ok && data.success && data.apiKey) {
        setAdminKey(data.apiKey);
        router.replace('/admin/orders');
      } else {
        setError(data.error ?? t('admin.invalidCredentials'));
      }
    } catch {
      setError(t('admin.connectionError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md p-8 rounded-2xl border border-white/10 bg-zion-card"
      >
        <h1 className="text-2xl font-black text-gradient mb-2">{t('admin.loginTitle')}</h1>
        <p className="text-sm text-gray-400 mb-6">{t('admin.loginSubtitle')}</p>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t('admin.placeholderUsername')}
          className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-sm mb-4 focus:border-rasta-gold focus:outline-none"
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('admin.placeholderPassword')}
          className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-sm mb-4 focus:border-rasta-gold focus:outline-none"
        />

        <button
          type="submit"
          disabled={loading || !username || !password}
          className="w-full py-3 rounded-lg bg-gradient-to-r from-rasta-gold to-rasta-green text-black font-bold text-sm hover:opacity-90 disabled:opacity-40"
        >
          {loading ? t('admin.verifying') : t('admin.login')}
        </button>
      </form>
    </div>
  );
}
