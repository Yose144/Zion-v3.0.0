import Link from 'next/link';

const categories = [
  { name: 'Avatars', desc: 'Playable OASIS characters', icon: '🧬', rarity: 'unique' as const, count: '2.1k', rc: '6, 182, 212' },
  { name: 'Ships', desc: 'Warp-capable vessels', icon: '🚀', rarity: 'legendary' as const, count: '847', rc: '255, 215, 0' },
  { name: 'Quest Items', desc: 'Earned through OASIS quests', icon: '⚔️', rarity: 'epic' as const, count: '5.3k', rc: '147, 51, 234' },
  { name: 'Territory', desc: 'Land deeds in the OASIS world', icon: '🗺️', rarity: 'rare' as const, count: '312', rc: '59, 130, 246' },
  { name: 'Golden Eggs', desc: 'Limited mythic treasures', icon: '🥚', rarity: 'mythic' as const, count: '24', rc: '244, 63, 94' },
  { name: 'Cosmetics', desc: 'Skins, trails, effects', icon: '✨', rarity: 'uncommon' as const, count: '4.2k', rc: '16, 185, 129' },
];

const featured = [
  { id: '1', name: 'Tree of Life Avatar', collection: 'OASIS Genesis', rarity: 'mythic' as const, price: '2,500', img: '', rc: '244, 63, 94' },
  { id: '2', name: 'Warp Gate Key', collection: 'OASIS Quest', rarity: 'legendary' as const, price: '800', img: '', rc: '255, 215, 0' },
  { id: '3', name: 'Galaxy Core Shard', collection: 'OASIS Genesis', rarity: 'epic' as const, price: '350', img: '', rc: '147, 51, 234' },
  { id: '4', name: 'Ship HUD Mk-III', collection: 'OASIS Ships', rarity: 'rare' as const, price: '120', img: '', rc: '59, 130, 246' },
];

const stats = [
  { label: 'Items Listed', value: '12,847', icon: '📦', rc: '6, 182, 212' },
  { label: 'Total Volume', value: '847k', sub: 'wZION', icon: '📊', rc: '255, 215, 0' },
  { label: 'Active Auctions', value: '34', icon: '🔨', rc: '147, 51, 234' },
  { label: 'Holders', value: '2,193', icon: '👥', rc: '16, 185, 129' },
];

const steps = [
  { step: '01', title: 'Connect & Browse', desc: 'Connect your Base L2 wallet and explore OASIS artifacts. Filter by rarity, collection, or listing type.', icon: '🔗', rc: '6, 182, 212' },
  { step: '02', title: 'Buy or Bid', desc: 'Pay with wZION on L2 for instant settlement, or send native ZION on L1 with a memo for hybrid settlement.', icon: '⚡', rc: '147, 51, 234' },
  { step: '03', title: 'Use in OASIS', desc: 'Every artifact is usable in the OASIS game universe. Equip avatars, fly ships, claim territory.', icon: '🎮', rc: '255, 215, 0' },
];

