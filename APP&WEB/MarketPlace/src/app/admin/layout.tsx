'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getAdminKey } from '@/lib/admin-auth';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const key = getAdminKey();
    if (!key && pathname !== '/admin/login') {
      router.replace('/admin/login');
    }
    setReady(true);
  }, [pathname, router]);

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
              <span className="text-lg font-black text-gradient">Market Admin</span>
            </div>
            <nav className="flex items-center gap-2 text-sm">
              <a href="/admin/orders" className="px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">Orders</a>
              <a href="/admin/invoices" className="px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">Invoices</a>
              <a href="/admin/shipping" className="px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">Shipping</a>
              <a href="/admin/stripe" className="px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">Stripe</a>
              <a href="/" className="px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-oasis-cyan">Store</a>
            </nav>
          </div>
        </header>
      )}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
