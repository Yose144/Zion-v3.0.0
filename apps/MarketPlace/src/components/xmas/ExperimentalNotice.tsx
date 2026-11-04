'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { useLangT } from '@/lib/useTranslation';

/**
 * Sdílený právní blok pro vánoční produktové stránky —
 * experimentální charakter projektu, žádná peněžní hodnota bonusů,
 * omezení záruk/reklamací v rozsahu zákona.
 */
export default function ExperimentalNotice() {
  const { t } = useLangT();
  return (
    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-5 md:p-6">
      <div className="flex items-center gap-2 text-amber-300 text-sm font-bold uppercase tracking-wide">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        {t('xlegal.title')}
      </div>
      <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-gray-300 list-disc pl-5">
        <li>{t('xlegal.experimental')}</li>
        <li>{t('xlegal.noValue')}</li>
        <li>{t('xlegal.asIs')}</li>
        <li>{t('xlegal.digitalWithdrawal')}</li>
      </ul>
      <p className="mt-3 text-xs text-gray-500">
        {t('xlegal.more')}{' '}
        <Link href="/terms" className="text-rasta-gold hover:underline">
          {t('xlegal.terms')}
        </Link>{' '}
        ·{' '}
        <Link href="/reklamace" className="text-rasta-gold hover:underline">
          {t('xlegal.complaints')}
        </Link>
      </p>
    </div>
  );
}
