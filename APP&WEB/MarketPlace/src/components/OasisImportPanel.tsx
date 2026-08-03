'use client';

import { useState, useEffect } from 'react';
import { getAvatars, getQuests, getPrizeTiers, getTerritories } from '@/lib/oasis-api';
import type { AvatarDef, QuestDef, PrizeTier, Territory } from '@/lib/oasis-api';
import { useLangT } from '@/lib/useTranslation';

type SourceType = 'avatar' | 'quest' | 'prize' | 'territory';

export interface OasisArtifactDraft {
  name: string;
  description: string;
  collection: string;
  category: string;
  rarity: string;
  image: string;
  traits: { trait: string; value: string }[];
}

const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique'] as const;

function normalizeRarity(r?: string): typeof rarities[number] {
  const lower = (r ?? 'common').toLowerCase();
  return rarities.find((x) => x === lower) ?? 'common';
}

function getSourceLabel(source: SourceType, t: (path: string, params?: Record<string, string | number>) => string) {
  switch (source) {
    case 'avatar': return t('create.sourceAvatars');
    case 'quest': return t('create.sourceQuests');
    case 'prize': return t('create.sourcePrizes');
    case 'territory': return t('create.sourceTerritories');
  }
}

export default function OasisImportPanel({
  onImport,
}: {
  onImport: (draft: OasisArtifactDraft) => void;
}) {
  const [source, setSource] = useState<SourceType>('avatar');
  const [items, setItems] = useState<{ id: string; name: string; description: string; rarity: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLangT();

  useEffect(() => {
    setLoading(true);
    setError(null);
    setItems([]);

    (async () => {
      try {
        if (source === 'avatar') {
          const data = await getAvatars();
          if (!data) { setError(t('create.oasisLoadError', { source: getSourceLabel(source, t) })); return; }
          setItems(data.map((a) => ({ id: String(a.id), name: a.name, description: a.subtitle, rarity: a.rarity })));
        } else if (source === 'quest') {
          const data = await getQuests();
          if (!data) { setError(t('create.oasisLoadError', { source: getSourceLabel(source, t) })); return; }
          setItems(data.map((q) => ({ id: q.quest_id, name: q.title, description: q.description, rarity: 'rare' })));
        } else if (source === 'prize') {
          const data = await getPrizeTiers();
          if (!data) { setError(t('create.oasisLoadError', { source: getSourceLabel(source, t) })); return; }
          setItems(data.tiers.map((t) => ({ id: String(t.rank), name: t.title, description: t.unlock_condition, rarity: t.rank <= 3 ? 'mythic' : t.rank <= 10 ? 'legendary' : 'epic' })));
        } else if (source === 'territory') {
          const data = await getTerritories();
          if (!data) { setError(t('create.oasisLoadError', { source: getSourceLabel(source, t) })); return; }
          setItems(Object.values(data.territories).map((t) => ({ id: t.id, name: t.name, description: t.description, rarity: t.defense_power > 500 ? 'legendary' : t.defense_power > 100 ? 'rare' : 'uncommon' })));
        }
      } catch (e) {
        setError(t('create.oasisError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [source, t]);

  const handleSelect = (id: string) => {
    (async () => {
      if (source === 'avatar') {
        const data = await getAvatars();
        const a = data?.find((x) => String(x.id) === id);
        if (!a) return;
        onImport({
          name: a.name,
          description: `${a.subtitle} — ${a.role}. ${a.teaching}. Ability: ${a.ability}. Location: ${a.location}.`,
          collection: 'OASIS Avatars',
          category: 'avatar',
          rarity: normalizeRarity(a.rarity),
          image: '',
          traits: [
            { trait: 'Ray', value: a.ray },
            { trait: 'Role', value: a.role },
            { trait: 'Location', value: a.location },
            { trait: 'Quest Line', value: a.quest_line },
            { trait: 'Ability', value: a.ability },
            { trait: 'Consciousness Level', value: a.consciousness_level_name },
            { trait: 'Key', value: a.key },
          ],
        });
      } else if (source === 'quest') {
        const data = await getQuests();
        const q = data?.find((x) => x.quest_id === id);
        if (!q) return;
        onImport({
          name: `Quest: ${q.title}`,
          description: `${q.description}. Avatar: ${q.avatar_name}. XP reward: ${q.xp_reward}.`,
          collection: 'OASIS Quest',
          category: 'quest_item',
          rarity: 'rare',
          image: '',
          traits: [
            { trait: 'Quest ID', value: q.quest_id },
            { trait: 'Avatar', value: q.avatar_name },
            { trait: 'XP Reward', value: String(q.xp_reward) },
            { trait: 'Min CL', value: String(q.min_consciousness_level) },
          ],
        });
      } else if (source === 'prize') {
        const data = await getPrizeTiers();
        const t = data?.tiers.find((x) => String(x.rank) === id);
        if (!t) return;
        onImport({
          name: `${t.title} — Golden Egg Prize`,
          description: `Rank ${t.rank} prize: ${t.zion} ZION + ${t.flowers} FLOWERS. NFT reward: ${t.nft_reward}. Unlock: ${t.unlock_condition}.`,
          collection: 'Golden Eggs',
          category: 'golden_egg',
          rarity: normalizeRarity(t.rank <= 3 ? 'mythic' : t.rank <= 10 ? 'legendary' : 'epic'),
          image: '',
          traits: [
            { trait: 'Rank', value: String(t.rank) },
            { trait: 'ZION Reward', value: String(t.zion) },
            { trait: 'Flowers Reward', value: String(t.flowers) },
            { trait: 'NFT Reward', value: t.nft_reward },
            { trait: 'Unlock Condition', value: t.unlock_condition },
          ],
        });
      } else if (source === 'territory') {
        const data = await getTerritories();
        const t = Object.values(data?.territories ?? {}).find((x) => x.id === id);
        if (!t) return;
        onImport({
          name: `Territory: ${t.name}`,
          description: `${t.description}. Region: ${t.region}. Mining bonus: +${t.mining_bonus}%. XP bonus: +${t.xp_bonus}%. Defense power: ${t.defense_power}.`,
          collection: 'OASIS Territory',
          category: 'territory',
          rarity: normalizeRarity(t.defense_power > 500 ? 'legendary' : t.defense_power > 100 ? 'rare' : 'uncommon'),
          image: '',
          traits: [
            { trait: 'Region', value: t.region },
            { trait: 'Mining Bonus', value: `+${t.mining_bonus}%` },
            { trait: 'XP Bonus', value: `+${t.xp_bonus}%` },
            { trait: 'Defense Power', value: String(t.defense_power) },
            { trait: 'Capacity', value: String(t.capacity) },
            { trait: 'Controller', value: t.controller ?? 'Unclaimed' },
          ],
        });
      }
    })();
  };

  const sources: SourceType[] = ['avatar', 'quest', 'prize', 'territory'];

  return (
    <div className="zion-rainbow-card p-6" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
      <h2 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
        <span className="w-1 h-3 rounded-full bg-oasis-cyan" />
        {t('create.importFromOasis')}
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {sources.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSource(s)}
            className={`px-3 py-2 rounded-xl text-xs font-bold capitalize transition-all border ${
              source === s
                ? 'bg-oasis-cyan/15 border-oasis-cyan/50 text-oasis-cyan'
                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            {getSourceLabel(s, t)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-8 text-center">
          <div className="w-8 h-8 border-2 border-oasis-cyan/30 border-t-oasis-cyan rounded-full animate-spin mx-auto mb-2" />
          <div className="text-xs text-gray-500">{t('create.oasisLoading', { source: getSourceLabel(source, t) })}</div>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-oasis-rose/10 border border-oasis-rose/20 text-sm text-oasis-rose">
          {error}
        </div>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {items.length === 0 ? (
            <div className="text-sm text-gray-500 py-2">{t('create.oasisEmpty', { source: getSourceLabel(source, t) })}</div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className="w-full text-left px-4 py-3 rounded-xl bg-white/5 border border-white/5 hover:border-oasis-cyan/30 hover:bg-white/[0.07] transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white font-semibold group-hover:text-oasis-cyan transition-colors">
                    {item.name}
                  </span>
                  <span className={`rarity-badge rarity-${normalizeRarity(item.rarity)} text-[10px]`}>
                    {t(`rarity.${normalizeRarity(item.rarity)}`)}
                  </span>
                </div>
                <div className="text-xs text-gray-500 line-clamp-1 mt-0.5">{item.description}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
