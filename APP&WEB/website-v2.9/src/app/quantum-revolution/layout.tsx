import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kvantová Revoluce · ZION',
  description:
    'Kvantová Revoluce — kniha, která to odstartovala. Příběh u ohně o Nové Zemi, kde kvantová fyzika potkává duši a blockchain je meditace.',
  openGraph: {
    title: 'Kvantová Revoluce — ZION',
    description:
      'Příběh u ohně o Nové Zemi, kde kvantová fyzika potkává duši a blockchain je meditace. 10 kapitol, 11 jazyků.',
  },
};

export default function QuantumRevolutionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
