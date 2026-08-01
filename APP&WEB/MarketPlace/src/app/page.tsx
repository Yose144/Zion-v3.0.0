import Link from 'next/link';

const categories = [
  { name: 'Avatars', desc: 'Playable OASIS characters', icon: '🧬', rarity: 'unique', count: '2.1k' },
  { name: 'Ships', desc: 'Warp-capable vessels', icon: '🚀', rarity: 'legendary', count: '847' },
  { name: 'Quest Items', desc: 'Earned through OASIS quests', icon: '⚔️', rarity: 'epic', count: '5.3k' },
  { name: 'Territory', desc: 'Land deeds in the OASIS world', icon: '🗺️', rarity: 'rare', count: '312' },
  { name: 'Golden Eggs', desc: 'Limited mythic treasures', icon: '🥚', rarity: 'mythic', count: '24' },
  { name: 'Cosmetics', desc: 'Skins, trails, effects', icon: '✨', rarity: 'uncommon', count: '4.2k' },
];

const featured = [
  { id: '1', name: 'Tree of Life Avatar', collection: 'OASIS Genesis', rarity: 'mythic', price: '2,500', img: '' },
  { id: '2', name: 'Warp Gate Key', collection: 'OASIS Quest', rarity: 'legendary', price: '800', img: '' },
  { id: '3', name: 'Galaxy Core Shard', collection: 'OASIS Genesis', rarity: 'epic', price: '350', img: '' },
  { id: '4', name: 'Ship HUD Mk-III', collection: 'OASIS Ships', rarity: 'rare', price: '120', img: '' },
];

export default function HomePage() {
  return (
    <div className="space-y-20">
      {/* ── Hero ── */}
      <section className="text-center pt-12 pb-8 relative">
        {/* Floating orbs */}
        <div className="absolute top-0 left-1/4 w-32 h-32 rounded-full bg-oasis-cyan/10 blur-3xl animate-float-slow" />
        <div className="absolute top-20 right-1/4 w-40 h-40 rounded-full bg-oasis-purple/10 blur-3xl animate-float" />
        <div className="absolute bottom-0 left-1/3 w-24 h-24 rounded-full bg-oasis-gold/10 blur-3xl animate-float-slow" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-400 mb-8 animate-fade-in">
            <span className="status-dot status-active" />
            Live on Base L2 · ERC-1155 · Hybrid L1/L2 Payment
          </div>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight mb-6 font-display animate-fade-in-up">
            <span className="text-gradient-animated">OASIS Artifact</span>
            <br />
            <span className="text-white">Marketplace</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            Trade avatars, ships, quest items, territory deeds, and Golden Eggs from the
            ZION OASIS universe. Pay with wZION on L2 or native ZION on L1.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <Link href="/explore" className="btn-primary text-base px-7 py-3">
              Explore Market
            </Link>
            <Link href="/create" className="btn-secondary text-base px-7 py-3">
              Create Listing
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Items Listed', value: '12,847', accent: 'text-oasis-cyan', icon: '📦' },
          { label: 'Total Volume', value: '847k wZION', accent: 'text-gradient-gold', icon: '📊' },
          { label: 'Active Auctions', value: '34', accent: 'text-oasis-purple', icon: '🔨' },
          { label: 'Holders', value: '2,193', accent: 'text-oasis-emerald', icon: '👥' },
        ].map((s, i) => (
          <div key={s.label} className="card-glow p-5 text-center animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="text-2xl mb-2 opacity-50">{s.icon}</div>
            <div className={`text-2xl md:text-3xl font-black mb-1 ${s.accent}`}>{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </section>

      {/* ── Categories ── */}
      <section>
        <div className="flex items-center gap-4 mb-8">
          <h2 className="text-2xl font-black font-display">
            <span className="text-gradient">Categories</span>
          </h2>
          <div className="section-line flex-1" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((cat, i) => (
            <Link
              key={cat.name}
              href={`/explore?category=${cat.name.toLowerCase().replace(/\s+/g, '-')}`}
              className="glass-panel group animate-scale-in"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="glass-panel-inner text-center py-6">
                <div className="text-3xl mb-3 group-hover:scale-125 transition-transform duration-300">
                  {cat.icon}
                </div>
                <div className="font-bold text-sm text-white mb-1">{cat.name}</div>
                <div className="text-[11px] text-gray-500 mb-2">{cat.desc}</div>
                <div className="flex items-center justify-center gap-2">
                  <span className={`rarity-badge rarity-${cat.rarity}`}>{cat.rarity}</span>
                  <span className="text-[10px] text-gray-600 font-mono">{cat.count}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Featured ── */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-black font-display">
              <span className="text-gradient">Featured</span>
            </h2>
            <div className="section-line w-24" />
          </div>
          <Link href="/explore" className="text-sm text-oasis-cyan hover:underline">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {featured.map((item, i) => (
            <Link
              key={item.name}
              href={`/item/${item.id}`}
              className="glass-panel group animate-fade-in-up"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="glass-panel-inner">
                <div className="relative aspect-square rounded-xl artifact-placeholder overflow-hidden mb-3 flex items-center justify-center">
                  <span className="text-5xl text-gradient font-black font-display relative z-10 group-hover:scale-110 transition-transform duration-500">
                    Z
                  </span>
                  <div className="absolute top-2 left-2">
                    <span className={`rarity-badge rarity-${item.rarity}`}>{item.rarity}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mb-0.5">{item.collection}</div>
                <h3 className="font-bold text-white text-sm mb-2 line-clamp-1">{item.name}</h3>
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <span className="text-xs text-gray-500">Price</span>
                  <span className="font-mono text-sm text-gradient-gold font-bold">
                    {item.price} wZION
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section>
        <div className="flex items-center gap-4 mb-8">
          <h2 className="text-2xl font-black font-display">
            <span className="text-gradient">How It Works</span>
          </h2>
          <div className="section-line flex-1" />
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { step: '01', title: 'Connect & Browse', desc: 'Connect your Base L2 wallet and explore OASIS artifacts. Filter by rarity, collection, or listing type.', icon: '🔗' },
            { step: '02', title: 'Buy or Bid', desc: 'Pay with wZION on L2 for instant settlement, or send native ZION on L1 with a memo for hybrid settlement.', icon: '⚡' },
            { step: '03', title: 'Use in OASIS', desc: 'Every artifact is usable in the OASIS game universe. Equip avatars, fly ships, claim territory.', icon: '🎮' },
          ].map((s, i) => (
            <div key={s.step} className="card p-6 animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
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
      <section className="glass-panel">
        <div className="glass-panel-inner text-center py-16 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-oasis-purple/10 blur-3xl" />
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-black mb-4 font-display">
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
          </div>
        </div>
      </section>
    </div>
  );
}
