import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/ops', '/ops-api', '/api/', '/public/v1/'],
      },
    ],
    sitemap: 'https://pool.zionterranova.com/sitemap.xml',
  };
}
