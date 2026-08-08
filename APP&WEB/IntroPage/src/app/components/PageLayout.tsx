"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import "./rasta-nav.css";

function normalize(p: string) {
  return p.replace(/\/$/, "") || "/";
}

export default function PageLayout({
  children,
  lang,
  setLang,
}: {
  children: ReactNode;
  lang: "cs" | "en";
  setLang: (lang: "cs" | "en") => void;
}) {
  const path = normalize(usePathname());
  const [open, setOpen] = useState(false);

  const nav = [
    { href: "/", label: { cs: "Domů", en: "Home" } },
    { href: "/amenti", label: { cs: "Amenti", en: "Amenti" } },
    { href: "/evoluzion", label: { cs: "EvoluZion", en: "EvoluZion" } },
    { href: "/camp", label: { cs: "Camp", en: "Camp" } },
    { href: "/blog", label: { cs: "Blog", en: "Blog" } },
    { href: "/Vzestup", label: { cs: "Vzestup", en: "Ascension" } },
  ];

  const close = () => setOpen(false);

  useEffect(() => {
    document.body.classList.toggle("rasta-menu-open", open);
    return () => document.body.classList.remove("rasta-menu-open");
  }, [open]);

  return (
    <div className="relative z-10 flex min-h-screen w-full flex-col">
      <nav className="rasta-nav">
        <div className="rasta-nav-pill">
          <Link
            href="/"
            className="rasta-nav-logo-link"
            onClick={close}
          >
            <img
              src="/symbol-200x200.png"
              alt="ZION"
              width={38}
              height={38}
              className="rasta-nav-logo-img"
            />
            <div className="rasta-nav-logo-text">
              <span className="rasta-nav-brand">ZION</span>
              <span className="rasta-nav-kicker">TerraNova</span>
            </div>
          </Link>

          <div className="rasta-nav-menu rasta-desktop-menu">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href === "/" ? "/" : n.href + "/"}
                onClick={close}
                className={`rasta-nav-link ${
                  path === n.href ? "active" : ""
                }`}
              >
                {n.label[lang]}
              </Link>
            ))}
          </div>

          <div className="rasta-nav-right">
            <div className="rasta-nav-actions">
              <button
                onClick={() => setLang("cs")}
                className={`rasta-lang-switch ${
                  lang === "cs" ? "active" : ""
                }`}
              >
                CZ
              </button>
              <button
                onClick={() => setLang("en")}
                className={`rasta-lang-switch ${
                  lang === "en" ? "active" : ""
                }`}
              >
                EN
              </button>
            </div>

            <button
              onClick={() => setOpen((s) => !s)}
              className={`rasta-hamburger ${open ? "active" : ""}`}
              aria-label={open ? "Zavřít menu" : "Otevřít menu"}
              aria-expanded={open}
            >
              <span className="bar" />
              <span className="bar" />
              <span className="bar" />
            </button>
          </div>
        </div>

        <div className={`rasta-mobile-menu ${open ? "open" : ""}`}>
          <div className="rasta-mobile-brand">
            <img
              src="/symbol-200x200.png"
              alt="ZION"
              width={34}
              height={34}
              className="rasta-nav-logo-img"
            />
            <div className="rasta-nav-logo-text">
              <span className="rasta-nav-brand">ZION</span>
              <span className="rasta-nav-kicker">TerraNova</span>
            </div>
          </div>

          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href === "/" ? "/" : n.href + "/"}
              onClick={close}
              className={`rasta-nav-link ${
                path === n.href ? "active" : ""
              }`}
            >
              {n.label[lang]}
            </Link>
          ))}

          <div className="rasta-mobile-actions">
            <button
              onClick={() => setLang("cs")}
              className={`rasta-lang-switch ${
                lang === "cs" ? "active" : ""
              }`}
            >
              CZ
            </button>
            <button
              onClick={() => setLang("en")}
              className={`rasta-lang-switch ${
                lang === "en" ? "active" : ""
              }`}
            >
              EN
            </button>
          </div>
        </div>
      </nav>

      <main id="main" className="flex-grow">
        {children}
      </main>

      <footer className="border-t border-white/10 bg-black/60 py-8 text-center text-sm text-gray-500">
        <p>© 2026 ZION TerraNova® | One Love</p>
      </footer>

      <Script src="/assets/js/starfield-bg.js" strategy="lazyOnload" />
    </div>
  );
}
