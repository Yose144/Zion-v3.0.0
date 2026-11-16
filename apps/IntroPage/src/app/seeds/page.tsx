"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import PageLayout from "../components/PageLayout";
import data from "../data/seeds-data.json";

type Lang = "cs" | "en" | "es" | "pt" | "fr";

function pick<T>(block: { cs: T; en: T; es?: T; pt?: T; fr?: T }, lang: string): T {
  if (lang === "es" && block.es) return block.es;
  if (lang === "pt" && block.pt) return block.pt;
  if (lang === "fr" && block.fr) return block.fr;
  if (lang === "cs") return block.cs;
  return block.en;
}

export default function SeedsIndexPage() {
  const [lang, setLang] = useState<Lang>("cs");
  const [activeSlug, setActiveSlug] = useState(data.strains[0].slug);

  const t = pick(data.index, lang);
  const active = data.strains.find((s: any) => s.slug === activeSlug) ?? data.strains[0];
  const caption = active.caption ? pick(active.caption, lang) : active.subtitle;

  return (
    <PageLayout lang={lang} setLang={setLang}>
      <div className="seeds-page">
        <section className="seeds-hero" aria-labelledby="seeds-hero-title">
          <Image
            src={data.heroImage}
            alt=""
            width={1672}
            height={941}
            priority
            sizes="100vw"
            className="seeds-hero__img"
          />
          <div className="seeds-frame seeds-hero__copy">
            <span className="seeds-kicker">{t.heroBadge}</span>
            <h1 id="seeds-hero-title">
              ZION <em>Seeds</em>
            </h1>
            <p>{t.heroSubtitle}</p>
            <a className="seeds-cta" href="#strains">
              {t.cta} <span aria-hidden="true">↓</span>
            </a>
          </div>
        </section>

        <section className="seeds-collection" id="strains" aria-labelledby="seeds-title">
          <div className="seeds-frame">
            <h2 id="seeds-title">{t.title}</h2>

            <ul className="seeds-grid">
              {data.strains.map((strain: any) => (
                <li key={strain.slug} style={{ "--accent": strain.accent } as CSSProperties}>
                  <button
                    type="button"
                    className="seeds-card"
                    aria-pressed={activeSlug === strain.slug}
                    aria-controls="seeds-feature"
                    onClick={() => setActiveSlug(strain.slug)}
                  >
                    <Image
                      src={strain.image}
                      alt=""
                      width={1672}
                      height={941}
                      loading="lazy"
                      sizes="(max-width: 600px) 46vw, (max-width: 860px) 30vw, 18vw"
                    />
                    <span>{strain.name}</span>
                  </button>
                </li>
              ))}
            </ul>

            <div
              className="seeds-feature"
              id="seeds-feature"
              aria-live="polite"
              style={{ "--accent": active.accent } as CSSProperties}
            >
              <Image
                src={active.heroBg}
                alt=""
                width={1672}
                height={941}
                loading="lazy"
                sizes="(max-width: 860px) 100vw, 82rem"
                className="seeds-feature__img"
              />
              <div className="seeds-feature__copy">
                <h3>{active.name}</h3>
                <p>{caption}</p>
                <Link href={`/seeds/${active.slug}/`} className="seeds-feature__link">
                  Detail strainu <span aria-hidden="true">↗</span>
                </Link>
              </div>
            </div>

            <p className="seeds-footer-line">{pick(data.footer, lang)}</p>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
