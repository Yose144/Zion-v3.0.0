"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import type { PublicLang } from "../../../../shared/i18n/persist";

type Label = { cs: string; en: string; es?: string; pt?: string; fr?: string };

function lab(label: Label, lang: PublicLang): string {
  if (lang === "cs") return label.cs;
  if (lang === "es") return label.es || label.en;
  if (lang === "pt") return label.pt || label.en;
  if (lang === "fr") return label.fr || label.en;
  return label.en;
}

const GROUP_PAGES: Label = { cs: "Stránky", en: "Pages", es: "Páginas", pt: "Páginas", fr: "Pages" };
const GROUP_ECOSYSTEM: Label = { cs: "Ekosystém", en: "Ecosystem", es: "Ecosistema", pt: "Ecossistema", fr: "Écosystème" };
const BUTTON_LABEL: Label = GROUP_ECOSYSTEM;

// Site index — stejné destinace jako top-nav dropdown na / (maintenance.html).
const PAGES: { href: string; label: Label; sub: string }[] = [
  { href: "/amenti/", label: { cs: "Amenti", en: "Amenti" }, sub: "/amenti/" },
  { href: "/evoluzion/", label: { cs: "EvoluZion", en: "EvoluZion" }, sub: "/evoluzion/" },
  { href: "/camp/", label: { cs: "Camp", en: "Camp" }, sub: "/camp/" },
  { href: "/Vzestup/", label: { cs: "Vzestup", en: "Ascension", es: "Ascensión", pt: "Ascensão", fr: "Ascension" }, sub: "/Vzestup/" },
  { href: "/blog/", label: { cs: "Blog", en: "Blog" }, sub: "/blog/" },
  { href: "/seeds/", label: { cs: "Seeds", en: "Seeds" }, sub: "/seeds/" },
  { href: "/vast-rigs/", label: { cs: "Vast Rigs", en: "Vast Rigs" }, sub: "/vast-rigs/" },
];

const ECOSYSTEM: { href: string; label: Label; sub: string }[] = [
  { href: "https://market.zionterranova.com", label: { cs: "Market", en: "Market" }, sub: "market.zionterranova.com" },
  { href: "https://nirvana.zionterranova.com", label: { cs: "Nirvana", en: "Nirvana" }, sub: "nirvana.zionterranova.com" },
  { href: "https://lumi.zionterranova.com", label: { cs: "Lumi", en: "Lumi" }, sub: "lumi.zionterranova.com" },
  { href: "https://pool.zionterranova.com", label: { cs: "Pool", en: "Pool" }, sub: "pool.zionterranova.com" },
  { href: "https://freeworld.zionterranova.com", label: { cs: "Free World", en: "Free World" }, sub: "freeworld.zionterranova.com" },
  { href: "https://app.zionterranova.com/onboard", label: { cs: "Onboard", en: "Onboard" }, sub: "app.zionterranova.com/onboard" },
  { href: "https://app.zionterranova.com/docs", label: { cs: "Docs", en: "Docs" }, sub: "app.zionterranova.com/docs" },
];

function DropItem({
  href,
  label,
  sub,
  external,
  lang,
  onNavigate,
}: {
  href: string;
  label: Label;
  sub: string;
  external?: boolean;
  lang: PublicLang;
  onNavigate?: () => void;
}) {
  const inner = (
    <span className="rasta-nav-dropitem-main">
      {lab(label, lang)}
      <span className="rasta-nav-dropitem-sub">{sub}</span>
    </span>
  );
  const ext = external ? <ExternalLink size={12} className="rasta-nav-dropitem-ext" aria-hidden /> : null;
  const cls = "rasta-nav-dropitem";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener" role="menuitem" className={cls} onClick={onNavigate}>
        {inner}
        {ext}
      </a>
    );
  }
  return (
    <Link href={href} role="menuitem" className={cls} onClick={onNavigate}>
      {inner}
    </Link>
  );
}

/** Desktop pill dropdown — site index (Stránky + Ekosystém). Click-toggle,
 *  Escape / outside-click zavírá. Stejný pattern jako pool-ui NavDropdown. */
export function SiteDirectoryDropdown({ lang = "cs" }: { lang?: PublicLang }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`rasta-nav-dropdown ${open ? "open" : ""}`}>
      <button
        type="button"
        className="rasta-nav-link rasta-nav-drop-btn"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        {lab(BUTTON_LABEL, lang)}
        <ChevronDown size={12} className="rasta-nav-drop-chevron" aria-hidden />
      </button>
      {open && (
        <div className="rasta-nav-dropmenu" role="menu" onClick={() => setOpen(false)}>
          <div className="rasta-nav-dropheader">{lab(GROUP_PAGES, lang)}</div>
          {PAGES.map((p) => (
            <DropItem key={p.href} href={p.href} label={p.label} sub={p.sub} lang={lang} />
          ))}
          <div className="rasta-nav-dropheader">{lab(GROUP_ECOSYSTEM, lang)}</div>
          {ECOSYSTEM.map((e) => (
            <DropItem key={e.href} href={e.href} label={e.label} sub={e.sub} external lang={lang} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Mobile drawer groups — stejné skupiny jako desktop dropdown. */
export function SiteDirectoryMobile({
  lang = "cs",
  onNavigate,
}: {
  lang?: PublicLang;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="rasta-mobile-subheader">{lab(GROUP_PAGES, lang)}</div>
      {PAGES.map((p) => (
        <DropItem key={p.href} href={p.href} label={p.label} sub={p.sub} lang={lang} onNavigate={onNavigate} />
      ))}
      <div className="rasta-mobile-subheader">{lab(GROUP_ECOSYSTEM, lang)}</div>
      {ECOSYSTEM.map((e) => (
        <DropItem key={e.href} href={e.href} label={e.label} sub={e.sub} external lang={lang} onNavigate={onNavigate} />
      ))}
    </>
  );
}
