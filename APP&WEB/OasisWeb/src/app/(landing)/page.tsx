import OasisClient from '@/components/OasisClient';

export default function Home() {
  return (
    <main className="relative overflow-hidden bg-oasis-black" style={{ height: '100%', width: '100%' }}>
      <h1 className="sr-only">ZION OASIS — Interactive Worlds</h1>
      <OasisClient />
    </main>
  );
}
