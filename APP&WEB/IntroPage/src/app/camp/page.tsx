"use client";

import { useState } from "react";
import Image from "next/image";
import PageLayout from "../components/PageLayout";
import data from "../data/camp-data.json";

export default function CampPage() {
  const [lang, setLang] = useState<"cs" | "en">("cs");
  const [slide, setSlide] = useState(0);

  const t = {
    hero: data.hero[lang],
    about: data.about[lang],
    featuresTitle: data.featuresTitle[lang],
    features: data.features[lang],
    gallery: { title: data.gallery[lang].title, slides: data.gallery.slides },
    vision: data.vision[lang],
    footer: data.footer[lang],
    socials: data.socials,
    visionImage: data.vision.image,
    visionImageAlt: data.vision.imageAlt,
  };

  const next = () => setSlide((s) => (s === data.gallery.slides.length - 1 ? 0 : s + 1));
  const prev = () => setSlide((s) => (s === 0 ? data.gallery.slides.length - 1 : s - 1));

  return (
    <PageLayout lang={lang} setLang={setLang}>
      <section
        className="relative flex w-full flex-col items-center justify-center gap-6 px-4 py-28 text-center"
        style={{
          backgroundImage: `linear-gradient(120deg, rgba(0,0,0,0.85), rgba(6,20,12,0.8)), url('/legacy/img/org1.jpg')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <span className="rounded-full border border-[#078930]/30 bg-black/40 px-4 py-1 text-sm font-semibold text-[#078930] backdrop-blur-sm">
          {t.hero.badge}
        </span>
        <h1 className="text-5xl font-extrabold tracking-tight text-white md:text-7xl">
          {t.hero.title}
        </h1>
        <h2 className="max-w-2xl text-xl text-[#fcd116] md:text-2xl">
          {t.hero.subtitle}
        </h2>
        <p className="max-w-xl text-white/70">{t.hero.desc}</p>
        <a href="#camps-info" className="button primary small rasta-green">
          <i className="fa-solid fa-tent"></i> {t.hero.cta}
        </a>
      </section>

      <article className="active">
        <section id="camps-info">
          <div className="text-center">
            <h2 className="major">{t.about.title}</h2>
          </div>
          <p className="rasta-text" dangerouslySetInnerHTML={{ __html: t.about.p1 }} />
          <blockquote className="my-6 border-l-4 border-[#078930] bg-[rgba(7,137,48,0.04)] p-4 italic text-[#078930]">
            {t.about.quote}
          </blockquote>
        </section>

        <hr className="my-8 border-white/10" />

        <section id="features">
          <div className="text-center">
            <h2 className="major">{t.featuresTitle}</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {t.features.map((f: any, i: number) => (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-center backdrop-blur-sm transition hover:border-[#078930]/40"
              >
                <div className="mb-3 text-2xl text-[#078930]">
                  <i className={`fa-solid ${f.icon}`}></i>
                </div>
                <h4 className="mb-2 text-[#fcd116]">{f.title}</h4>
                <p className="!text-sm !text-white/70">{f.desc}</p>
                <span className="mt-3 inline-block rounded-full border border-[#fcd116]/30 bg-[#fcd116]/10 px-2 py-1 text-xs text-[#fcd116]">
                  {f.status}
                </span>
              </div>
            ))}
          </div>
        </section>

        <hr className="my-8 border-white/10" />

        <section id="gallery" className="text-center">
          <div className="text-center">
            <h2 className="major">{t.gallery.title}</h2>
          </div>
          <div className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-4">
            <div
              className="flex transition-transform duration-500"
              style={{ transform: `translateX(-${slide * 100}%)` }}
            >
              {t.gallery.slides.map((s: any, i: number) => (
                <div key={i} className="w-full flex-shrink-0 p-2 text-center">
                  <Image
                    src={s.src}
                    alt={s.caption[lang]}
                    width={900}
                    height={600}
                    className="mx-auto w-full rounded-xl object-cover"
                  />
                  <div className="mt-3 text-[#fcd116]">{s.caption[lang]}</div>
                </div>
              ))}
            </div>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-[#fcd116] hover:bg-black/80"
              aria-label="Previous"
            >
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-[#fcd116] hover:bg-black/80"
              aria-label="Next"
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
          <div className="mt-4 flex justify-center gap-2">
            {t.gallery.slides.map((_: any, i: number) => (
              <button
                key={i}
                onClick={() => setSlide(i)}
                className={`h-2 w-2 rounded-full transition ${
                  i === slide ? "bg-[#fcd116]" : "bg-white/30"
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </section>

        <hr className="my-8 border-white/10" />

        <section id="vision" className="text-center">
          <div className="text-center">
            <h2 className="major">{t.vision.title}</h2>
          </div>
          <p dangerouslySetInnerHTML={{ __html: t.vision.p1 }} />
          <div className="my-6 text-center">
            <Image
              src={t.visionImage}
              alt={t.visionImageAlt}
              width={250}
              height={250}
              className="mx-auto rounded-xl opacity-90"
            />
          </div>
          <p dangerouslySetInnerHTML={{ __html: t.vision.p2 }} />
          <blockquote className="my-6 border-l-4 border-[#078930] bg-[rgba(7,137,48,0.04)] p-4 italic text-[#078930]">
            {t.vision.quote}
          </blockquote>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="/" className="button primary small rasta-green">
              <i className="fa-solid fa-arrow-left"></i> {t.vision.homeCta}
            </a>
            <a href="/legacy/shop.html" className="button primary small rasta-gold">
              <i className="fa-solid fa-cart-shopping"></i> {t.vision.shopCta}
            </a>
          </div>
        </section>

        <hr className="my-8 border-white/10" />

        <section className="text-center">
          <div className="rasta-divider my-6 flex items-center gap-4 text-[#fcd116]">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#fcd116]"></div>
            <span className="text-2xl">🦁</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#fcd116]"></div>
          </div>
          <div className="mb-6 text-center">
            <Image
              src="/legacy/img/logo.jpg"
              alt="ZION Logo"
              width={120}
              height={120}
              className="mx-auto rounded-full opacity-85"
            />
          </div>
          <p className="italic text-[#fcd116]">{t.footer}</p>
          <div className="mt-6 flex justify-center gap-6 text-2xl">
            {data.socials.map((s: any, i: number) => (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noopener"
                className={`${s.color} transition hover:text-white`}
              >
                <i className={`fa-brands ${s.icon}`}></i>
              </a>
            ))}
          </div>
        </section>
      </article>
    </PageLayout>
  );
}
