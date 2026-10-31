import type { Locale } from '@zion/contract';
import { t } from '@zion/i18n';
import { EXTERNAL } from '@/core/api';
import catalog from '@/core/books/catalog.json';
import { manifest } from './manifest';

interface BookEntry {
  id: string;
  title: string;
  tagline: string;
  en: boolean;
}

const BOOKS = catalog as BookEntry[];

export default function BooksPortal({ locale }: { locale: Locale }) {
  if (BOOKS.length === 0) {
    return <div className="k-empty">{t(locale, 'noData')}</div>;
  }

  return (
    <>
      <div className="k-meta" style={{ marginBottom: 14 }}>
        <span>
          {BOOKS.length} {t(locale, 'books').toLowerCase()}
        </span>
        <a href={EXTERNAL.library} target="_blank" rel="noreferrer" style={{ color: 'var(--k-accent)' }}>
          {t(locale, 'docs')} →
        </a>
      </div>

      <div className="k-grid">
        {BOOKS.map((book) => (
          <article key={book.id} className="k-card">
            <div className="k-card-title">{book.title}</div>
            <p className="k-card-desc">{book.tagline}</p>
            <div className="k-meta">
              <span className="k-badge">{book.id}</span>
              {book.en ? <span className="k-badge" data-tone="soon">EN</span> : null}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
