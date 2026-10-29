import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Start mining — connect in 60 seconds',
  description: 'Stratum endpoints, TLS ports, SOLO/PPLNS modes and config snippets for zion-miner, SRBMiner and HiveOS — connect to ZION Pool in under a minute.',
  alternates: { canonical: '/start' },
  openGraph: { url: 'https://pool.zionterranova.com/start' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
