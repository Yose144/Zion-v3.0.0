'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import ItemCard, { type ArtifactCardData } from '@/components/ItemCard';
import { getProfileItems, getProfileActivity, type ProfileItemsResponse, type ProfileActivity } from '@/lib/market-api';

const mockOwned: ArtifactCardData[] = [
  { id: '101', name: 'Tree of Life Avatar', image: '', collection: 'OASIS Genesis', rarity: 'mythic', price: '2,500', listingType: 'fixed' },
  { id: '102', name: 'Ship HUD Mk-III', image: '', collection: 'OASIS Ships', rarity: 'rare', listingType: 'none' },
  { id: '103', name: 'Crystal of Insight', image: '', collection: 'OASIS Quest', rarity: 'rare', price: '150', listingType: 'auction', bestBid: '180', endsAt: Date.now() + 36e5 * 2 },
];

const mockActivity: ProfileActivity[] = [
  { id: '1', type: 'Sale', item: 'Warp Gate Key', price: '900 wZION', time: '2026-07-28T10:00:00Z' },
  { id: '2', type: 'Purchase', item: 'Golden Egg #001', price: '5,000 wZION', time: '2026-07-25T10:00:00Z' },
  { id: '3', type: 'Listed', item: 'Tree of Life Avatar', price: '2,500 wZION', time: '2026-07-23T10:00:00Z' },
  { id: '4', type: 'Minted', item: 'Ship HUD Mk-III', price: '—', time: '2026-07-20T10:00:00Z' },
];

export default function ProfilePage() {
  const params = useParams<{ address: string }>();
  const { address: connected } = useAccount();
  const [tab, setTab] = useState<'owned' | 'listed' | 'activity'>('owned');
  const [profile, setProfile] = useState<ProfileItemsResponse | null>(null);
  const [activity, setActivity] = useState<ProfileActivity[] | null>(null);
  const [loading, setLoading] = useState(true);

  const addr = params.address || connected || '0x0000…0000';
  const short = `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  const isMe = connected?.toLowerCase() === addr.toLowerCase();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getProfileItems(addr), getProfileActivity(addr)]).then(([p, a]) => {
      if (cancelled) return;
      setProfile(p);
      setActivity(a ?? mockActivity);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [addr]);

  const ownedItems = useMemo((): ArtifactCardData[] => {
    const created = profile?.created.map((item) => ({
      id: item.id,
      name: item.name,
      image: item.imageUri,
      collection: item.category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      category: item.category,
      rarity: item.rarity as ArtifactCardData['rarity'],
      listingType: 'none' as const,
    })) ?? [];
    return created.length > 0 ? created : mockOwned;
  }, [profile]);

  const listedItems = useMemo((): ArtifactCardData[] => {
    if (!profile?.listed.length) return mockOwned.filter((i) => i.listingType !== 'none');
    return profile.listed.map((l) => ({
      id: l.artifact.id,
      name: l.artifact.name,
      image: l.artifact.imageUri,
      collection: l.artifact.category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      category: l.artifact.category,
      rarity: l.artifact.rarity as ArtifactCardData['rarity'],
      price: l.price,
      listingType: l.saleType as 'fixed' | 'auction' | 'none',
    }));
  }, [profile]);

  const stats = profile?.stats ?? {
    owned: ownedItems.length,
    listedCount: listedItems.length,
    volume: '0',
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div
        className="zion-rainbow-card p-6"
        style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-oasis-cyan via-oasis-purple to-oasis-gold flex items-center justify-center text-3xl font-black text-oasis-black font-display">
              {addr.slice(2, 4).toUpperCase()}
            </div>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-oasis-cyan via-oasis-purple to-oasis-gold blur-lg opacity-30" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-black text-white mb-2 font-mono">{short}</h1>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <a
                href={`https://basescan.org/address/${addr}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-oasis-cyan transition-colors flex items-center gap-1"
              >
                View on Basescan ↗
              </a>
              {isMe && <span className="rarity-badge rarity-unique">You</span>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-2xl font-black text-oasis-cyan font-display">{stats.owned}</div>
              <div className="text-xs text-gray-500">Owned</div>
            </div>
            <div>
              <div className="text-2xl font-black text-gradient-gold font-display">{stats.listedCount}</div>
              <div className="text-xs text-gray-500">Listed</div>
            </div>
            <div>
              <div className="text-2xl font-black text-oasis-emerald font-display">{stats.volume}</div>
              <div className="text-xs text-gray-500">Volume</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/5">
        {(['owned', 'listed', 'activity'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`tab-zion ${tab === t ? 'tab-zion-active' : 'tab-zion-inactive'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="zion-section p-16 text-center">
          <div className="w-10 h-10 border-2 border-oasis-cyan/30 border-t-oasis-cyan rounded-full animate-spin mx-auto mb-4" />
          <div className="text-gray-500">Loading profile…</div>
        </div>
      ) : (
        <>
          {tab === 'owned' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {ownedItems.map((item, i) => (
                <div key={item.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
                  <ItemCard item={item} />
                </div>
              ))}
            </div>
          )}

          {tab === 'listed' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {listedItems.map((item, i) => (
                <div key={item.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
                  <ItemCard item={item} />
                </div>
              ))}
            </div>
          )}

          {tab === 'activity' && (
            <div className="zion-section p-5">
              <div className="space-y-1">
                {(activity ?? mockActivity).map((a, i) => (
                  <div key={a.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className={`status-dot ${
                        a.type === 'Sale' || a.type === 'Purchase' ? 'status-active' :
                        a.type === 'Listed' ? 'status-pending' : 'status-inactive'
                      }`} />
                      <span className="text-sm text-white font-semibold">{a.type}</span>
                      <span className="text-sm text-gray-400">{a.item}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gradient-gold font-mono">{a.price}</span>
                      <span className="text-xs text-gray-600">{formatTime(a.time)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}
