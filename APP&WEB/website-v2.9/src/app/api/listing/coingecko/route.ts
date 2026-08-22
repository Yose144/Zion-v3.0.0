export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import {
  TOTAL_SUPPLY_ZION,
  MINER_SHARE_PCT,
  HUMANITARIAN_TITHE_PCT,
  POOL_FEE_PCT,
} from '@/lib/constants';
import { resolveSupplySnapshot } from '@/lib/supply';
import { SITE_APP_URL, SITE_INTRO_URL } from '@/lib/site';
import { GITHUB_REPO_URL } from '@/lib/github-releases';

export async function GET() {
  const rpc = getZionRpc();

  try {
    const [info, lastBlock] = await Promise.all([
      rpc.getInfo().catch(() => null),
      rpc.getLastBlockHeader().catch(() => null),
    ]);

    if (!info) {
      return NextResponse.json({ error: 'Cannot reach ZION daemon' }, { status: 503 });
    }

    const supply = await resolveSupplySnapshot(rpc, info.height);
    const circulating = supply.circulatingSupply;

    const updatedAt = new Date().toISOString();

    return NextResponse.json(
      {
        id: 'zion-terranova',
        symbol: 'zion',
        name: 'ZION TerraNova',
        web_slug: 'zion-terranova',
        asset_platform_id: null,
        contract_address: null,
        links: {
          homepage: [SITE_INTRO_URL],
          blockchain_site: [`${SITE_APP_URL}/explorer`],
          official_forum_url: [`${SITE_APP_URL}/docs`],
          chat_url: [],
          announcement_url: [`${SITE_APP_URL}/roadmap`],
          twitter_screen_name: '',
          facebook_username: '',
          telegram_channel_identifier: '',
          subreddit_url: '',
          repos_url: {
            github: [GITHUB_REPO_URL],
            bitbucket: [],
          },
        },
        categories: ['Layer 1', 'Proof of Work', 'UTXO'],
        description: {
          en: 'ZION TerraNova is a PoW Layer-1 blockchain with Decade Decay emission, fee burning, and public explorer APIs.',
        },
        genesis_date: null,
        hashing_algorithm: 'Cosmic Harmony v3',
        market_cap_rank: null,
        coingecko_rank: null,
        coingecko_score: null,
        developer_score: null,
        community_score: null,
        liquidity_score: null,
        public_interest_score: null,
        market_data: {
          current_price: { usd: null },
          market_cap: { usd: null },
          fully_diluted_valuation: { usd: null },
          total_volume: { usd: null },
          circulating_supply: circulating,
          total_supply: TOTAL_SUPPLY_ZION,
          max_supply: TOTAL_SUPPLY_ZION,
          last_updated: updatedAt,
        },
        community_data: {
          facebook_likes: null,
          twitter_followers: null,
          reddit_average_posts_48h: null,
          reddit_average_comments_48h: null,
          reddit_subscribers: null,
          telegram_channel_user_count: null,
        },
        developer_data: {
          forks: null,
          stars: null,
          subscribers: null,
          total_issues: null,
          closed_issues: null,
          pull_requests_merged: null,
          pull_request_contributors: null,
          code_additions_deletions_4_weeks: { additions: null, deletions: null },
          commit_count_4_weeks: null,
        },
        status_updates: [],
        onchain: {
          chain_id: info.mainnet ? 'zion-mainnet-1' : 'zion-testnet',
          block_height: info.height,
          top_block_hash: info.top_block_hash || '',
          avg_block_time: info.target || 60,
          network_hashrate: info.difficulty / (info.target || 60),
          tx_count: info.tx_count || 0,
          tx_pool_size: info.tx_pool_size || 0,
          peers:
            (info.incoming_connections_count || 0) +
            (info.outgoing_connections_count || 0),
          last_block_timestamp: lastBlock?.timestamp || null,
        },
        tokenomics: {
          emission_model: 'Decade Decay (-20% / decade)',
          fee_policy: '100% transaction fees burned',
          distribution: {
            miner_pct: MINER_SHARE_PCT,
            humanitarian_pct: HUMANITARIAN_TITHE_PCT,
            pool_fee_pct: POOL_FEE_PCT,
          },
        },
        listing_ready: true,
        updated_at: updatedAt,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (error) {
    console.error('CoinGecko listing endpoint failed:', error);
    return NextResponse.json({ error: 'Failed to build CoinGecko feed' }, { status: 503 });
  }
}
