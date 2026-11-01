'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Client-side redirect — a server `redirect()` here trips Next.js 14's
 * app-router hook bug (minified React error #310 in the browser console)
 * on the way to /admin/orders.
 */
export default function AdminIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/orders');
  }, [router]);
  return null;
}
