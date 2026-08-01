import Link from 'next/link';
import { UserCircle, Rocket, Swords, Map, Egg, Sparkles, type LucideIcon } from 'lucide-react';
import { type ArtifactCardData } from '@/components/ItemCard';

const categories: {
  name: string;
  desc: string;
  icon: LucideIcon;
  rarity: ArtifactCardData['rarity'];
  count: string;
}[] = [
  { name: 'Avatars', desc: 'Playable OASIS characters', icon: UserCircle, rarity: 'unique', count: '2.1k' },
  { name: 'Ships', desc: 'Warp-capable vessels', icon: Rocket, rarity: 'legendary', count: '847' },
  { name: 'Quest Items', desc: 'Earned through OASIS quests', icon: Swords, rarity: 'epic', count: '5.3k' },
  { name: 'Territory', desc: 'Land deeds in the OASIS world', icon: Map, rarity: 'rare', count: '312' },
  { name: 'Golden Eggs', desc: 'Limited mythic treasures', icon: Egg, rarity: 'mythic', count: '24' },
  { name: 'Cosmetics', desc: 'Skins, trails, effects', icon: Sparkles, rarity: 'uncommon', count: '4.2k' },
];

const rarityColor: Record<ArtifactCardData['rarity'], string> = {
  common: '163, 163, 177',
  uncommon: '16, 185, 129',
  rare: '59, 130, 246',
  epic: '147, 51, 234',
  legendary: '255, 215, 0',
  mythic: '244, 63, 94',
  unique: '6, 182, 212',
};

export default function CategoriesSection() {
  return (
    <section>
      <div className="flex items-center gap-4 mb-6">
        <div className="zion-kicker">Browse</div>
        <h2 className="text-2xl font-black font-display text-gradient">Categories</h2>
        <div className="section-line flex-1" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <Link
              key={cat.name}
              href={`/explore?category=${cat.name.toLowerCase().replace(/\s+/g, '-')}`}
              className="zion-rainbow-sub group p-5 text-center"
              style={{ '--rc': rarityColor[cat.rarity] } as React.CSSProperties}
            >
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform duration-300">
                <Icon className="w-6 h-6" style={{ color: `rgb(${rarityColor[cat.rarity]})` }} />
              </div>
              <div className="font-bold text-sm text-white mb-1">{cat.name}</div>
              <div className="text-[11px] text-gray-400 mb-3 leading-tight">{cat.desc}</div>
              <div className="flex items-center justify-center gap-2">
                <span className={`rarity-badge rarity-${cat.rarity}`}>{cat.rarity}</span>
                <span className="text-[10px] text-gray-500 font-mono">{cat.count}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
