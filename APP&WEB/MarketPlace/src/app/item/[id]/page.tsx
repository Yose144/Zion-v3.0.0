'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { Zap, Coins, Lock, Copy, Check } from 'lucide-react';
import { ZION_BRIDGE_L1_VAULT } from '@/lib/contracts';
import { getItem, type ItemDetailData } from '@/lib/market-api';
import { useBuyFixed, useBid, useApproveWZION, useWZIONAllowance, priceToWei } from '@/hooks/useMarket';

const mockItem: ItemDetailData = {
  id: '1',
  name: 'Tree of Life Avatar',
  description: 'A sacred avatar born from the Tree of Life in the OASIS Genesis event. Grants the bearer enhanced wisdom stats and unique visual aura in-game. Only 100 will ever be minted.',
  collection: 'OASIS Genesis',
  rarity: 'mythic',
  image: '',
  price: '2,500',
  listingType: 'fixed',
  tokenId: '42',
  contractAddress: '',
  supply: '100',
  owner: '0x1234…abcd',
  properties: [
    { trait: 'Origin', value: 'Genesis Event' },
    { trait: 'Class', value: 'Avatar' },
    { trait: 'Wisdom Boost', value: '+25%' },
    { trait: 'Aura', value: 'Emerald Glow' },
    { trait: 'Tradeable', value: 'Yes' },
  ],
  history: [
    { event: 'Listed', price: '2,500 wZION', from: '0x1234…abcd', time: '2h ago' },
    { event: 'Minted', price: '—', from: 'OASIS Quest', time: '5d ago' },
  ],
};

