import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ZionDex — Cross-Chain DEX | ZION Terranova',
  description: 'Swap any token on any chain. Powered by native L1 bridge + custom AMM.',
};

export default function DexLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] via-[#0d0d18] to-[#0a0a0f]">
      {children}
    </div>
  );
}
