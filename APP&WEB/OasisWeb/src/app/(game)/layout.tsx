'use client';

import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isGameScene = pathname === '/';

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-oasis-black text-white"
      style={{ height: '100dvh', width: '100vw' }}
    >
      {!isGameScene && <Navbar />}
      <main className="relative h-full w-full">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  );
}
