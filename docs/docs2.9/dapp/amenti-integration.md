## Amenti Library – dApp Integration Guide

This guide shows how to plug the Amenti Library into a frontend dApp using the structured metadata in `data/amenti/library.json`.

### Goals
- Present a canonical catalog of Amenti-related books and links
- Respect source copyrights (link-out instead of mirroring content)
- Provide optional thumbnail gallery sourced from `images` list

### Data Contract
- Source file: `data/amenti/library.json`
- Top-level keys:
  - `books[]`: id, title, aliases[], authors[], language, categories[], description, landingPage, downloads[], images[], tags[]
  - `images[]`: id, title, url, license, source, tags[]
  - `references`: quick links (blog, halls page, vedabase, etc.)

### Minimal UI
- Books list with search (title, tags)
- Each book row:
  - Title + badges (categories)
  - Short description
  - Buttons: View (landingPage), Download(s) (if present)
  - Optional: Preview thumbnails if `images[]` non-empty

### Example (TypeScript)
```ts
type Book = {
  id: string; title: string; description?: string; landingPage?: string;
  downloads?: { url: string; type?: string; note?: string }[];
  tags?: string[]; categories?: string[];
};

async function loadAmenti(): Promise<{ books: Book[] }>{
  const res = await fetch('/data/amenti/library.json');
  if (!res.ok) throw new Error('Failed to load Amenti manifest');
  return res.json();
}

function BookRow({ b }: { b: Book }) {
  return (
    <div className="card">
      <h3>{b.title}</h3>
      <p>{b.description}</p>
      <div className="actions">
        {b.landingPage && <a href={b.landingPage} target="_blank">View</a>}
        {(b.downloads||[]).map((d, i) => (
          <a key={i} href={d.url} target="_blank">Download{d.type?` (${d.type})`:''}</a>
        ))}
      </div>
    </div>
  );
}
```

### UX/IA Suggestions
- Faceted filters: category, tag, language
- Highlight “Dohrman Prophecy (PDF)” as verified link
- Carousel: Goloka Vrindavan images from `images[]`
- Consider mobile-first patterns inspired by Pi Network (https://minepi.com): daily presence check (opt-in), lightweight PWA, and social contribution badges.

### Compliance & Ethics
- Do not scrape or re-host books without permission
- Cache thumbnails only with consent; store `license` string from manifest
- Attribute sources in a footer: `Data © respective authors, metadata © Zion`

### Future Enhancements
- Add per-book `cover` URL when available
- Add `checksum` for downloadable items
- Optional `ipfsCid` for decentralized pinning (with owner approval)