export default function ItemDetailPage() {
  const params = useParams<{ id: string }>();
  const { address, isConnected } = useAccount();
  const [bidAmount, setBidAmount] = useState('');
  const [imgError, setImgError] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'l2' | 'l1'>('l2');
  const [l1Qty, setL1Qty] = useState('1');
  const [copied, setCopied] = useState(false);
  const [item, setItem] = useState<ItemDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const display = item ?? mockItem;

  const listingId = useMemo(() => {
    if (!display.listingId) return undefined;
    try { return BigInt(display.listingId); } catch { return undefined; }
  }, [display.listingId]);

  const quantity = BigInt(display.quantity ?? 1);

  const {
    buy,
    isPending: buying,
    totalWei,
  } = useBuyFixed(listingId ?? 0n, quantity, display.price ?? '0');

  const { bid, isPending: bidding } = useBid(listingId ?? 0n, bidAmount);
  const { approve, isPending: approving } = useApproveWZION();
  const { data: allowance } = useWZIONAllowance(address as `0x${string}` | undefined);

  const needsApproval = useMemo(() => {
    if (!allowance || !totalWei) return true;
    return allowance < totalWei;
  }, [allowance, totalWei]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getItem(params.id).then((data) => {
      if (cancelled) return;
      setItem(data ?? mockItem);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [params.id]);

  const isOwner = useMemo(
    () => isConnected && address?.toLowerCase() === (display.owner ?? '').toLowerCase(),
    [isConnected, address, display.owner]
  );

  const l1Memo = address
    ? `MARKETBUY:${display.id}:${address}:${l1Qty || '1'}`
    : `MARKETBUY:${display.id}:<YOUR_L2_ADDRESS>:1`;

  const copyL1Instructions = () => {
    const text = `Send ${display.price} ZION to ${ZION_BRIDGE_L1_VAULT}\nMemo: ${l1Memo}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="zion-section p-16 text-center">
        <div className="w-10 h-10 border-2 border-oasis-cyan/30 border-t-oasis-cyan rounded-full animate-spin mx-auto mb-4" />
        <div className="text-gray-500">Loading artifact…</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <a href="/explore" className="hover:text-oasis-cyan transition-colors">Explore</a>
        <span>/</span>
        <span className="text-gray-400">{display.collection ?? display.category ?? 'OASIS'}</span>
        <span>/</span>
        <span className="text-white">{display.name}</span>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Image */}
        <div
          className="zion-rainbow-card p-4"
          style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
        >
          <div className="aspect-square rounded-xl overflow-hidden artifact-placeholder flex items-center justify-center relative">
            {imgError || !display.image ? (
              <span className="text-9xl text-gradient font-black font-display relative z-10">Z</span>
            ) : (
              <img
                src={display.image}
                alt={display.name}
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute top-3 left-3">
              <span className={`rarity-badge rarity-${display.rarity}`}>{display.rarity}</span>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-5">
          <div>
            <div className="text-sm text-gray-500 mb-1">{display.collection ?? display.category ?? 'OASIS'}</div>
            <h1 className="text-3xl font-black text-white mb-3 font-display">{display.name}</h1>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`rarity-badge rarity-${display.rarity}`}>{display.rarity}</span>
              <span className="text-xs text-gray-500 font-mono">
                Token #{display.tokenId} · Supply {display.supply}
              </span>
            </div>
          </div>

          {/* Price card */}
          <div
            className="zion-rainbow-card p-6"
            style={{ '--rc': '255, 215, 0' } as React.CSSProperties}
          >
            {display.listingType === 'fixed' && (
              <>
                <div className="text-xs text-gray-500 mb-1">Current Price</div>
                <div className="text-3xl font-black text-gradient-gold mb-5 font-display">
                  {display.price} <span className="text-lg text-gray-500">wZION</span>
                </div>

                {/* Payment method selector */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setPaymentMethod('l2')}
                    className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                      paymentMethod === 'l2'
                        ? 'bg-oasis-cyan/20 border border-oasis-cyan/50 text-oasis-cyan'
                        : 'bg-white/5 border border-white/10 text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <span className="inline-flex items-center justify-center gap-1.5">
                      <Zap className="w-3.5 h-3.5" /> Pay with wZION (L2)
                    </span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('l1')}
                    className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                      paymentMethod === 'l1'
                        ? 'bg-oasis-gold/20 border border-oasis-gold/50 text-oasis-gold'
                        : 'bg-white/5 border border-white/10 text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <span className="inline-flex items-center justify-center gap-1.5">
                      <Coins className="w-3.5 h-3.5" /> Pay with ZION (L1)
                    </span>
                  </button>
                </div>

                {paymentMethod === 'l2' ? (
                  <button
                    type="button"
                    onClick={() => (needsApproval ? approve(totalWei) : buy())}
                    disabled={!isConnected || isOwner || buying || approving || !display.listingId}
                    className="zion-button-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {!isConnected
                      ? 'Connect wallet to buy'
                      : isOwner
                      ? 'You own this item'
                      : !display.listingId
                      ? 'Not listed'
                      : approving
                      ? 'Approving wZION…'
                      : buying
                      ? 'Buying…'
                      : needsApproval
                      ? 'Approve wZION'
                      : 'Buy Now'}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-oasis-gold/5 border border-oasis-gold/20 p-4 space-y-3">
                      <div className="text-xs text-oasis-gold font-bold flex items-center gap-2">
                        <span className="status-dot status-active" />
                        Pay with native ZION on L1
                      </div>
                      <div className="text-[11px] text-gray-400 leading-relaxed">
                        Send <span className="text-oasis-gold font-mono font-bold">{display.price} ZION</span> to the bridge vault with the memo below. After L1 confirmation (~60 blocks), the NFT will be delivered to your L2 address automatically.
                      </div>

                      <div className="space-y-2">
                        <div>
                          <div className="text-[10px] text-gray-500 uppercase mb-1">Bridge Vault Address</div>
                          <div className="font-mono text-[11px] text-gray-300 break-all bg-black/40 rounded-lg px-3 py-2 border border-white/5">
                            {ZION_BRIDGE_L1_VAULT}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-500 uppercase mb-1">Memo (required)</div>
                          <div className="font-mono text-[11px] text-oasis-cyan break-all bg-black/40 rounded-lg px-3 py-2 border border-white/5">
                            {l1Memo}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-500 uppercase mb-1">Quantity</div>
                          <input
                            type="number"
                            min="1"
                            value={l1Qty}
                            onChange={(e) => setL1Qty(e.target.value)}
                            className="input-zion text-xs font-mono"
                          />
                        </div>
                      </div>

                      <button
                        onClick={copyL1Instructions}
                        className="w-full mt-2 px-3 py-2 rounded-xl bg-oasis-gold/10 border border-oasis-gold/30 text-xs text-oasis-gold font-bold hover:bg-oasis-gold/20 transition-all"
                      >
                        {copied ? (
                          <span className="inline-flex items-center justify-center gap-1.5">
                            <Check className="w-3.5 h-3.5" /> Copied to clipboard!
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center gap-1.5">
                            <Copy className="w-3.5 h-3.5" /> Copy payment instructions
                          </span>
                        )}
                      </button>

                      {!isConnected && (
                        <div className="text-[10px] text-rose-400/70">
                          Connect your L2 wallet first — your address is included in the memo so the NFT is delivered to you.
                        </div>
                      )}
                    </div>

                    <div className="text-[10px] text-gray-600 leading-relaxed px-1">
                      The L1 watcher service detects your payment, waits for finality, then calls <span className="font-mono text-gray-500">relayerSettle()</span> on the L2 marketplace contract to transfer the NFT to your address. Seller receives wZION via the bridge.
                    </div>
                  </div>
                )}
              </>
            )}
            {display.listingType === 'auction' && (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">Top Bid</span>
                  <span className="text-xs text-oasis-gold flex items-center gap-1">
                    <span className="status-dot status-pending" />
                    5h 23m left
                  </span>
                </div>
                <div className="text-3xl font-black text-oasis-cyan mb-4 font-display">
                  {display.price} <span className="text-lg text-gray-500">wZION</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Bid amount (wZION)"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    className="input-zion flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => bid()}
                    disabled={!isConnected || !bidAmount || !display.listingId || bidding}
                    className="zion-button-primary disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {bidding ? 'Placing Bid…' : !display.listingId ? 'Not Listed' : 'Place Bid'}
                  </button>
                </div>
              </>
            )}
            {(!display.listingType || display.listingType === 'none') && (
              <div className="text-center py-6">
                <Lock className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <div className="text-gray-500">Not currently listed for sale</div>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="zion-section p-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
              <span className="w-1 h-3 rounded-full bg-oasis-cyan" />
              Description
            </h3>
            <p className="text-sm text-gray-300 leading-relaxed">{display.description}</p>
          </div>

          {/* Properties */}
          <div className="zion-section p-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
              <span className="w-1 h-3 rounded-full bg-oasis-purple" />
              Properties
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {display.properties.map((p) => (
                <div key={p.trait} className="rounded-xl bg-white/5 border border-white/5 p-3 hover:border-oasis-cyan/20 transition-colors">
                  <div className="text-[10px] text-gray-500 uppercase">{p.trait}</div>
                  <div className="text-sm text-oasis-cyan font-semibold">{p.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="zion-section p-5">
        <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
          <span className="w-1 h-3 rounded-full bg-oasis-gold" />
          Activity
        </h3>
        <div className="space-y-1">
          {display.history.map((h, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-3">
                <span className={`status-dot ${
                  h.event === 'Listed' ? 'status-active' :
                  h.event === 'Minted' ? 'status-pending' : 'status-inactive'
                }`} />
                <span className="text-sm text-white font-semibold">{h.event}</span>
                <span className="text-xs text-gray-500 font-mono">{h.from}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gradient-gold font-mono">{h.price}</span>
                <span className="text-xs text-gray-600">{h.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
