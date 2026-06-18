import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `API Reference · ZION ${SITE_RELEASE_LABEL}`,
  description: 'ZION blockchain REST API documentation — core endpoints, mining pool API, and observability interfaces.',
};

export default function ApiReferenceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
