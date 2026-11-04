import type { Metadata } from 'next';
import Christmas2026Client from './Christmas2026Client';

export const metadata: Metadata = {
  alternates: { canonical: '/news/christmas-2026' },
  title: 'Vánoce v ZION — ZION Pass, kniha v osmi edicích, lampion, Kingdom a Nirvana | Novinky · ZION TerraNova',
  description:
    'Tři vánoční dary: ZION Pass za 108 Kč (Nirvana + Archiv, bonus 10 800 ZION), kniha Království srdce v osmi edicích a pěti jazycích (40 knih, 3 252 stran, bonus 21 600 ZION) a ručně gravírovaný lampion. Nový herní klient Kingdom ve vývoji a Nirvana — první svět OASIS živě.',
};

export default function Christmas2026Page() {
  return <Christmas2026Client />;
}
