'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getAdminKey } from '@/lib/admin-auth';
import { useLangT } from '@/lib/useTranslation';

type ShopTheme = 'rasta' | 'zion';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLangT();
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState<ShopTheme>('rasta');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const key = getAdminKey();
    if (!key && pathname !== '/admin/login') {
      router.replace('/admin/login');
    }
    setReady(true);
  }, [pathname, router]);

  useEffect(() => {
    if (pathname === '/admin/login') return;
    const key = getAdminKey();
    if (!key) return;
    fetch('/api/admin/settings', { headers: { 'X-API-Key': key } })
      .then((res) => res.json())
      .then((json) => {
        const themeValue = json?.data?.theme;
        if (themeValue === 'rasta' || themeValue === 'zion') setTheme(themeValue);
      })
      .catch((err) => console.error('Failed to load theme:', err));
  }, [pathname]);

  const saveTheme = async (next: ShopTheme) => {
    setSaving(true);
    try {
      const key = getAdminKey();
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'X-API-Key': key ?? '' },
        body: JSON.stringify({ theme: next }),
      });
      const json = await res.json();
      if (json?.success) {
        setTheme(next);
      } else {
        console.error('Failed to save theme:', json?.error);
      }
    } catch (err) {
      console.error('Failed to save theme:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
    return <div className="min-h-screen bg-oasis-black" />;
  }

  const isLogin = pathname === '/admin/login';

  return (
    <div className="min-h-screen bg-oasis-black text-oasis-white">
      {!isLogin && (
        <header className="border-b border-white/10 bg-oasis-black/80 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-oasis-cyan via-oasis-purple to-oasis-gold flex items-center justify-center font-black text-oasis-black text-sm">
                Z
              </div>
              <span className="text-lg font-black text-gradient">{t('admin.layoutTitle')}</span>
            </div>
            <nav className="flex items-center gap-2 text-sm">
              <a href="/admin/orders" className="px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">{t('admin.navOrders')}</a>
              <a href="/admin/invoices" className="px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">{t('admin.navInvoices')}</a>
              <a href="/admin/shipping" className="px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">{t('admin.navShipping')}</a>
              <a href="/admin/stripe" className="px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">{t('admin.navStripe')}</a>
              <a href="/" className="px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-oasis-cyan">{t('admin.navStore')}</a>
              <div className="flex items-center gap-2 ml-2 pl-3 border-l border-white/10">
                <label htmlFor="admin-theme" className="text-xs text-white/60">{t('admin.themeLabel')}</label>
                <select
                  id="admin-theme"
                  value={theme}
                  disabled={saving}
                  onChange={(e) => saveTheme(e.target.value as ShopTheme)}
                  className="bg-white/5 border border-white/10 rounded-md text-xs px-2 py-1.5 focus:outline-none focus:border-oasis-cyan"
                >
                  <option value="rasta">{t('admin.themeRasta')}</option>
                  <option value="zion">{t('admin.themeZion')}</option>
                </select>
              </div>
            </nav>
          </div>
        </header>
      )}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
