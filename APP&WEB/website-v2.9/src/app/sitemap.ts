import type { MetadataRoute } from 'next';
import { SITE_APP_URL } from '@/lib/site';

const BASE = SITE_APP_URL;

type Freq = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
const r = (path: string, priority: number, changeFrequency: Freq) => ({ path, priority, changeFrequency });

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // Only indexable GET routes — no redirects (next.config), no /admin, /api,
  // /account, /login, dynamic param shells or internal dashboards.
  const routes = [
    // ── Core / conversion ────────────────────────────────────────────
    r('/', 1.0, 'weekly'),
    r('/download', 0.9, 'monthly'),
    r('/onboard', 0.9, 'monthly'),
    r('/mining', 0.8, 'monthly'),
    r('/roadmap', 0.8, 'weekly'),

    // ── Live network data ────────────────────────────────────────────
    r('/dashboard', 0.9, 'hourly'),
    r('/pool', 0.8, 'hourly'),
    r('/explorer', 0.8, 'hourly'),
    r('/network', 0.7, 'hourly'),
    r('/miner-stats', 0.6, 'hourly'),
    r('/monitoring', 0.5, 'hourly'),
    r('/g8', 0.5, 'daily'),

    // ── Explorer index pages ─────────────────────────────────────────
    r('/explorer/blocks', 0.6, 'hourly'),
    r('/explorer/transactions', 0.6, 'hourly'),
    r('/explorer/mempool', 0.5, 'hourly'),
    r('/explorer/miners', 0.5, 'hourly'),
    r('/explorer/status', 0.5, 'daily'),
    r('/explorer/charts', 0.5, 'daily'),
    r('/explorer/network-stats', 0.5, 'daily'),
    r('/explorer/supply', 0.5, 'daily'),
    r('/explorer/consensus', 0.5, 'weekly'),
    r('/explorer/tokens', 0.5, 'weekly'),
    r('/explorer/contracts', 0.4, 'weekly'),
    r('/explorer/emission', 0.5, 'daily'),
    r('/explorer/richlist', 0.5, 'daily'),
    r('/explorer/txs', 0.5, 'hourly'),
    r('/explorer/bridge', 0.5, 'daily'),
    r('/explorer/broadcast', 0.4, 'monthly'),
    r('/explorer/fee-estimator', 0.4, 'monthly'),
    r('/explorer/search', 0.4, 'monthly'),
    r('/explorer/verify-message', 0.4, 'monthly'),
    r('/explorer/api-docs', 0.5, 'monthly'),

    // ── Ecosystem / product ──────────────────────────────────────────
    r('/multichain', 0.7, 'weekly'),
    r('/dao', 0.7, 'weekly'),
    r('/wallet', 0.6, 'monthly'),
    r('/wallet/multichain', 0.5, 'monthly'),
    r('/wallet/bridge', 0.5, 'monthly'),
    r('/wallet/staking', 0.5, 'monthly'),
    r('/cex', 0.6, 'monthly'),

    // ── Layer pages ──────────────────────────────────────────────────
    r('/l3-hiran', 0.7, 'monthly'),
    r('/l4-oasis', 0.7, 'monthly'),
    r('/l5-free-world', 0.7, 'monthly'),
    r('/l6-issobella', 0.7, 'monthly'),

    // ── TerraNova nodes + geography ──────────────────────────────────
    r('/terranova', 0.7, 'monthly'),
    r('/terranova/amenti', 0.6, 'monthly'),
    r('/terranova/boa-esperanca', 0.6, 'monthly'),
    r('/terranova/bodhi-lanka', 0.6, 'monthly'),
    r('/terranova/dharma-temple', 0.6, 'monthly'),
    r('/terranova/ekam', 0.6, 'monthly'),
    r('/terranova/genesis', 0.6, 'monthly'),
    r('/terranova/golden-republic-bohemia', 0.6, 'monthly'),
    r('/terranova/kailash', 0.6, 'monthly'),
    r('/terranova/maria-del-camino', 0.6, 'monthly'),
    r('/terranova/nova-amerika', 0.6, 'monthly'),
    r('/terranova/te-piko-ora', 0.6, 'monthly'),
    r('/terranova/uluru', 0.6, 'monthly'),
    r('/terranova/geography/africa', 0.4, 'monthly'),
    r('/terranova/geography/americas', 0.4, 'monthly'),
    r('/terranova/geography/asia', 0.4, 'monthly'),
    r('/terranova/geography/europe', 0.4, 'monthly'),
    r('/terranova/geography/oceania', 0.4, 'monthly'),

    // ── Content / docs (SEO surface) ─────────────────────────────────
    r('/news', 0.8, 'weekly'),
    r('/news/launch-postponed', 0.6, 'monthly'),
    r('/news/v3-internal-audit', 0.6, 'monthly'),
    r('/docs', 0.7, 'weekly'),
    r('/wiki', 0.7, 'weekly'),
    r('/whitepapers', 0.7, 'monthly'),
    r('/api-reference', 0.6, 'monthly'),
    r('/quantum-revolution', 0.6, 'monthly'),
    r('/resonance', 0.6, 'monthly'),
    r('/doge-vs-zion', 0.6, 'monthly'),
    r('/team', 0.5, 'monthly'),
    r('/benchmarks', 0.5, 'monthly'),

    // ── Misc real pages ──────────────────────────────────────────────
    r('/ekam', 0.6, 'monthly'),
    r('/ekam/deeksha', 0.6, 'monthly'),
    r('/genesis', 0.6, 'monthly'),
    r('/tree-of-life', 0.6, 'monthly'),
  ];

  return routes.map((route) => ({
    url: `${BASE}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
