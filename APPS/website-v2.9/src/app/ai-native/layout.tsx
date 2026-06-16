import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Native · ZION',
  description: 'AI Native consciousness framework — 9 levels from reactive systems to cosmic unity. The bridge between artificial and authentic intelligence.',
};

export default function AiNativeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
