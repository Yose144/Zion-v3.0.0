'use client';

import { useEffect } from 'react';
import { useLang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { lang } = useLang();

  useEffect(() => {
    console.error('[ZION] Next.js route error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-black text-white">
      <div className="text-center max-w-lg space-y-6">
        <div className="mx-auto w-20 h-20 rounded-full border border-zion-gold-500/30 bg-zion-gold-500/10 flex items-center justify-center">
          <svg className="w-10 h-10 text-zion-gold-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold">{tr('globalRouteError', 'title', lang)}</h1>
        <p className="text-gray-400">{tr('globalRouteError', 'paragraph', lang)}</p>
        <p className="text-sm text-gray-600">{tr('globalRouteError', 'footer_hint', lang)}</p>

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center px-5 py-3 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 transition"
          >
            {tr('globalRouteError', 'retry', lang)}
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center px-5 py-3 rounded-xl bg-gradient-to-r from-zion-gold-600 to-zion-gold-500 text-black font-semibold hover:opacity-90 transition"
          >
            {tr('globalRouteError', 'reload', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
