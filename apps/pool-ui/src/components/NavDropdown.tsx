'use client';

import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Pill-nav dropdown (HeroMiners-style grouped menu). Click-to-toggle so it
 * works on touch; closes on Escape / outside click / item navigation.
 */
export default function NavDropdown({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`rasta-nav-dropdown ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="rasta-nav-link rasta-nav-drop-btn"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <ChevronDown size={12} className="rasta-nav-drop-chevron" aria-hidden />
      </button>
      {open && (
        <div className="rasta-nav-dropmenu" role="menu" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}
