// Catalogue of downloadable editions in the Zion Archive.
//
// Metadata only — the files themselves live in the marketplace (65 MB ZIPs do
// not belong in the website deploy) and are served through the gated route
// /api/archive/downloads/[slug], which requires a valid Archive Pass.
//
// Adding an edition = one entry here + one source in that route.

export interface ArchiveDownload {
  id: string;
  title: { cs: string; en: string };
  description: { cs: string; en: string };
  /** Reader route of the related book (optional). */
  bookId?: string;
  bookHref?: string;
  formatLabel: string;
  languages: { cs: string; en: string };
  sizeLabel: string;
  /** SHA-256 of the packaged file — users can verify the download. */
  sha256?: string;
  /** ISO date of the packaged edition. */
  updated: string;
  highlights: { cs: string; en: string }[];
}

export const ARCHIVE_DOWNLOADS: ArchiveDownload[] = [
  {
    id: 'kralovstvi-srdce-bundle',
    title: {
      cs: 'Království srdce — kompletní edice',
      en: 'Kingdom of the Heart — complete edition',
    },
    description: {
      cs: 'Osm samostatných edic téhož příběhu, každá v pěti jazycích — celkem 40 knih ve formátu PDF i EPUB. U kapitol nechybí tabulka „Kotva pravdy" (co je Písmo, tradice, historie, legenda a co je literární obraz).',
      en: 'Eight standalone editions of the same story, each in five languages — 40 books in both PDF and EPUB. Every chapter keeps its “Anchor of Truth” table (what is scripture, tradition, history, legend, and what is literary image).',
    },
    bookId: 'kralovstvi-srdce',
    bookHref: '/zion-archive/kralovstvi-srdce/cist',
    formatLabel: 'ZIP · PDF + EPUB',
    languages: {
      cs: '5 jazyků — CZ, EN, ES, FR, PT',
      en: '5 languages — CZ, EN, ES, FR, PT',
    },
    sizeLabel: '62 MB',
    sha256: '6bce6c1435251f17bb3bdc350096c205448900a01a34a5c8859128c1e07c3f49',
    updated: '2026-11-04',
    highlights: [
      { cs: '40 knih · 8 edic · 5 jazyků', en: '40 books · 8 editions · 5 languages' },
      { cs: '3 252 stran · 619 498 slov', en: '3,252 pages · 619,498 words' },
      { cs: 'PDF i EPUB v jednom archivu', en: 'PDF and EPUB in one archive' },
    ],
  },
];

export function getDownload(id: string | undefined): ArchiveDownload | undefined {
  if (!id) return undefined;
  return ARCHIVE_DOWNLOADS.find((d) => d.id === id);
}

export function downloadForBook(bookId: string): ArchiveDownload | undefined {
  return ARCHIVE_DOWNLOADS.find((d) => d.bookId === bookId);
}
