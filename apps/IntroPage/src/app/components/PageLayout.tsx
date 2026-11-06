"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import "../../../../shared/ui/rasta-nav.css";
import { LanguageMenu } from "../../../../shared/ui/LanguageMenu";
import { readPublicLang, writePublicLang, type PublicLang } from "../../../../shared/i18n/persist";

function normalize(p: string) {
  return p.replace(/\/$/, "") || "/";
}

export default function PageLayout({
  children,
  lang,
  setLang,
}: {
  children: ReactNode;
  lang: PublicLang;
  setLang: (lang: PublicLang) => void;
}) {
  const path = normalize(usePathname());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = readPublicLang();
    if (saved) setLang(saved);
    // The page owns the state; this only picks up a choice made elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const choose = (next: PublicLang) => {
    setLang(next);
    writePublicLang(next);
  };

  const nav: { href: string; label: { cs: string; en: string; es?: string; pt?: string; fr?: string }; external?: boolean }[] = [
    { href: "/", label: { cs: "Domů", en: "Home", es: "Inicio", pt: "Início", fr: "Accueil" } },
    { href: "/amenti", label: { cs: "Amenti", en: "Amenti" } },
    { href: "/evoluzion", label: { cs: "EvoluZion", en: "EvoluZion" } },
    { href: "/camp", label: { cs: "Camp", en: "Camp" } },
    { href: "/Vzestup", label: { cs: "Vzestup", en: "Ascension", es: "Ascensión", pt: "Ascensão", fr: "Ascension" } },
    {
      href: "https://freeworld.zionterranova.com",
      label: { cs: "Free World", en: "Free World" },
      external: true,
    },
  ];

  const close = () => setOpen(false);
  const text = (label: { cs: string; en: string; es?: string; pt?: string; fr?: string }) =>
    lang === "cs" ? label.cs : label[lang] || label.en;
  const menuLabel =
    lang === "cs"
      ? open ? "Zavřít menu" : "Otevřít menu"
      : lang === "es"
        ? open ? "Cerrar menú" : "Abrir menú"
        : lang === "pt"
          ? open ? "Fechar menu" : "Abrir menu"
          : lang === "fr"
            ? open ? "Fermer le menu" : "Ouvrir le menu"
            : open ? "Close menu" : "Open menu";

  useEffect(() => {
    document.body.classList.toggle("rasta-menu-open", open);
    return () => document.body.classList.remove("rasta-menu-open");
  }, [open]);

  return (
    <div className="relative z-10 flex min-h-screen w-full flex-col">
      <nav className="rasta-nav">
        <div className="rasta-nav-pill">
          <a
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
          </a>

          <div className="rasta-nav-menu rasta-desktop-menu">
            {nav.map((n) =>
              n.external ? (
                <a
                  key={n.href}
                  href={n.href}
                  target="_blank"
                  rel="noopener"
                  onClick={close}
                  className="rasta-nav-link"
                >
                  {text(n.label)}
                </a>
              ) : n.href === "/" ? (
                <a
                  key={n.href}
                  href="/"
                  onClick={close}
                  className={`rasta-nav-link ${
                    path === n.href ? "active" : ""
                  }`}
                >
                  {text(n.label)}
                </a>
              ) : (
                <Link
                  key={n.href}
                  href={n.href + "/"}
                  onClick={close}
                  className={`rasta-nav-link ${
                    path === n.href ? "active" : ""
                  }`}
                >
                  {text(n.label)}
                </Link>
              )
            )}
          </div>

          <div className="rasta-nav-right">
            <div className="rasta-nav-actions">
              <LanguageMenu lang={lang} setLang={choose} />
            </div>

            <button
              onClick={() => setOpen((s) => !s)}
              className={`rasta-hamburger ${open ? "active" : ""}`}
              aria-label={menuLabel}
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

          {nav.map((n) =>
            n.external ? (
              <a
                key={n.href}
                href={n.href}
                target="_blank"
                rel="noopener"
                onClick={close}
                className="rasta-nav-link"
              >
                {text(n.label)}
              </a>
            ) : n.href === "/" ? (
              <a
                key={n.href}
                href="/"
                onClick={close}
                className={`rasta-nav-link ${
                  path === n.href ? "active" : ""
                }`}
              >
                {text(n.label)}
              </a>
            ) : (
              <Link
                key={n.href}
                href={n.href + "/"}
                onClick={close}
                className={`rasta-nav-link ${
                  path === n.href ? "active" : ""
                }`}
              >
                {text(n.label)}
              </Link>
            )
          )}

          <div className="rasta-mobile-actions">
            <LanguageMenu lang={lang} setLang={choose} />
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
