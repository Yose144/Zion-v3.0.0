import type { Metadata } from 'next';
import MainnetBetaClient from './MainnetBetaClient';

export const metadata: Metadata = {
  alternates: { canonical: '/news/mainnet-beta' },
  title: 'ZION v3.2 "One Love" — Mainnet Beta | Novinky · ZION TerraNova',
  description:
    'ZION v3.2.0 "One Love" přechází do Mainnet Beta: multichain mining pool ZION/QTC/PEARL, kompletní mapa L5 Free World a nová kniha Maitreya. Beta je testovací stupeň — Stable vyžaduje G8, externí audit a DR drill.',
};

export default function MainnetBetaPage() {
  return <MainnetBetaClient />;
}
