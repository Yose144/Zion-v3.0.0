import Navbar from '@/components/Navbar';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 h-screen w-screen overflow-hidden bg-oasis-black text-white">
      <Navbar />
      <main className="relative h-full w-full">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  );
}
