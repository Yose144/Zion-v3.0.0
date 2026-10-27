'use client';

import BookReader from '@/components/books/BookReader';
import { getBook } from '@/lib/books/registry';

export default function BookPage() {
  return <BookReader book={getBook('nirvana')!} />;
}
