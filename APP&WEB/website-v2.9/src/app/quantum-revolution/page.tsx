import type { Metadata } from 'next';
import QuantumRevolutionClient from './QuantumRevolutionClient';

export const metadata: Metadata = {
  title: 'Kvantová Revoluce — kniha ZION · ZION',
  description:
    'Kvantová Revoluce: příběh u ohně o Nové Zemi, kde kvantová fyzika potkává duši a blockchain je meditace. 10 kapitol, 11 jazyků.',
  openGraph: {
    title: 'Kvantová Revoluce — kniha ZION',
    description:
      'Příběh u ohně o Nové Zemi. 10 kapitol, 11 jazyků. Kvantová fyzika, vědomí, blockchain jako meditace.',
  },
};

export default function QuantumRevolutionPage() {
  return <QuantumRevolutionClient />;
}
