'use client';

import dynamic from 'next/dynamic';

/** 3D náhled flotily načtený až po hydrataci (canvas se nemountuje při SSR). */
const NebeskaFlotilaPreviewLazy = dynamic(() => import('./NebeskaFlotilaPreview'), { ssr: false });

export default NebeskaFlotilaPreviewLazy;
