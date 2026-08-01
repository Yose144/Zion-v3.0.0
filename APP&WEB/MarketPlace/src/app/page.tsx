import Link from 'next/link';

const categories = [
  { name: 'Avatars', desc: 'Playable OASIS characters', icon: '🧬', rarity: 'unique' },
  { name: 'Ships', desc: 'Warp-capable vessels', icon: '🚀', rarity: 'legendary' },
  { name: 'Quest Items', desc: 'Earned through OASIS quests', icon: '⚔️', rarity: 'epic' },
  { name: 'Territory', desc: 'Land deeds in the OASIS world', icon: '🗺️', rarity: 'rare' },
  { name: 'Golden Eggs', desc: 'Limited mythic treasures', icon: '🥚', rarity: 'mythic' },
  { name: 'Cosmetics', desc: 'Skins, trails, effects', icon: '✨', rarity: 'uncommon' },
];

const featured = [
  { name: 'Tree of Life Avatar', collection: 'OASIS Genesis', rarity: 'mythic', price: '2.5', img: '' },
  { name: 'Warp Gate Key', collection: 'OASIS Quest', rarity: 'legendary', price: '0.8', img: '' },
  { name: 'Galaxy Core Shard', collection: 'OASIS Genesis', rarity: 'epic', price: '0.35', img: '' },
  { name: 'Ship HUD Mk-III', collection: 'OASIS Ships', rarity: 'rare', price: '0.12', img: '' },
];

export default function HomePage() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="text-center pt-8 pb-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-400 mb-6">
          <span className="status-dot status-active" />
          Live on Base L2 · ERC-1155
        </div>
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight mb-6">
          <span className="text-gradient">OASIS Artifact</span>
          <br />
          <span className="text-white">Marketplace</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
          Trade avatars, ships, quest items, territory deeds, and Golden Eggs from the
          ZION OASIS universe. Powered by Base L2 for fast, low-cost transactions.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/explore" className="btn-primary">
            Explore Market
          </Link>
          <Link href="/create" className="btn-secondary">
            Create Listing
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Items Listed', value: '12,847', accent: 'text-oasis-cyan' },
          { label: 'Total Volume', value: '847 ETH', accent: 'text-gradient-gold' },
          { label: 'Active Auctions', value: '34', accent: 'text-oasis-purple' },
          { label: 'Holders', value: '2,193', accent: 'text-oasis-emerald' },
        ].map((s) => (
          <div key={s.label} className="card p-5 text-center">
            <div className={`text-2xl md:text-3xl font-black mb-1 ${s.accent}`}>{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </section>

      {/* Categories */}
      <section>
        <h2 className="text-2xl font-black mb-6">
          <span className="text-gradient">Categories</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.name}
              href={`/explore?category=${cat.name.toLowerCase().replace(/\s+/g, '-')}`}
              className="glass-panel group"
            >
              <div className="glass-panel-inner text-center py-6">
                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">
                  {cat.icon}
                </div>
                <div className="font-bold text-sm text-white mb-1">{cat.name}</div>
                <div className="text-[11px] text-gray-500">{cat.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black">
            <span className="text-gradient">Featured</span>
          </h2>
          <Link href="/explore" className="text-sm text-oasis-cyan hover:underline">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {featured.map((item) => (
            <div key={item.name} className="glass-panel">
              <div className="glass-panel-inner">
                <div className="aspect-square rounded-xl bg-gradient-to-br from-oasis-purple/20 via-oasis-cyan/10 to-oasis-gold/10 mb-3 flex items-center justify-center text-4xl">
                  <span className="text-gradient font-black">Z</span>
                </div>
                <div className="text-xs text-gray-500 mb-0.5">{item.collection}</div>
                <h3 className="font-bold text-white text-sm mb-2 line-clamp-1">{item.name}</h3>
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <span className={`rarity-badge rarity-${item.rarity}`}>{item.rarity}</span>
                  <span className="font-mono text-sm text-gradient-gold font-bold">
                    {item.price} ETH
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="glass-panel">
        <div className="glass-panel-inner text-center py-12">
          <h2 className="text-3xl font-black mb-3">
            <span className="text-gradient">Built for the OASIS universe</span>
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto mb-6">
            Every artifact minted on ZION Market is usable in OASIS. Complete quests,
            earn items, trade them here. Your assets, your world.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a href="https://oasis.zionterranova.com" className="btn-primary">
              Enter OASIS
            </a>
            <a href="https://discord.gg/uq4Az97hG" className="btn-secondary">
              Join Discord
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
