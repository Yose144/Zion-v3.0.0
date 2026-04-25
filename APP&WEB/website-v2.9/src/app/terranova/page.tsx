import type { Metadata } from 'next';
import TerraNovaBookClient from './TerraNovaBookClient';

export const metadata: Metadata = {
  title: 'Terra Nova — Zlatý Kompas Nové Země · ZION',
  description:
    'Terra Nova: sjednocená webová edice knihy ZION, která slučuje ORG, Public a Claude vrstvu do jedné čitelné knihy od prahu Nové Země až po Issobellu a Zlatý Kompas.',
  openGraph: {
    title: 'Terra Nova — Zlatý Kompas Nové Země',
    description:
      'Sjednocená Terra Nova edice na webu: ORG + Public + Claude v jedné čtečce.',
  },
};

export default function TerraNovaPage() {
  return <TerraNovaBookClient />;
}
