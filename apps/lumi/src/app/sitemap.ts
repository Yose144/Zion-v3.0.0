import type { MetadataRoute } from 'next';
import { PRODUCTS } from '@/data/catalog';

const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://lumi.zionterranova.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes = [
    '',
    '/kolekce',
    '/svatby',
    '/firmy',
    '/pribeh',
    '/pruvodce',
    '/faq',
    '/kontakt',
    '/nakupni-rad',
    '/doprava',
    '/obchodni-podminky',
    '/ochrana-osobnich-udaju',
    '/cookies',
    '/odstoupeni-od-smlouvy',
    '/bezpecnost-produktu',
    '/reklamace',
    '/pristupnost',
  ].map((route) => ({
    url: `${site}${route}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: route === '' ? 1 : 0.7,
  }));

  const productRoutes = PRODUCTS.map((product) => ({
    url: `${site}/kolekce/${product.slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  return [...staticRoutes, ...productRoutes];
}
