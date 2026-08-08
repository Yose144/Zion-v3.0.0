"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import PageLayout from "../components/PageLayout";
import HeroImage from "../components/HeroImage";
import data from "../data/amenti-data.json";

export default function AmentiPage() {
  const [lang, setLang] = useState<"cs" | "en">("cs");
  const [slide, setSlide] = useState(0);
  const t = data[lang];

  return (
    <PageLayout lang={lang} setLang={setLang}>
      {/* Hero */}
      <HeroImage
        src="/legacy/img/144Halls.jpg"
        alt="Halls of Amenti"
        className="py-20 md:py-28"
      >
        <span className="rounded-full border border-[#fcd116]/30 bg-black/40 px-4 py-1 text-sm font-semibold text-[#fcd116] backdrop-blur-sm">
          {t.badge}
        </span>
        <h1 className="text-5xl font-extrabold tracking-tight text-white md:text-7xl">
          {t.title}
        </h1>
        <h2 className="max-w-2xl text-xl text-[#fcd116] md:text-2xl">
          {t.subtitle}
        </h2>
        <p className="max-w-xl text-white/70">{t.tagline}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
          <a href="#library" className="button primary small rasta-gold">
            <i className="fa-solid fa-book"></i> {t.libraryCta}
          </a>
          <Link href="/" className="button primary small rasta-green">
            <i className="fa-solid fa-arrow-left"></i> {t.backCta}
          </Link>
        </div>
      </HeroImage>

      <article className="active">
        {/* Amenti image */}
        <section className="py-8 text-center">
          <Image
            src="/legacy/img/144Halls.jpg"
            alt="Halls of Amenti"
            width={800}
            height={400}
            sizes="(max-width: 768px) 100vw, 800px"
            decoding="async"
            className="mx-auto h-auto w-full max-w-3xl rounded-lg opacity-90"
            priority
          />
        </section>

        {/* Intro */}
        <section id="intro">
          <div className="text-center">
            <h2 className="major">{t.introTitle}</h2>
          </div>
          <p>{t.introP1}</p>
          <p>{t.introP2}</p>
          <blockquote className="my-6 border-l-4 border-[#fcd116] bg-[rgba(252,209,22,0.04)] p-4 italic text-[#fcd116]">
            {t.introQuote}
          </blockquote>
        </section>

        {/* Guardians */}
        <section id="guardians">
          <div className="text-center">
            <h2 className="major">{t.guardiansTitle}</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.guardians.map((g) => (
              <div
                key={g.title}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center backdrop-blur-sm transition hover:border-[#fcd116]/40"
              >
                <h4 className="mb-2 text-[#fcd116]">{g.title}</h4>
                <p className="!text-sm !text-white/70">{g[lang]}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Chronicles */}
        <section id="chronicles">
          <div className="text-center">
            <h2 className="major">{t.chroniclesTitle}</h2>
          </div>
          <p>{t.chroniclesP1}</p>
          <p>{t.chroniclesP2}</p>
          <div className="my-8 text-center">
            <Image
              src="/legacy/img/logos.png"
              alt="Logos of Amenti"
              width={400}
              height={120}
              sizes="(max-width: 768px) 100vw, 400px"
              decoding="async"
              className="mx-auto h-auto w-full max-w-[400px]"
            />
          </div>
        </section>

        {/* Heart */}
        <section id="heart">
          <div className="text-center">
            <h2 className="major">{t.heartTitle}</h2>
          </div>
          <p>{t.heartP1}</p>
          <p>{t.heartP2}</p>
          <div className="my-6 text-center text-lg font-bold tracking-widest text-[#fcd116]">
            {t.heartMantra}
          </div>
          <div className="my-8 text-center">
            <Image
              src="/legacy/img/Heart2012.jpg"
              alt="Heart of Amenti"
              width={720}
              height={400}
              sizes="(max-width: 768px) 100vw, 720px"
              decoding="async"
              className="mx-auto h-auto w-full max-w-3xl rounded-2xl"
            />
          </div>
        </section>

        {/* Library */}
        <section id="library">
          <div className="text-center">
            <h2 className="major">{t.libraryTitle}</h2>
          </div>
          <p>{t.libraryDesc}</p>
          <div className="my-6 flex flex-wrap gap-3">
            {t.libraryChips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-[#fcd116]"
              >
                <i className="fa-solid fa-feather mr-1"></i> {chip}
              </span>
            ))}
          </div>

          {/* Vzestup banner */}
          <a
            href="/legacy/Vzestup/index.html"
            className="my-6 flex items-center gap-4 rounded-xl border border-[#9333ea]/30 bg-gradient-to-r from-[#4c1d95]/40 to-[#7c3aed]/20 p-4 no-underline transition hover:border-[#a855f7]"
          >
            <Image
              src="/legacy/Vzestup/vzestup.webpark.cz/portal.jpg"
              alt="Vzestup"
              width={80}
              height={80}
              sizes="80px"
              decoding="async"
              className="rounded-full"
            />
            <div className="text-left">
              <span className="text-xs font-bold text-[#c084fc]">🔮 DUCHOVNÍ PORTÁL</span>
              <h3 className="!my-0 !text-lg text-white">Vzestup & Duchovní růst</h3>
              <p className="!my-0 !text-sm !text-white/60">
                Fialový plamen · Duchovní škola vzestupu · WingMakers · 100+ článků
              </p>
            </div>
          </a>

          {/* Featured book */}
          <div className="my-8 flex flex-col gap-4 rounded-2xl border border-[#fcd116]/20 bg-white/[0.03] p-6 md:flex-row">
            <Image
              src="/images/Zion.jpg"
              alt={t.featuredBookTitle}
              width={160}
              height={220}
              sizes="160px"
              decoding="async"
              className="rounded-lg"
            />
            <div>
              <span className="text-xs font-bold text-[#078930]">{t.featuredBookTag}</span>
              <h3 className="!my-2 text-[#fcd116]">{t.featuredBookTitle}</h3>
              <p className="!text-white/70">{t.featuredBookDesc}</p>
              <a
                href="/legacy/books/QuantumRevolution.zip"
                className="button primary small rasta-gold mt-4 inline-flex"
              >
                <i className="fa-solid fa-file-zipper"></i> {t.featuredBookCta}
              </a>
              <p className="!mt-3 !text-xs !text-white/50">CZ · EN · ES · FR · PT · DE · JP · HI · LA · SANS · HAW</p>
            </div>
          </div>

          {/* Books table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#fcd116]/30 text-[#fcd116]">
                  <th className="py-2 text-left">{t.langsLabel}</th>
                  <th className="py-2">CZ</th>
                  <th className="py-2">EN</th>
                  <th className="py-2">ES</th>
                  <th className="py-2">FR</th>
                  <th className="py-2">PT</th>
                </tr>
              </thead>
              <tbody>
                {data.books.map((book) => (
                  <tr key={book.title} className="border-b border-white/5">
                    <td className="py-3 pr-2 text-left font-semibold text-white">
                      {lang === "cs" && book.title ? book.title : book.titleEn || book.title}
                    </td>
                    {["CZ", "EN", "ES", "FR", "PT"].map((l) => {
                      const links = book.links as Record<string, string | undefined>;
                      return (
                        <td key={l} className="py-3 text-center">
                          {links[l] ? (
                            <a
                              href={links[l]}
                              className="inline-flex items-center gap-1 rounded-full border border-[#fcd116]/30 bg-[#fcd116]/10 px-2 py-1 text-xs text-[#fcd116] no-underline transition hover:bg-[#fcd116]/20"
                              target="_blank"
                              rel="noopener"
                            >
                              <i className="fa-solid fa-download"></i> PDF
                            </a>
                          ) : (
                            <span className="text-white/30">N/A</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="!mt-4 !text-center !text-sm !text-white/50">{t.missingLang}</p>
        </section>

        {/* Goloka */}
        <section id="goloka">
          <div className="text-center">
            <h2 className="major">{t.golokaTitle}</h2>
          </div>
          <p>{t.golokaDesc}</p>
          <a
            href="https://vedabase.io/en/library/"
            target="_blank"
            rel="noopener"
            className="button primary small rasta-green"
          >
            <i className="fa-solid fa-link"></i> {t.golokaCta}
          </a>

          <div className="relative mx-auto mt-8 max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-black/40">
            <div className="flex transition-transform duration-500" style={{ transform: `translateX(-${slide * 100}%)` }}>
              {data.golokaImages.map((img) => (
                <div key={img.alt} className="w-full flex-shrink-0 p-6 text-center">
                  <Image
                    src={img.src}
                    alt={img.alt}
                    width={500}
                    height={300}
                    sizes="(max-width: 768px) 100vw, 500px"
                    decoding="async"
                    className="mx-auto h-auto w-full max-w-xl rounded-xl"
                  />
                  <p className="!mt-3 !text-white/80">{img.alt}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => setSlide((s) => (s === 0 ? data.golokaImages.length - 1 : s - 1))}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-[#fcd116] hover:bg-black/80"
              aria-label="Previous"
            >
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <button
              onClick={() => setSlide((s) => (s === data.golokaImages.length - 1 ? 0 : s + 1))}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-[#fcd116] hover:bg-black/80"
              aria-label="Next"
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>
            <div className="mb-4 flex justify-center gap-2">
              {data.golokaImages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlide(i)}
                  className={`h-2 w-2 rounded-full transition ${i === slide ? "bg-[#fcd116]" : "bg-white/30"}`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Protectors */}
        <section id="protectors">
          <div className="text-center">
            <h2 className="major">{t.protectorsTitle}</h2>
          </div>
          <p>{t.protectorsP1}</p>
          <div className="mx-auto my-6 grid max-w-2xl gap-4 sm:grid-cols-3">
            {data.protectors.map((p) => (
              <div
                key={p.title}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center"
              >
                <strong className="text-[#fcd116]">{p.title}</strong>
                <p className="!my-0 !text-sm !text-white/60">{p.subtitle}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <Image
              src="/legacy/img/tibet.jpg"
              alt="Tibet guardians"
              width={200}
              height={200}
              sizes="200px"
              decoding="async"
              className="rounded-xl"
            />
            <Image
              src="/legacy/img/varja.png"
              alt="Varja symbol"
              width={200}
              height={200}
              sizes="200px"
              decoding="async"
              className="rounded-xl"
            />
          </div>
        </section>

        {/* CTA */}
        <section id="cta" className="text-center">
          <h2 className="major">{t.ctaTitle}</h2>
          <p>{t.ctaP1}</p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="/legacy/shop.html" className="button primary small rasta-gold">
              <i className="fa-solid fa-cart-shopping"></i> {t.shopCta}
            </a>
            <a href="/legacy/donate.html" className="button primary small rasta-green">
              <i className="fa-solid fa-hand-holding-heart"></i> {t.donateCta}
            </a>
          </div>
        </section>
      </article>
    </PageLayout>
  );
}
