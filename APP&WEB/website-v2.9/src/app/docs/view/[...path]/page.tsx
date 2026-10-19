import type { Metadata } from 'next';
import DocViewClient from './DocViewClient';

export const dynamicParams = true;

export function generateStaticParams() {
  return [{ path: ['index'] }];
}

export const metadata: Metadata = {
  title: 'Dokument | ZION Docs',
  description: 'ZION knowledge base — canonical corpus documents.',
};

export default function DocViewPage() {
  return <DocViewClient />;
}
