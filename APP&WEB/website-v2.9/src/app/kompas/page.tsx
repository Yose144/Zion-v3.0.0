import type { Metadata } from 'next';
import KompasPageClient from './KompasPageClient';

export const metadata: Metadata = {
  title: 'Zlatý Kompas · TerraNova',
  description: 'Sedm směrů Zlatého Kompasu TerraNova: Pravdivost, Péče, Disciplína, Komunita, Otevřenost, Odvaha, Míra. Orientace pro ty, kdo chtějí vědět, kde je začátek.',
};

export default function KompasPage() {
  return <KompasPageClient />;
}
