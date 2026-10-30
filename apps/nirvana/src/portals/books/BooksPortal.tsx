'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/core/i18n';

interface BookTitle {
  id: string;
  title: string;
}

function readBooks(payload: unknown): BookTitle[] {
  if (!payload || typeof payload !== 'object') return [];
  const list = (payload as { books?: unknown }).books;
  if (!Array.isArray(list)) return [];
  return list.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const item = row as { id?: unknown; title?: unknown };
    if (typeof item.id !== 'string' || typeof item.title !== 'string') return [];
    return [{ id: item.id, title: item.title }];
  });
}

export function BooksPortal({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n();
  const [books, setBooks] = useState<BookTitle[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch('/api/books', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<unknown>;
      })
      .then((body) => {
        if (!live) return;
        setBooks(readBooks(body));
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const title = lang === 'cs' ? 'Knihy' : 'Books';

  return (
    <aside className="portal" role="dialog" aria-label={title}>
      <header className="portal-head">
        <h2>{title}</h2>
        <button type="button" onClick={onClose}>
          {t('close')}
        </button>
      </header>
      {failed && <p>{t('booksEmpty')}</p>}
      {!failed && books == null && <p>…</p>}
      {books && books.length === 0 && !failed && <p>{t('booksEmpty')}</p>}
      {books && books.length > 0 && (
        <ul>
          {books.map((book) => (
            <li key={book.id}>{book.title}</li>
          ))}
        </ul>
      )}
    </aside>
  );
}
