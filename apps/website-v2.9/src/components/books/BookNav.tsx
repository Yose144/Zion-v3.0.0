'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronDown } from 'lucide-react';
import { BOOK_NAV, bookNavLabel } from '@/lib/books/registry';
import type { Lang } from '@/lib/books/types';

interface BookNavProps {
  lang: Lang;
  /** Book id that should render as the active slot instead of a link. */
  activeBookId?: string;
  /** Content rendered in place of the active book's row (title + chapter TOC). */
  renderActive?: () => React.ReactNode;
  /** Called when a non-active book link is clicked (e.g. close a mobile menu). */
  onNavigate?: () => void;
  /** Open every group by default (hub directory). Otherwise only the group holding the active book opens. */
  expandAll?: boolean;
}

/** Whole-library nav: collapsible groups → books; the active book can expand to a custom slot. */
export default function BookNav({ lang: l, activeBookId, renderActive, onNavigate, expandAll }: BookNavProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  return (
    <nav className="space-y-1.5">
      {BOOK_NAV.map((group) => {
        const hasActive = group.books.some((b) => b.id === activeBookId);
        const isOpen = openGroups[group.id] ?? (expandAll || hasActive);
        return (
          <div key={group.id}>
            <button
              onClick={() => setOpenGroups((prev) => ({ ...prev, [group.id]: !isOpen }))}
              className={`w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition-all rounded-lg ${
                hasActive ? 'text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              <span>{group.label[l]}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
              <div className="mt-0.5 space-y-0.5">
                {group.books.map((b) =>
                  b.id === activeBookId && renderActive ? (
                    <div key={b.id}>{renderActive()}</div>
                  ) : (
                    <Link
                      key={b.id}
                      href={b.href}
                      prefetch={false}
                      onClick={onNavigate}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                    >
                      <BookOpen className="w-3.5 h-3.5 shrink-0 text-gray-600" />
                      <span className="truncate">{bookNavLabel(b, l)}</span>
                    </Link>
                  )
                )}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
