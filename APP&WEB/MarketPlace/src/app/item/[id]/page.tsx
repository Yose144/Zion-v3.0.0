'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useAccount } from 'wagmi';
import { WZION_ADDRESS, ZION_BRIDGE_L1_VAULT } from '@/lib/contracts';

const mockItem = {
  id: '1',
  name: 'Tree of Life Avatar',
  collection: 'OASIS Genesis',
  rarity: 'mythic' as const,
  description: 'A sacred avatar born from the Tree of Life in the OASIS Genesis event. Grants the bearer enhanced wisdom stats and unique visual aura in-game.',
  image: '',
  price: '2.5',
  listingType: 'fixed' as 'fixed' | 'auction' | 'none',
  tokenId: '42',
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
    { event: 'Listed', price: '2.5 ETH', from: '0x1234…abcd', time: '2h ago' },
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
  const item = mockItem; // TODO: fetch by params.id

  const isOwner = isConnected && address?.toLowerCase() === item.owner.toLowerCase();

  // L1 payment memo: MARKETBUY:listingId:buyerL2Address:quantity
  const l1Memo = address
    ? `MARKETBUY:${item.id}:${address}:${l1Qty || '1'}`
    : `MARKETBUY:${item.id}:<YOUR_L2_ADDRESS>:1`;

  const copyL1Instructions = () => {
    const text = `Send ${item.price} ZION to ${ZION_BRIDGE_L1_VAULT}\nMemo: ${l1Memo}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Image */}
        <div className="glass-panel">
          <div className="glass-panel-inner">
            <div className="aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-oasis-purple/20 via-oasis-cyan/10 to-oasis-gold/10 flex items-center justify-center">
              {imgError ? (
                <span className="text-9xl text-gradient font-black">Z</span>
              ) : (
                <img
                  src={item.image}
                  alt={item.name}
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-5">
          <div>
            <div className="text-sm text-gray-500 mb-1">{item.collection}</div>
            <h1 className="text-3xl font-black text-white mb-2">{item.name}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`rarity-badge rarity-${item.rarity}`}>{item.rarity}</span>
              <span className="text-xs text-gray-500 font-mono">
                Token #{item.tokenId} · Supply {item.supply}
              </span>
            </div>
          </div>

          {/* Price card */}
          <div className="card p-5">
            {item.listingType === 'fixed' && (
              <>
                <div className="text-xs text-gray-500 mb-1">Current Price</div>
                <div className="text-3xl font-black text-gradient-gold mb-4">
                  {item.price} wZION
                </div>

                {/* Payment method selector */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setPaymentMethod('l2')}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                      paymentMethod === 'l2'
                        ? 'bg-oasis-cyan/20 border border-oasis-cyan/50 text-oasis-cyan'
                        : 'bg-white/5 border border-white/10 text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    Pay with wZION (L2)
                  </button>
                  <button
                    onClick={() => setPaymentMethod('l1')}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                      paymentMethod === 'l1'
                        ? 'bg-oasis-gold/20 border border-oasis-gold/50 text-oasis-gold'
                        : 'bg-white/5 border border-white/10 text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    Pay with ZION (L1)
                  </button>
                </div>

                {paymentMethod === 'l2' ? (
                  <button
                    disabled={!isConnected || isOwner}
                    className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {!isConnected ? 'Connect wallet to buy' : isOwner ? 'You own this item' : 'Buy Now'}
                  </button>
                ) : (
                  <div className="space-y-3">
                    {/* L1 payment instructions */}
                    <div className="rounded-lg bg-oasis-gold/5 border border-oasis-gold/20 p-3 space-y-2">
                      <div className="text-xs text-oasis-gold font-bold flex items-center gap-1">
                        <span className="status-dot status-active" />
                        Pay with native ZION on L1
                      </div>
                      <div className="text-[11px] text-gray-400 leading-relaxed">
                        Send <span className="text-oasis-gold font-mono font-bold">{item.price} ZION</span> to the bridge vault with the memo below. After L1 confirmation (~60 blocks), the NFT will be delivered to your L2 address automatically.
                      </div>

                      <div className="space-y-1.5">
                        <div>
                          <div className="text-[10px] text-gray-500 uppercase mb-0.5">Bridge Vault Address</div>
                          <div className="font-mono text-[11px] text-gray-300 break-all bg-black/30 rounded px-2 py-1">
                            {ZION_BRIDGE_L1_VAULT}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-500 uppercase mb-0.5">Memo (required)</div>
                          <div className="font-mono text-[11px] text-oasis-cyan break-all bg-black/30 rounded px-2 py-1">
                            {l1Memo}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-500 uppercase mb-0.5">Quantity</div>
                          <input
                            type="number"
                            min="1"
                            value={l1Qty}
                            onChange={(e) => setL1Qty(e.target.value)}
                            className="w-full px-2 py-1 rounded bg-white/5 border border-white/10 text-xs font-mono focus:border-oasis-gold/50 focus:outline-none"
                          />
                        </div>
                      </div>

                      <button
                        onClick={copyL1Instructions}
                        className="w-full mt-2 px-3 py-1.5 rounded-lg bg-oasis-gold/10 border border-oasis-gold/30 text-xs text-oasis-gold font-bold hover:bg-oasis-gold/20 transition-all"
                      >
                        {copied ? '✓ Copied!' : 'Copy payment instructions'}
                      </button>

                      {!isConnected && (
                        <div className="text-[10px] text-rose-400/70">
                          Connect your L2 wallet first — your address is included in the memo so the NFT is delivered to you.
                        </div>
                      )}
                    </div>

                    <div className="text-[10px] text-gray-600 leading-relaxed">
                      The L1 watcher service detects your payment, waits for finality, then calls <span className="font-mono text-gray-500">relayerSettle()</span> on the L2 marketplace contract to transfer the NFT to your address. Seller receives wZION via the bridge.
                    </div>
                  </div>
                )}
              </>
            )}
            {item.listingType === 'auction' && (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">Top Bid</span>
                  <span className="text-xs text-oasis-gold">5h 23m left</span>
                </div>
                <div className="text-3xl font-black text-oasis-cyan mb-4">
                  {item.price} ETH
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Bid amount (ETH)"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm focus:border-oasis-cyan/50 focus:outline-none"
                  />
                  <button
                    disabled={!isConnected || !bidAmount}
                    className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Place Bid
                  </button>
                </div>
              </>
            )}
            {item.listingType === 'none' && (
              <div className="text-center py-4 text-gray-500">
                Not currently listed for sale
              </div>
            )}
          </div>

          {/* Description */}
          <div className="card p-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Description</h3>
            <p className="text-sm text-gray-300 leading-relaxed">{item.description}</p>
          </div>

          {/* Properties */}
          <div className="card p-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Properties</h3>
            <div className="grid grid-cols-2 gap-2">
              {item.properties.map(p => (
                <div key={p.trait} className="rounded-lg bg-white/5 border border-white/5 p-3">
                  <div className="text-[10px] text-gray-500 uppercase">{p.trait}</div>
                  <div className="text-sm text-oasis-cyan font-semibold">{p.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="card p-5">
        <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Activity</h3>
        <div className="space-y-2">
          {item.history.map((h, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
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
