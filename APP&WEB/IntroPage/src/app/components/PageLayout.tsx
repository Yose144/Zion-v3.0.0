"use client";

import Link from "next/link";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

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

  const nav = [
    { href: "/", label: { cs: "Domů", en: "Home" } },
    { href: "/amenti", label: { cs: "Amenti", en: "Amenti" } },
    { href: "/evoluzion", label: { cs: "EvoluZion", en: "EvoluZion" } },
    { href: "/camp", label: { cs: "Camp", en: "Camp" } },
    { href: "/blog", label: { cs: "Blog", en: "Blog" } },
    { href: "/portfolio/", label: { cs: "Portfolio", en: "Portfolio" } },
    { href: "/seeds/", label: { cs: "Seeds", en: "Seeds" } },
  ];

  return (
    <div className="relative z-10 flex min-h-screen w-full flex-col">
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-[rgba(252,209,22,0.16)] bg-[rgba(13,13,13,0.68)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold tracking-wide text-[#fcd116]">
            ZION TerraNova<span className="text-white">®</span>
          </Link>
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
                className={`px-2 py-1 rounded-l-lg ${
                  lang === "cs"
                    ? "bg-gradient-to-r from-[#078930] to-[#fcd116] text-black font-semibold"
                    : ""
                }`}
              >
                CZ
              </button>
              <button
                onClick={() => setLang("en")}
                className={`px-2 py-1 rounded-r-lg ${
                  lang === "en"
                    ? "bg-gradient-to-r from-[#078930] to-[#fcd116] text-black font-semibold"
                    : ""
                }`}
              >
                EN
              </button>
            </div>
          </nav>
        </div>
      </header>

      <main id="main" className="flex-grow pt-16">
        {children}
      </main>

      <footer className="border-t border-white/10 bg-black/60 py-8 text-center text-sm text-gray-500">
        <p>© 2026 ZION TerraNova® | One Love</p>
      </footer>

      <Script src="/assets/js/starfield-bg.js" strategy="afterInteractive" />
    </div>
  );
}
