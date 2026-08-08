"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import "./rasta-nav.css";

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
  const [activeHash, setActiveHash] = useState("");

  useEffect(() => {
    document.body.classList.toggle("rasta-menu-open", open);
    return () => document.body.classList.remove("rasta-menu-open");
  }, [open]);

  useEffect(() => {
    setActiveHash(window.location.hash.replace("#", ""));
    const onHash = () => setActiveHash(window.location.hash.replace("#", ""));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <nav className="rasta-nav">
      <div className="rasta-nav-pill">
        <Link
          href="/"
          className="rasta-nav-logo-link"
          onClick={() => setOpen(false)}
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
            <span className="rasta-nav-kicker">Vzestup</span>
          </div>
        </Link>

        <div className="rasta-nav-menu rasta-desktop-menu">
          {navItems.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              onClick={() => setOpen(false)}
              className={`rasta-nav-link ${
                activeHash === n.id ? "active" : ""
              }`}
            >
              {n.label}
            </a>
          ))}
        </div>

        <div className="rasta-nav-right rasta-nav-actions">
          <a
            href="/amenti/"
            className="rasta-nav-link"
            onClick={() => setOpen(false)}
          >
            Amenti
          </a>
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

        {/* Mobile hamburger is visible only on small screens */}
        <button
          onClick={() => setOpen((s) => !s)}
          className={`rasta-hamburger ${open ? "active" : ""}`}
          aria-label={open ? "Zavřít menu" : "Otevřít menu"}
          aria-expanded={open}
          style={{ marginLeft: "auto" }}
        >
          <span className="bar" />
          <span className="bar" />
          <span className="bar" />
        </button>
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
            <span className="rasta-nav-kicker">Vzestup</span>
          </div>
        </div>

        {navItems.map((n) => (
          <a
            key={n.id}
            href={`#${n.id}`}
            onClick={() => setOpen(false)}
            className={`rasta-nav-link ${
              activeHash === n.id ? "active" : ""
            }`}
          >
            {n.label}
          </a>
        ))}

        <a
          href="/amenti/"
          onClick={() => setOpen(false)}
          className="rasta-nav-link"
        >
          Amenti
        </a>
      </div>
    </nav>
  );
}