export default function HomePage() {
  return (
    <div className="space-y-16 md:space-y-20">
      {/* ── Hero ── */}
      <section
        className="zion-rainbow-card p-8 md:p-12 text-center"
        style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
      >
        <div className="zion-kicker mb-6">
          <span className="status-dot status-active" />
          Live on Base L2 · ERC-1155
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight mb-5 font-display">
          <span className="text-gradient-animated">OASIS Artifact</span>
          <br />
          <span className="text-white">Marketplace</span>
        </h1>
        <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto mb-8 leading-relaxed">
          Trade avatars, ships, quest items, territory deeds, and Golden Eggs from the
          ZION OASIS universe. Pay with wZION on L2 or native ZION on L1.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/explore" className="btn-primary text-base px-7 py-3">
            Explore Market
          </Link>
          <Link href="/create" className="btn-secondary text-base px-7 py-3">
            Create Listing
          </Link>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="zion-rainbow-card p-5 text-center"
            style={{ '--rc': s.rc, animationDelay: `${i * 0.05}s` } as React.CSSProperties}
          >
            <div className="text-2xl mb-2 opacity-60">{s.icon}</div>
            <div className="text-2xl md:text-3xl font-black mb-1 font-mono">
              <span className="text-gradient">{s.value}</span>
              {s.sub && <span className="text-sm text-gray-500 ml-1">{s.sub}</span>}
            </div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </section>

      {/* ── Categories ── */}
      <section>
        <div className="flex items-center gap-4 mb-6">
          <div className="zion-kicker">Browse</div>
          <h2 className="text-2xl font-black font-display text-gradient">Categories</h2>
          <div className="section-line flex-1" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((cat, i) => (
            <Link
              key={cat.name}
              href={`/explore?category=${cat.name.toLowerCase().replace(/\s+/g, '-')}`}
              className="zion-rainbow-card group p-5 text-center"
              style={{ '--rc': cat.rc, animationDelay: `${i * 0.05}s` } as React.CSSProperties}
            >
              <div className="text-3xl mb-3 group-hover:scale-125 transition-transform duration-300">
                {cat.icon}
              </div>
              <div className="font-bold text-sm text-white mb-1">{cat.name}</div>
              <div className="text-[11px] text-gray-500 mb-3 leading-tight">{cat.desc}</div>
              <div className="flex items-center justify-center gap-2">
                <span className={`rarity-badge rarity-${cat.rarity}`}>{cat.rarity}</span>
                <span className="text-[10px] text-gray-600 font-mono">{cat.count}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Featured ── */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="zion-kicker">Curated</div>
            <h2 className="text-2xl font-black font-display text-gradient">Featured</h2>
          </div>
          <Link href="/explore" className="text-sm text-oasis-cyan hover:underline font-semibold">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {featured.map((item, i) => (
            <Link
              key={item.name}
              href={`/item/${item.id}`}
              className="zion-rainbow-card group p-4"
              style={{ '--rc': item.rc, animationDelay: `${i * 0.08}s` } as React.CSSProperties}
            >
              <div className="relative aspect-square rounded-xl artifact-placeholder overflow-hidden mb-3 flex items-center justify-center">
                <span className="text-5xl text-gradient font-black font-display relative z-10 group-hover:scale-110 transition-transform duration-500">
                  Z
                </span>
                <div className="absolute top-2 left-2 z-20">
                  <span className={`rarity-badge rarity-${item.rarity}`}>{item.rarity}</span>
                </div>
              </div>
              <div className="text-xs text-gray-500 mb-0.5">{item.collection}</div>
              <h3 className="font-bold text-white text-sm mb-2 line-clamp-1 group-hover:text-oasis-cyan transition-colors">
                {item.name}
              </h3>
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <span className="text-xs text-gray-500">Price</span>
                <span className="font-mono text-sm text-gradient-gold font-bold">
                  {item.price} <span className="text-gray-500 text-xs">wZION</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section>
        <div className="flex items-center gap-4 mb-6">
          <div className="zion-kicker">Guide</div>
          <h2 className="text-2xl font-black font-display text-gradient">How It Works</h2>
          <div className="section-line flex-1" />
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {steps.map((s, i) => (
            <div
              key={s.step}
              className="zion-rainbow-card p-6"
              style={{ '--rc': s.rc, animationDelay: `${i * 0.1}s` } as React.CSSProperties}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl">{s.icon}</span>
                <span className="text-3xl font-black text-white/5 font-mono">{s.step}</span>
              </div>
              <h3 className="font-bold text-white text-lg mb-2 font-display">{s.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="zion-cta-banner">
        <h2 className="text-2xl md:text-3xl font-black mb-4 font-display">
          <span className="text-gradient-animated">Built for the OASIS universe</span>
        </h2>
        <p className="text-gray-400 max-w-xl mx-auto mb-8 leading-relaxed">
          Every artifact minted on ZION Market is usable in OASIS. Complete quests,
          earn items, trade them here. Your assets, your world.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a href="https://oasis.zionterranova.com" className="btn-primary text-base px-7 py-3">
            Enter OASIS
          </a>
          <a href="https://discord.gg/uq4Az97hG" className="btn-secondary text-base px-7 py-3">
            Join Discord
          </a>
        </div>
      </section>
    </div>
  );
}
