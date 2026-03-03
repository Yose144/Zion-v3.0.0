import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Reference · ZION v2.9.7',
  description: 'ZION blockchain REST API documentation — core endpoints, mining pool API, and observability interfaces.',
};

export default function ApiReferenceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
