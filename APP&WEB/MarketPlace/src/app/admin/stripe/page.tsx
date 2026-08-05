'use client';

import { useLangT } from '@/lib/useTranslation';

export default function AdminStripePage() {
  const { t } = useLangT();

  return (
    <div>
      <h1 className="text-2xl font-black text-gradient mb-6">{t('admin.stripeTitle')}</h1>
      <p className="text-gray-400">
        {t('admin.stripeDescription')}
      </p>
    </div>
  );
}
