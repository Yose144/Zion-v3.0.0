import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ZionDex — Cross-Chain DEX | ZION Terranova',
  description: 'Swap any token on any chain. Powered by native L1 bridge + custom AMM.',
};

export default function DexLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black">
      {children}
    </div>
  );
}
