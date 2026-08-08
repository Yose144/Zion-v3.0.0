"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const navItems = [
  { id: "hero", label: "Úvod" },
  { id: "portals", label: "Brány Portálu" },
  { id: "lyara", label: "Lyara" },
  { id: "sheldan", label: "Sheldan Nidle" },
  { id: "vule-bozi", label: "Vůle Boží" },
  { id: "extra", label: "Metatron" },
  { id: "asea-lol", label: "ASEA & Odkazy" },
];

export default function VzestupNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-[rgba(155,89,182,0.25)] bg-[rgba(10,10,20,0.85)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold tracking-wide text-[#d2b4de]"
          onClick={() => setOpen(false)}
        >
          <span className="text-[#f1c40f]">ZION</span>
          <span className="text-white/80">Vzestup</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 text-sm font-medium md:flex">
          {navItems.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              className="rounded-lg px-3 py-2 text-[#d2b4de] transition hover:bg-white/5 hover:text-[#f1c40f]"
              onClick={() => setOpen(false)}
            >
              {n.label}
            </a>
          ))}
          <a
            href="/amenti/"
            className="ml-2 rounded-lg border border-[#f1c40f]/30 px-3 py-1.5 text-xs font-semibold text-[#f1c40f] transition hover:bg-[#f1c40f]/10"
          >
            Amenti
          </a>
        </nav>

        {/* Mobile hamburger */}
        <button
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#9b59b6]/40 bg-[#9b59b6]/10 text-[#d2b4de] transition hover:bg-[#9b59b6]/20 md:hidden"
          onClick={() => setOpen((s) => !s)}
          aria-label={open ? "Zavřít menu" : "Otevřít menu"}
          aria-expanded={open}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="absolute left-0 right-0 top-full border-b border-[#9b59b6]/25 bg-[rgba(10,10,20,0.97)] px-4 pb-5 pt-4 shadow-2xl backdrop-blur-md md:hidden">
          <nav className="flex flex-col gap-2">
            {navItems.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className="rounded-lg px-4 py-2 text-base text-[#d2b4de] transition hover:bg-white/5 hover:text-[#f1c40f]"
                onClick={() => setOpen(false)}
              >
                {n.label}
              </a>
            ))}
            <a
              href="/amenti/"
              className="mt-2 rounded-lg border border-[#f1c40f]/30 px-4 py-2 text-center text-sm font-semibold text-[#f1c40f] transition hover:bg-[#f1c40f]/10"
              onClick={() => setOpen(false)}
            >
              Amenti
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
