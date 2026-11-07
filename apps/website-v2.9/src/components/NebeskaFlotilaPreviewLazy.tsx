'use client';

import dynamic from 'next/dynamic';
import { t5 } from '@/lib/i18n-tx';
import type { Lang } from '@/contexts/LanguageContext';

/** 3D náhled flotily načtený až po hydrataci (canvas se nemountuje při SSR). */
const NebeskaFlotilaPreviewLazy = dynamic(() => import('./NebeskaFlotilaPreview'), { ssr: false });

export default NebeskaFlotilaPreviewLazy;
