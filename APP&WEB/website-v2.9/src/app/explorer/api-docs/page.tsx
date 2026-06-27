import ApiDocsClient from '@/components/explorer/ApiDocsClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Documentation · ZION Explorer',
  description: 'ZION blockchain API endpoints, parameters, and examples.',
};

export default function ApiDocsPage() {
  return <ApiDocsClient />;
}
