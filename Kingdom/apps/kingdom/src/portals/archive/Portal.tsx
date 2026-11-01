import type { Locale } from '@zion/contract';
import { t } from '@zion/i18n';

/**
 * Archiv v3 — zamrazený apex, jak vypadal ve verzi v3.3 (listopad 2026).
 *
 * Je to **historie**, ne povrch: statická kopie leží v `public/archive/v3`
 * (viz `Kingdom/scripts/build-archive-v3.sh`) a nikdo ji needituje. Portál ji
 * jen ukazuje — náhled v rámu a odkaz na celou plochu.
 *
 * Proč v Kingdomu: apex se má ve F6 stát Bránou, ale má 59 stránek (blog,
 * seeds, whitepapers, amenti, archa…). Tenhle archiv je jejich domov, takže
 * se při přepnutí apexu nic neztratí.
 */

/** Stránky, na které má smysl odkázat přímo (nejčastější vstupy). */
const ENTRIES: Array<{ path: string; cs: string; en: string }> = [
  { path: 'blog/', cs: 'Blog', en: 'Blog' },
  { path: 'seeds/', cs: 'Semínka', en: 'Seeds' },
  { path: 'docs/', cs: 'Dokumenty', en: 'Docs' },
  { path: 'whitepapers.html', cs: 'Whitepapery', en: 'Whitepapers' },
  { path: 'amenti/', cs: 'Amenti', en: 'Amenti' },
  { path: 'archa/', cs: 'Archa', en: 'Ark' },
  { path: 'vzestup.html', cs: 'Vzestup', en: 'Rise' },
  { path: 'evoluzion/', cs: 'EvoluZion', en: 'EvoluZion' },
];

const BASE = '/archive/v3';

export default function ArchivePortal({ locale }: { locale: Locale }) {
  return (
    <>
      <div className="k-card" style={{ maxWidth: 760 }}>
        <div className="k-card-title">ZION — Nirvana v3.3</div>
        <p className="k-card-desc">
          {locale === 'cs'
            ? 'Tak vypadal web, než se z něj stala Brána. Je to zamrazená kopie: odkazy uvnitř archivu vedou zpátky do archivu, nic se v něm neaktualizuje.'
            : 'This is how the website looked before it became the Gate. A frozen copy: links inside lead back into the archive, nothing updates.'}
        </p>
        <div className="k-meta">
          <span className="k-badge">59 stránek</span>
          <span className="k-badge">~24 MB</span>
          <span className="k-badge">listopad 2026</span>
        </div>
        <div className="k-row" style={{ gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <a className="k-btn" href={`${BASE}/index.html`} target="_blank" rel="noreferrer">
            {locale === 'cs' ? 'Otevřít archiv' : 'Open the archive'} →
          </a>
          <a
            className="k-ghost"
            href={`${BASE}/MANIFEST.txt`}
            target="_blank"
            rel="noreferrer"
          >
            MANIFEST
          </a>
        </div>
      </div>

      <div className="k-stage-head" style={{ marginTop: 22 }}>
        <h2 className="k-section-title">{locale === 'cs' ? 'Známé vstupy' : 'Known entries'}</h2>
      </div>
      <div className="k-grid">
        {ENTRIES.map((entry) => (
          <a
            key={entry.path}
            className="k-card"
            data-link="true"
            href={`${BASE}/${entry.path}`}
            target="_blank"
            rel="noreferrer"
          >
            <div className="k-card-title">{locale === 'cs' ? entry.cs : entry.en}</div>
            <p className="k-code" style={{ marginTop: 6 }}>
              /{entry.path}
            </p>
          </a>
        ))}
      </div>

      <div className="k-card" style={{ marginTop: 22, maxWidth: 760 }}>
        <div className="k-card-title">
          {locale === 'cs' ? 'Náhled' : 'Preview'}
        </div>
        <p className="k-card-desc">
          {locale === 'cs'
            ? 'Rám ukazuje archiv tak, jak byl. Když se stránka nevykreslí (archiv je starý export), otevři ji na celou plochu.'
            : 'The frame shows the archive as it was. If a page does not render (old export), open it full screen.'}
        </p>
        <iframe
          src={`${BASE}/index.html`}
          title="ZION — Nirvana v3.3 (archiv)"
          loading="lazy"
          style={{
            width: '100%',
            height: 420,
            border: '1px solid var(--k-line)',
            borderRadius: 12,
            background: '#0b0b12',
            marginTop: 10,
          }}
        />
      </div>

      <p className="k-sub" style={{ marginTop: 18, maxWidth: 760 }}>
        {locale === 'cs'
          ? 'Surové archivy (legacy ~385 MB, portfolio ~33 MB) do Kingdomu nepatří — zůstávají na původním místě. Archiv v3 je web, ne sklad.'
          : 'The raw archives (legacy ~385 MB, portfolio ~33 MB) do not belong in Kingdom — they stay where they were. Archive v3 is the website, not the warehouse.'}
      </p>

      <p className="k-sub" style={{ marginTop: 8 }}>
        <a href="/room">{locale === 'cs' ? '← Zpět do Místnosti' : '← Back to the Room'}</a>
      </p>
    </>
  );
}
