"use client";

import { useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { Menu, X } from "lucide-react";

export default function PageLayout({
  children,
  lang,
  setLang,
}: {
  children: ReactNode;
  lang: "cs" | "en";
  setLang: (lang: "cs" | "en") => void;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const nav = [
    { href: "/", label: { cs: "Domů", en: "Home" } },
    { href: "/amenti", label: { cs: "Amenti", en: "Amenti" } },
    { href: "/evoluzion", label: { cs: "EvoluZion", en: "EvoluZion" } },
    { href: "/camp", label: { cs: "Camp", en: "Camp" } },
    { href: "/blog", label: { cs: "Blog", en: "Blog" } },
    { href: "/portfolio/", label: { cs: "Portfolio", en: "Portfolio" } },
    { href: "/seeds/", label: { cs: "Seeds", en: "Seeds" } },
    { href: "/Vzestup/", label: { cs: "Vzestup", en: "Ascension" } },
  ];

  const close = () => setOpen(false);

  return (
    <div className="relative z-10 flex min-h-screen w-full flex-col">
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-[rgba(252,209,22,0.16)] bg-[rgba(13,13,13,0.68)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="text-lg font-bold tracking-wide text-[#fcd116]"
            onClick={close}
          >
            ZION TerraNova<span className="text-white">®</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`transition hover:text-[#fcd116] ${
                  path === n.href ? "text-[#fcd116]" : "text-gray-300"
                }`}
              >
                {n.label[lang]}
              </Link>
            ))}
            <div className="ml-2 flex rounded-lg border border-white/20 bg-white/5 text-xs">
              <button
                onClick={() => setLang("cs")}
                className={`rounded-l-lg px-2 py-1 ${
                  lang === "cs"
                    ? "bg-gradient-to-r from-[#078930] to-[#fcd116] font-semibold text-black"
                    : ""
                }`}
              >
                CZ
              </button>
              <button
                onClick={() => setLang("en")}
                className={`rounded-r-lg px-2 py-1 ${
                  lang === "en"
                    ? "bg-gradient-to-r from-[#078930] to-[#fcd116] font-semibold text-black"
                    : ""
                }`}
              >
                EN
              </button>
            </div>
          </nav>

          {/* Mobile hamburger */}
          <button
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#fcd116]/30 bg-[#fcd116]/10 text-[#fcd116] transition hover:bg-[#fcd116]/20 md:hidden"
            onClick={() => setOpen((s) => !s)}
            aria-label={open ? "Zavřít menu" : "Otevřít menu"}
            aria-expanded={open}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="absolute left-0 right-0 top-full border-b border-[#fcd116]/20 bg-[rgba(13,13,13,0.95)] px-4 pb-6 pt-4 shadow-2xl backdrop-blur-md md:hidden">
            <nav className="flex flex-col gap-3">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={close}
                  className={`rounded-lg px-4 py-2 text-base font-medium transition hover:bg-white/5 hover:text-[#fcd116] ${
                    path === n.href
                      ? "text-[#fcd116]"
                      : "text-gray-300"
                  }`}
                >
                  {n.label[lang]}
                </Link>
              ))}
            </nav>
            <div className="mt-4 flex justify-center gap-2 rounded-lg border border-white/20 bg-white/5 p-1 text-xs">
              <button
                onClick={() => setLang("cs")}
                className={`flex-1 rounded-md px-3 py-1.5 ${
                  lang === "cs"
                    ? "bg-gradient-to-r from-[#078930] to-[#fcd116] font-semibold text-black"
                    : "text-white/70"
                }`}
              >
                CZ
              </button>
              <button
                onClick={() => setLang("en")}
                className={`flex-1 rounded-md px-3 py-1.5 ${
                  lang === "en"
                    ? "bg-gradient-to-r from-[#078930] to-[#fcd116] font-semibold text-black"
                    : "text-white/70"
                }`}
              >
                EN
              </button>
            </div>
          </div>
        )}
      </header>

      <main id="main" className="flex-grow pt-16">
        {children}
      </main>

      <footer className="border-t border-white/10 bg-black/60 py-8 text-center text-sm text-gray-500">
        <p>© 2026 ZION TerraNova® | One Love</p>
      </footer>

      <Script src="/assets/js/starfield-bg.js" strategy="lazyOnload" />
    </div>
  );
}
