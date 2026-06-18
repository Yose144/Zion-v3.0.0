export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import {
  TOTAL_SUPPLY_ZION,
} from '@/lib/constants';
import { resolveSupplySnapshot } from '@/lib/supply';

export async function GET() {
  const rpc = getZionRpc();

  try {
    const info = await rpc.getInfo().catch(() => null);
    if (!info) {
      return NextResponse.json(
        {
          status: {
            timestamp: new Date().toISOString(),
            error_code: 1001,
            error_message: 'Cannot reach ZION daemon',
            elapsed: 0,
            credit_count: 0,
          },
          data: null,
        },
        { status: 503 }
      );
    }

    const supply = await resolveSupplySnapshot(rpc, info.height);
    const circulating = supply.circulatingSupply;

    const updatedAt = new Date().toISOString();

    return NextResponse.json(
      {
        status: {
          timestamp: updatedAt,
          error_code: 0,
          error_message: null,
          elapsed: 0,
          credit_count: 1,
        },
        data: {
          id: null,
          name: 'ZION TerraNova',
          symbol: 'ZION',
          category: 'coin',
          description:
            'ZION TerraNova is a PoW Layer-1 blockchain with Decade Decay emission, fee burning, and public explorer APIs.',
          slug: 'zion-terranova',
          logo: null,
          subreddit: null,
          notice: '',
          tags: ['layer-1', 'pow', 'utxo'],
          tag_names: ['Layer 1', 'Proof of Work', 'UTXO'],
          tag_groups: ['CATEGORY'],
          urls: {
            website: ['https://www.zionterranova.com'],
            technical_doc: ['https://www.zionterranova.com/docs'],
            explorer: ['https://www.zionterranova.com/explorer'],
            source_code: ['https://github.com/Zion-TerraNova'],
            message_board: ['https://www.zionterranova.com/roadmap'],
            announcement: ['https://www.zionterranova.com/roadmap'],
            chat: [],
            twitter: [],
            reddit: [],
          },
          platform: null,
          date_added: null,
          twitter_username: null,
          is_hidden: 0,
          date_launched: null,
          self_reported_circulating_supply: circulating,
          self_reported_market_cap: null,
          infinite_supply: false,
          max_supply: TOTAL_SUPPLY_ZION,
          total_supply: TOTAL_SUPPLY_ZION,
          circulating_supply: circulating,
          last_updated: updatedAt,
          quote: {
            USD: {
              price: null,
              volume_24h: null,
              volume_change_24h: null,
              percent_change_1h: null,
              percent_change_24h: null,
              percent_change_7d: null,
              percent_change_30d: null,
              market_cap: null,
              market_cap_dominance: null,
              fully_diluted_market_cap: null,
              last_updated: updatedAt,
            },
          },
          onchain: {
            chain_id: info.mainnet ? 'zion-mainnet-1' : 'zion-testnet',
            block_height: info.height,
            top_block_hash: info.top_block_hash || '',
            target_block_time: info.target || 60,
            tx_count: info.tx_count || 0,
            tx_pool_size: info.tx_pool_size || 0,
            peers:
              (info.incoming_connections_count || 0) +
              (info.outgoing_connections_count || 0),
          },
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (error) {
    console.error('CoinMarketCap listing endpoint failed:', error);
    return NextResponse.json(
      {
        status: {
          timestamp: new Date().toISOString(),
          error_code: 1000,
          error_message: 'Failed to build CoinMarketCap feed',
          elapsed: 0,
          credit_count: 0,
        },
        data: null,
      },
      { status: 503 }
    );
  }
}
