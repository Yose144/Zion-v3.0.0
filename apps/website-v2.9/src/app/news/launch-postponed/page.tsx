import type { Metadata } from 'next';
import LaunchPostponedClient from './LaunchPostponedClient';

export const metadata: Metadata = {
  title: 'Veřejný launch se odkládá | Public Launch Postponed · ZION TerraNova',
  description:
    'Veřejný launch ZION TerraNova se odkládá. Projekt zůstává ve vývoji, hledáme dobrovolné vývojáře a potřebujeme projít Maturity Gate (Maturitou) a mít základní likviditu. Více v článku.',
};

export default function LaunchPostponedPage() {
  return <LaunchPostponedClient />;
}
