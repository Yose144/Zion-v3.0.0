'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

const DharmaTemplePreview = dynamic(() => import('./DharmaTemplePreview'), {
  ssr: false,
  loading: () => <PreviewSkeleton />,
});

function PreviewSkeleton() {
  return (
    <div className="flex h-[420px] md:h-[520px] w-full items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-black/40">
      <div className="flex flex-col items-center gap-3 text-white/60">
        <Loader2 className="h-6 w-6 animate-spin text-zion-gold" />
        <span className="text-xs uppercase tracking-widest">Načítání 3D preview / Loading 3D preview…</span>
      </div>
    </div>
  );
}

export default function DharmaTemplePreviewLazy({
  lang = 'cs',
  className = '',
}: {
  lang?: 'cs' | 'en';
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <PreviewSkeleton />;
  }

  return <DharmaTemplePreview lang={lang} className={`h-[420px] md:h-[520px] ${className}`} />;
}
