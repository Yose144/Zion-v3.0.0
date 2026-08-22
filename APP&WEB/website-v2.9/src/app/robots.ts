import type { MetadataRoute } from 'next';
import { SITE_APP_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/health'],
      },
    ],
    sitemap: `${SITE_APP_URL}/sitemap.xml`,
  };
}
