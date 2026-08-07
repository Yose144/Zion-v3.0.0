'use client';

import { type ReactNode } from 'react';
import { FileText } from 'lucide-react';
import { useLangT } from '@/lib/useTranslation';
import Link from 'next/link';

interface InfoPageProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function InfoPage({ title, subtitle, children }: InfoPageProps) {
  const { t } = useLangT();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="zion-kicker mb-3 inline-flex items-center gap-2">
            <FileText className="w-4 h-4" /> {t('info.kicker')}
          </div>
          <h1 className="text-3xl font-black font-display text-gradient mb-1">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
        <Link href="/" className="zion-button-secondary self-start">
          ← {t('info.backHome')}
        </Link>
      </div>

      <div className="zion-section p-6 md:p-10">
        <div className="info-content max-w-none">
          {children}
        </div>
      </div>
    </div>
  );
}
