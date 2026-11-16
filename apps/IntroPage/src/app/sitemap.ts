import type { MetadataRoute } from 'next';
import blogData from './data/blog-posts.json';

const BASE = 'https://zionterranova.com';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const sections = ['/', '/amenti/', '/blog/', '/camp/', '/evoluzion/', '/Vzestup/'].map(
    (path, i) => ({
      url: `${BASE}${path}`,
      changeFrequency: 'weekly' as const,
      priority: i === 0 ? 1 : 0.8,
    })
  );
  const blog = blogData.posts.map((p) => ({
    url: `${BASE}/blog/${p.slug}/`,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));
  return [...sections, ...blog];
}
