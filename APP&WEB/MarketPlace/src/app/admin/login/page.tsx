'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setAdminKey } from '@/lib/admin-auth';

export default function AdminLoginPage() {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/admin/orders?limit=1', {
        headers: { 'X-API-Key': key },
      });

      if (res.ok) {
        setAdminKey(key);
        router.replace('/admin/orders');
      } else {
        setError('Neplatný admin klíč.');
      }
    } catch {
      setError('Chyba připojení.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md p-8 rounded-2xl border border-white/10 bg-oasis-surface"
      >
        <h1 className="text-2xl font-black text-gradient mb-2">Market Admin</h1>
        <p className="text-sm text-gray-400 mb-6">Zadej admin API klíč pro přístup.</p>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="API klíč"
          className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-sm mb-4 focus:border-oasis-cyan focus:outline-none"
        />

        <button
          type="submit"
          disabled={loading || !key}
          className="w-full py-3 rounded-lg bg-gradient-to-r from-oasis-cyan to-oasis-purple text-black font-bold text-sm hover:opacity-90 disabled:opacity-40"
        >
          {loading ? 'Ověřuji…' : 'Přihlásit'}
        </button>
      </form>
    </div>
  );
}
