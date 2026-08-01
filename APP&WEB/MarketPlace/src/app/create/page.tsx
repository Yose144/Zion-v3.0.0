'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';

const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique'] as const;
const collections = ['OASIS Genesis', 'OASIS Quest', 'OASIS Ships', 'OASIS Territory', 'Golden Eggs', 'OASIS Cosmetics'];

type Rarity = typeof rarities[number];

export default function CreatePage() {
  const { isConnected } = useAccount();
  const router = useRouter();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [collection, setCollection] = useState(collections[0]);
  const [rarity, setRarity] = useState<Rarity>('rare');
  const [imageUrl, setImageUrl] = useState('');
  const [listingType, setListingType] = useState<'fixed' | 'auction' | 'none'>('fixed');
  const [price, setPrice] = useState('');
  const [auctionDuration, setAuctionDuration] = useState('24');
  const [traits, setTraits] = useState([{ trait: '', value: '' }]);
  const [submitting, setSubmitting] = useState(false);

  const updateTrait = (i: number, field: 'trait' | 'value', val: string) => {
    const next = [...traits];
    next[i][field] = val;
    setTraits(next);
  };
  const addTrait = () => setTraits([...traits, { trait: '', value: '' }]);
  const removeTrait = (i: number) => setTraits(traits.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return;
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1500));
    setSubmitting(false);
    router.push('/explore');
  };

  if (!isConnected) {
    return (
      <div className="glass-panel max-w-md mx-auto mt-20">
        <div className="glass-panel-inner text-center py-16">
          <div className="text-5xl mb-4 opacity-40">🔐</div>
          <h2 className="text-xl font-bold mb-2 font-display">Connect your wallet</h2>
          <p className="text-sm text-gray-400">Connect to Base L2 to create a listing.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-black font-display mb-1">
          <span className="text-gradient">Create</span> <span className="text-white">Listing</span>
        </h1>
        <p className="text-sm text-gray-500">Mint a new OASIS artifact and list it for sale</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Asset */}
        <section className="card p-6 space-y-5">
          <h2 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
            <span className="w-1 h-3 rounded-full bg-oasis-cyan" />
            Asset
          </h2>

          <div>
            <label className="block text-sm font-semibold mb-2">Name *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tree of Life Avatar"
              className="input-zion"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe your artifact…"
              className="input-zion resize-none"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Collection *</label>
              <select
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
                className="input-zion"
              >
                {collections.map(c => (
                  <option key={c} value={c} className="bg-zion-card">{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Rarity *</label>
              <div className="flex flex-wrap gap-2">
                {rarities.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRarity(r)}
                    className={`rarity-badge rarity-${r} cursor-pointer transition-all duration-200 ${
                      rarity === r ? 'ring-2 ring-white/40 scale-105' : 'opacity-50 hover:opacity-100'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Image URL / IPFS</label>
            <div className="flex gap-3">
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="ipfs://… or https://…"
                className="input-zion flex-1"
              />
              {imageUrl && (
                <div className="w-20 h-20 rounded-xl overflow-hidden artifact-placeholder flex items-center justify-center flex-shrink-0">
                  <img src={imageUrl} alt="preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Traits */}
        <section className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
              <span className="w-1 h-3 rounded-full bg-oasis-purple" />
              Properties
            </h2>
            <button type="button" onClick={addTrait} className="btn-ghost text-xs px-3 py-1.5">
              + Add trait
            </button>
          </div>
          {traits.map((t, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={t.trait}
                onChange={(e) => updateTrait(i, 'trait', e.target.value)}
                placeholder="Trait (e.g. Class)"
                className="input-zion flex-1"
              />
              <input
                value={t.value}
                onChange={(e) => updateTrait(i, 'value', e.target.value)}
                placeholder="Value (e.g. Avatar)"
                className="input-zion flex-1"
              />
              {traits.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTrait(i)}
                  className="btn-icon btn-ghost text-oasis-rose"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </section>

        {/* Listing */}
        <section className="card p-6 space-y-5">
          <h2 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
            <span className="w-1 h-3 rounded-full bg-oasis-gold" />
            Listing
          </h2>
          <div className="flex gap-2">
            {(['fixed', 'auction', 'none'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setListingType(t)}
                className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  listingType === t
                    ? 'bg-oasis-purple/20 text-white border border-oasis-purple/40'
                    : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                }`}
              >
                {t === 'fixed' ? '⚡ Fixed Price' : t === 'auction' ? '🔨 Auction' : '🔒 Not for sale'}
              </button>
            ))}
          </div>

          {listingType === 'fixed' && (
            <div>
              <label className="block text-sm font-semibold mb-2">Price (wZION) *</label>
              <input
                required={listingType === 'fixed'}
                type="number"
                step="0.001"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.05"
                className="input-zion"
              />
            </div>
          )}

          {listingType === 'auction' && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Starting Price (wZION) *</label>
                <input
                  required={listingType === 'auction'}
                  type="number"
                  step="0.001"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.05"
                  className="input-zion"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Duration (hours)</label>
                <input
                  type="number"
                  min="1"
                  value={auctionDuration}
                  onChange={(e) => setAuctionDuration(e.target.value)}
                  className="input-zion"
                />
              </div>
            </div>
          )}
        </section>

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full text-lg py-3.5 disabled:opacity-50"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Minting + listing…
            </span>
          ) : 'Create Listing'}
        </button>
      </form>
    </div>
  );
}
