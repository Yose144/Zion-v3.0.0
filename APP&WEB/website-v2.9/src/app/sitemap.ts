import type { MetadataRoute } from 'next';
import { SITE_APP_URL } from '@/lib/site';

const BASE = SITE_APP_URL;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const routes = [
    { path: '/', priority: 1.0, changeFrequency: 'weekly' as const },
    { path: '/dashboard', priority: 0.9, changeFrequency: 'hourly' as const },
    { path: '/roadmap', priority: 0.8, changeFrequency: 'weekly' as const },
    { path: '/download', priority: 0.9, changeFrequency: 'monthly' as const },
    { path: '/mining', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/explorer', priority: 0.8, changeFrequency: 'hourly' as const },
    { path: '/network', priority: 0.7, changeFrequency: 'hourly' as const },
    { path: '/ekam', priority: 0.6, changeFrequency: 'monthly' as const },
    { path: '/ekam/deeksha', priority: 0.6, changeFrequency: 'monthly' as const },
    { path: '/dao', priority: 0.7, changeFrequency: 'weekly' as const },
    { path: '/warp', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/genesis', priority: 0.6, changeFrequency: 'monthly' as const },
    { path: '/docs', priority: 0.7, changeFrequency: 'weekly' as const },
    { path: '/miner-stats', priority: 0.6, changeFrequency: 'hourly' as const },
    { path: '/tree-of-life', priority: 0.6, changeFrequency: 'monthly' as const },
  ];

  return routes.map((route) => ({
    url: `${BASE}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
