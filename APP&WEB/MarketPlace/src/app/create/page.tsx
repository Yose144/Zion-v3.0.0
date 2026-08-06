'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { Zap, Gavel, Lock, X, Wallet } from 'lucide-react';
import OasisImportPanel, { type OasisArtifactDraft } from '@/components/OasisImportPanel';
import { useMintArtifact, useSetApprovalForAll, useIsApprovedForAll, useCreateListing, useCreateAuction } from '@/hooks/useMarket';
import { useLangT } from '@/lib/useTranslation';

const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique'] as const;
const collections = ['OASIS Genesis', 'OASIS Quest', 'OASIS Ships', 'OASIS Territory', 'Golden Eggs', 'OASIS Cosmetics'];

function getCollectionLabelKey(c: string) {
  switch (c) {
    case 'OASIS Genesis': return 'collections.oasisGenesis';
    case 'OASIS Quest': return 'collections.oasisQuest';
    case 'OASIS Ships': return 'collections.oasisShips';
    case 'OASIS Territory': return 'collections.oasisTerritory';
    case 'Golden Eggs': return 'collections.goldenEggs';
    case 'OASIS Cosmetics': return 'collections.oasisCosmetics';
    default: return c;
  }
}

type Rarity = typeof rarities[number];

export default function CreatePage() {
  const { isConnected, address } = useAccount();
  const router = useRouter();
  const { t } = useLangT();

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
        throw new Error(metadataJson.error ?? t('create.errorIpfs'));
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
      setError(err instanceof Error ? err.message : t('create.errorTransaction'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="card max-w-md mx-auto mt-20 p-8 text-center">
        <Wallet className="w-16 h-16 mx-auto mb-4 opacity-40" />
        <h2 className="text-xl font-bold mb-2 font-display">{t('create.walletTitle')}</h2>
        <p className="text-sm text-gray-400">{t('create.walletSubtitle')}</p>
      </div>
    );
  }

  const listingTypeButtons: { value: 'fixed' | 'auction' | 'none'; icon: React.ReactNode; label: string }[] = [
    { value: 'fixed', icon: <Zap className="w-4 h-4" />, label: t('create.listingFixed') },
    { value: 'auction', icon: <Gavel className="w-4 h-4" />, label: t('create.listingAuction') },
    { value: 'none', icon: <Lock className="w-4 h-4" />, label: t('create.listingNone') },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <div className="zion-kicker mb-3">{t('create.kicker')}</div>
        <h1 className="text-3xl font-black font-display mb-1">
          <span className="text-gradient">{t('create.title1')}</span>{' '}
          <span className="text-white">{t('create.title2')}</span>
        </h1>
        <p className="text-sm text-gray-500">{t('create.subtitle')}</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rasta-red/10 border border-rasta-red/20 text-sm text-rasta-red">
          {error}
        </div>
      )}

      <OasisImportPanel onImport={handleOasisImport} />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Asset */}
        <section
          className="zion-rainbow-card p-6 space-y-5"
          style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
        >
          <h2 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
            <span className="w-1 h-3 rounded-full bg-rasta-gold" />
            {t('create.sectionAsset')}
          </h2>

          <div>
            <label className="block text-sm font-semibold mb-2">{t('create.labelName')}</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('create.placeholderName')}
              className="input-zion"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">{t('create.labelDescription')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={t('create.placeholderDescription')}
              className="input-zion resize-none"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">{t('create.labelCollection')}</label>
              <select
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
                className="input-zion"
              >
                {collections.map(c => (
                  <option key={c} value={c} className="bg-zion-card">{t(getCollectionLabelKey(c))}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">{t('create.labelRarity')}</label>
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
                    {t(`rarity.${r}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">{t('create.labelImage')}</label>
            <div className="flex gap-3">
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder={t('create.placeholderImage')}
                className="input-zion flex-1"
              />
              {imageUrl && (
                <div className="w-20 h-20 rounded-xl overflow-hidden artifact-placeholder flex items-center justify-center flex-shrink-0">
                  <img src={imageUrl} alt={t('create.imagePreviewAlt')} className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Traits */}
        <section className="zion-section p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
              <span className="w-1 h-3 rounded-full bg-rasta-red" />
              {t('create.sectionProperties')}
            </h2>
            <button type="button" onClick={addTrait} className="zion-button-ghost text-xs px-3 py-1.5">
              {t('create.addTrait')}
            </button>
          </div>
          {traits.map((trait, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={trait.trait}
                onChange={(e) => updateTrait(i, 'trait', e.target.value)}
                placeholder={t('create.placeholderTrait')}
                className="input-zion flex-1"
              />
              <input
                value={trait.value}
                onChange={(e) => updateTrait(i, 'value', e.target.value)}
                placeholder={t('create.placeholderValue')}
                className="input-zion flex-1"
              />
              {traits.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTrait(i)}
                  className="zion-button-icon zion-button-ghost text-rasta-red"
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
            <span className="w-1 h-3 rounded-full bg-rasta-gold" />
            {t('create.sectionListing')}
          </h2>
          <div className="flex gap-2">
            {listingTypeButtons.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setListingType(t.value)}
                className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  listingType === t.value
                    ? 'bg-rasta-red/20 text-white border border-rasta-red/40'
                    : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {t.icon} {t.label}
                </span>
              </button>
            ))}
          </div>

          {listingType === 'fixed' && (
            <div>
              <label className="block text-sm font-semibold mb-2">{t('create.labelPrice')}</label>
              <input
                required={listingType === 'fixed'}
                type="number"
                step="0.001"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={t('create.placeholderPrice')}
                className="input-zion"
              />
            </div>
          )}

          {listingType === 'auction' && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">{t('create.labelStartingPrice')}</label>
                <input
                  required={listingType === 'auction'}
                  type="number"
                  step="0.001"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder={t('create.placeholderPrice')}
                  className="input-zion"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">{t('create.labelDuration')}</label>
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
              {minting ? t('create.minting') : listing || auctioning ? t('create.creatingListing') : approving ? t('create.approving') : t('create.mintAndList')}
            </span>
          ) : t('create.createListing')}
        </button>
      </form>
    </div>
  );
}
