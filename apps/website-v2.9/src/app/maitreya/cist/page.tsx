'use client';

import BookReader from '@/components/books/BookReader';
import { MAITREYA_BOOK } from '@/lib/books/registry';

export default function MaitreyaBookPage() {
  return <BookReader book={MAITREYA_BOOK} />;
}
