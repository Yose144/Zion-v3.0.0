import type { MetadataRoute } from 'next';

/* Next 16 + `output: 'export'` vyžaduje explicitní statiku u metadata rout. */
export const dynamic = 'force-static';

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
