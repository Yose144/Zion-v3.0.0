import TopMiners from '@/components/TopMiners';
import MinersHero from './MinersHero';

export default function MinersPage() {
  return (
    <div className="pt-8">
      <MinersHero />
      {/* Global leaderboard — every miner's dominant stream, ranked.
          Wallets arrive masked server-side; rig labels stay visible. */}
      <TopMiners limit={50} />
    </div>
  );
}
