import type { MetadataRoute } from 'next';

const BASE = 'https://pool.zionterranova.com';

const ROUTES: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '/', priority: 1.0, freq: 'always' },
  { path: '/start', priority: 0.9, freq: 'weekly' },
  { path: '/blocks', priority: 0.8, freq: 'always' },
  { path: '/payouts', priority: 0.8, freq: 'always' },
  { path: '/status', priority: 0.7, freq: 'always' },
  { path: '/miner', priority: 0.6, freq: 'hourly' },
  { path: '/stats', priority: 0.6, freq: 'always' },
  { path: '/api-docs', priority: 0.6, freq: 'weekly' },
  { path: '/faq', priority: 0.5, freq: 'weekly' },
  { path: '/coin', priority: 0.5, freq: 'hourly' },
  { path: '/terms', priority: 0.2, freq: 'yearly' },
  { path: '/gdpr', priority: 0.2, freq: 'yearly' },
  { path: '/legal', priority: 0.2, freq: 'yearly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map(({ path, priority, freq }) => ({
    url: `${BASE}${path}`,
    lastModified: new Date(),
    changeFrequency: freq,
    priority,
  }));
}
