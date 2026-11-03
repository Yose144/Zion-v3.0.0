import type { Metadata } from 'next';
import Christmas2026Client from './Christmas2026Client';

export const metadata: Metadata = {
  alternates: { canonical: '/news/christmas-2026' },
  title: 'Vánoce v ZION — Království srdce, Kingdom a Nirvana | Novinky · ZION TerraNova',
  description:
    'Vánoční prodej digitální knihy Království srdce (ilustrovaná edice v pěti jazycích, ZION Archive Pass a Genesis bonus 144 000 ZION do 24. 12.), nový herní klient Kingdom ve vývoji a Nirvana — první svět OASIS živě.',
};

export default function Christmas2026Page() {
  return <Christmas2026Client />;
}
