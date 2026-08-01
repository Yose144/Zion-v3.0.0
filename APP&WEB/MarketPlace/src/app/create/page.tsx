'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { Zap, Gavel, Lock, X, Wallet } from 'lucide-react';
import OasisImportPanel, { type OasisArtifactDraft } from '@/components/OasisImportPanel';
import { useMintArtifact, useSetApprovalForAll, useIsApprovedForAll, useCreateListing, useCreateAuction } from '@/hooks/useMarket';

const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique'] as const;
const collections = ['OASIS Genesis', 'OASIS Quest', 'OASIS Ships', 'OASIS Territory', 'Golden Eggs', 'OASIS Cosmetics'];

type Rarity = typeof rarities[number];

export default function CreatePage() {
  const { isConnected, address } = useAccount();
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
  const [error, setError] = useState<string | null>(null);

  const { mint: mintNft, isPending: minting } = useMintArtifact();
  const { create: createListing, isPending: listing } = useCreateListing();
  const { create: createAuction, isPending: auctioning } = useCreateAuction();
  const { approve: approveAll, isPending: approving } = useSetApprovalForAll();
  const { data: isApproved } = useIsApprovedForAll(address as `0x${string}` | undefined);

  const updateTrait = (i: number, field: 'trait' | 'value', val: string) => {
    const next = [...traits];
    next[i][field] = val;
    setTraits(next);
  };
  const addTrait = () => setTraits([...traits, { trait: '', value: '' }]);
  const removeTrait = (i: number) => setTraits(traits.filter((_, idx) => idx !== i));

  const handleOasisImport = (draft: OasisArtifactDraft) => {
    setName(draft.name);
    setDescription(draft.description);
    if (collections.includes(draft.collection)) {
      setCollection(draft.collection);
    }
    setRarity(draft.rarity as Rarity);
    setImageUrl(draft.image);
    if (draft.traits.length > 0) {
      setTraits(draft.traits);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address) return;
    setSubmitting(true);
    setError(null);

    try {
      const attributes = traits
        .filter((t) => t.trait.trim() && t.value.trim())
        .map((t) => ({ trait_type: t.trait, value: t.value }));

      const metadataRes = await fetch('/api/ipfs/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          image: imageUrl,
          attributes,
          properties: {
            category: collection.toLowerCase().replace(/\s+/g, '_'),
            rarity,
            collection,
            source: 'marketplace',
          },
        }),
      });
      const metadataJson = (await metadataRes.json()) as { success: boolean; ipfsUrl?: string; error?: string };
      if (!metadataRes.ok || !metadataJson.success) {
        throw new Error(metadataJson.error ?? 'IPFS upload failed');
      }

      const tokenId = BigInt(Date.now());
      const category = collection.toLowerCase().replace(/\s+/g, '_');

      await mintNft({
        to: address,
        tokenId,
        amount: 1n,
        category,
        rarity,
      });

      if (!isApproved) {
        await approveAll();
      }

      if (listingType === 'fixed') {
        await createListing({
          tokenId,
          quantity: 1n,
          pricePerItem: price,
          expiryHours: undefined,
        });
      } else if (listingType === 'auction') {
        await createAuction({
          tokenId,
          quantity: 1n,
          startingPrice: price,
          durationHours: Number(auctionDuration) || 24,
        });
      }

      router.push('/explore');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="card max-w-md mx-auto mt-20 p-8 text-center">
        <Wallet className="w-16 h-16 mx-auto mb-4 opacity-40" />
        <h2 className="text-xl font-bold mb-2 font-display">Connect your wallet</h2>
        <p className="text-sm text-gray-400">Connect to Base L2 to create a listing.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <div className="zion-kicker mb-3">Mint</div>
        <h1 className="text-3xl font-black font-display mb-1">
          <span className="text-gradient">Create</span> <span className="text-white">Listing</span>
        </h1>
        <p className="text-sm text-gray-500">Mint a new OASIS artifact and list it for sale</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-oasis-rose/10 border border-oasis-rose/20 text-sm text-oasis-rose">
          {error}
        </div>
      )}

      <OasisImportPanel onImport={handleOasisImport} />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Asset */}
        <section
          className="zion-rainbow-card p-6 space-y-5"
          style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
        >
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
        <section className="zion-section p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
              <span className="w-1 h-3 rounded-full bg-oasis-purple" />
              Properties
            </h2>
            <button type="button" onClick={addTrait} className="zion-button-ghost text-xs px-3 py-1.5">
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
                  className="zion-button-icon zion-button-ghost text-oasis-rose"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </section>

        {/* Listing */}
        <section className="zion-section p-6 space-y-5">
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
                {t === 'fixed' ? (
                <span className="inline-flex items-center gap-1.5">
                  <Zap className="w-4 h-4" /> Fixed Price
                </span>
              ) : t === 'auction' ? (
                <span className="inline-flex items-center gap-1.5">
                  <Gavel className="w-4 h-4" /> Auction
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="w-4 h-4" /> Not for sale
                </span>
              )}
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
          disabled={submitting || minting || listing || auctioning || approving}
          className="zion-button-primary w-full text-lg py-3.5 disabled:opacity-50"
        >
          {submitting || minting || listing || auctioning || approving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {minting ? 'Minting…' : listing || auctioning ? 'Creating listing…' : approving ? 'Approving…' : 'Minting + listing…'}
            </span>
          ) : 'Create Listing'}
        </button>
      </form>
    </div>
  );
}
