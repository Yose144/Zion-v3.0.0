import type { MetadataRoute } from 'next';

const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://lumi.zionterranova.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api/', '/objednavka/'],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
    host: new URL(site).host,
  };
}
