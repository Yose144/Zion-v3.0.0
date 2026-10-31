import type { LayerId } from './types';

/**
 * Katalog světů.
 *
 * Jen identita a text — žádné React komponenty, žádné three. Serverové
 * komponenty tak mohou katalog číst, aniž by si do SSR bundle přitáhly
 * renderer. Komponentová vazba je v `@zion/scenes`.
 */

export interface WorldCatalogEntry {
  id: string;
  /** vlastní jméno, shodné v obou jazycích */
  title: string;
  subtitle: { cs: string; en: string };
  layer: LayerId;
}

export const WORLD_CATALOG: WorldCatalogEntry[] = [
  {
    id: 'amenti',
    title: 'AMENTI · GIZA',
    subtitle: { cs: 'Síň záznamů · Egypt', en: 'Hall of records · Egypt' },
    layer: 'L5',
  },
  {
    id: 'boa-esperanca',
    title: 'BOA ESPERANÇA',
    subtitle: { cs: 'Mys Dobré naděje · šev dvou oceánů', en: 'Cape of Good Hope · seam of two oceans' },
    layer: 'L5',
  },
  {
    id: 'bodhi-lanka',
    title: 'BODHI LANKA',
    subtitle: { cs: 'Akáša · Srí Lanka', en: 'Akasha · Sri Lanka' },
    layer: 'L5',
  },
  {
    id: 'dharma-temple',
    title: 'DHARMA TEMPLE',
    subtitle: { cs: 'La Palma · Kanárské ostrovy', en: 'La Palma · Canary Islands' },
    layer: 'L5',
  },
  {
    id: 'ekam',
    title: 'EKAM',
    subtitle: { cs: 'Oneness Temple · Andhra Pradesh', en: 'Oneness Temple · Andhra Pradesh' },
    layer: 'L5',
  },
  {
    id: 'genesis-garden',
    title: 'GENESIS GARDEN',
    subtitle: { cs: 'Sabacheira · Tomar · Portugalsko', en: 'Sabacheira · Tomar · Portugal' },
    layer: 'L5',
  },
  {
    id: 'golden-republic-bohemia',
    title: 'GOLDEN REPUBLIC BOHEMIA',
    subtitle: { cs: 'Čechy · osa Říp', en: 'Bohemia · the Říp axis' },
    layer: 'L5',
  },
  {
    id: 'kailash',
    title: 'KAILASH',
    subtitle: { cs: 'Posvátná hora · Himálaje', en: 'Sacred mountain · Himalayas' },
    layer: 'L5',
  },
  {
    id: 'lumi',
    title: 'LUMI · NOVÁ AMERIKA',
    subtitle: { cs: 'Issobella L6 · Kostarika', en: 'Issobella L6 · Costa Rica' },
    layer: 'L6',
  },
  {
    id: 'maria-del-camino',
    title: 'MARÍA DEL CAMINO',
    subtitle: { cs: 'Galicie · Tres Marias', en: 'Galicia · Tres Marias' },
    layer: 'L5',
  },
  {
    id: 'matrix',
    title: 'MATRIX',
    subtitle: { cs: 'Síň stroje · vnitřní svět', en: 'Hall of the machine · inner world' },
    layer: 'L5',
  },
  {
    id: 'te-piko-ora',
    title: 'TE PĪKO ORA',
    subtitle: { cs: 'Raiatea · Francouzská Polynésie', en: 'Raiatea · French Polynesia' },
    layer: 'L5',
  },
  {
    id: 'uluru',
    title: 'ULURU',
    subtitle: { cs: 'Tjukurpa · Songlines · Austrálie', en: 'Tjukurpa · Songlines · Australia' },
    layer: 'L5',
  },
];

const byId = new Map(WORLD_CATALOG.map((entry) => [entry.id, entry]));

export function worldEntry(id: string): WorldCatalogEntry | undefined {
  return byId.get(id);
}
