import MinerClient from './MinerClient';
import { DEMO_WALLETS } from '@/lib/mock';

export function generateStaticParams() {
  return Object.entries(DEMO_WALLETS).map(([coin, wallet]) => ({
    coin,
    wallet,
  }));
}

export default function MinerPage({
  params,
}: {
  params: { coin: string; wallet: string };
}) {
  return <MinerClient coin={params.coin} wallet={params.wallet} />;
}
