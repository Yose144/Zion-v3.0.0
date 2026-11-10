'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

const AvatarModel3D = dynamic(() => import('./AvatarModel3D'), {
  ssr: false,
  loading: () => <Skeleton />,
});

function Skeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-2xl border border-white/10 bg-black/40">
      <div className="flex flex-col items-center gap-2 text-white/60">
        <Loader2 className="h-6 w-6 animate-spin text-zion-gold" />
        <span className="text-[10px] uppercase tracking-widest">3D</span>
      </div>
    </div>
  );
}

export default function AvatarModel3DLazy({
  id,
  className = '',
}: {
  id: number;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={className}>
        <Skeleton />
      </div>
    );
  }

  return (
    <div className={className}>
      <AvatarModel3D id={id} className="h-full w-full" />
    </div>
  );
}
