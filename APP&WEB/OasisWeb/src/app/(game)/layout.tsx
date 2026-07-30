import Navbar from '@/components/Navbar';
import OasisBackground from '@/components/OasisBackground';

export default function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen w-full overflow-y-auto text-white">
      <OasisBackground />
      <Navbar />
      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-24 pt-24 sm:px-6">
        {children}
      </main>
    </div>
  );
}
