"use client";

import { useState } from "react";
import Image from "next/image";
import PageLayout from "../components/PageLayout";
import HeroImage from "../components/HeroImage";
import LucideIcon from "../components/LucideIcon";
import ImageSlider from "../components/ImageSlider";
import data from "../data/camp-data.json";

export default function CampPage() {
  const [lang, setLang] = useState<"cs" | "en">("cs");

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

  return (
    <PageLayout lang={lang} setLang={setLang}>
      <HeroImage
        src="/legacy/img/org1.jpg"
        alt="Camp"
        className="py-20 md:py-28"
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
          <LucideIcon name="fa-tent" size={16} className="mr-2" /> {t.hero.cta}
        </a>
      </HeroImage>

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
                  <LucideIcon name={f.icon} size={24} />
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
          <ImageSlider
            slides={t.gallery.slides.map((s: any) => ({
              src: s.src,
              alt: s.caption[lang],
              caption: s.caption[lang],
            }))}
          />
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
              decoding="async"
              className="mx-auto rounded-xl opacity-90"
            />
          </div>
          <p dangerouslySetInnerHTML={{ __html: t.vision.p2 }} />
          <blockquote className="my-6 border-l-4 border-[#078930] bg-[rgba(7,137,48,0.04)] p-4 italic text-[#078930]">
            {t.vision.quote}
          </blockquote>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="/" className="button primary small rasta-green">
              <LucideIcon name="fa-arrow-left" size={16} className="mr-2" /> {t.vision.homeCta}
            </a>
            <a href="/legacy/shop.html" className="button primary small rasta-gold">
              <LucideIcon name="fa-cart-shopping" size={16} className="mr-2" /> {t.vision.shopCta}
            </a>
          </div>
        </section>

        <hr className="my-8 border-white/10" />

        <section className="text-center">
          <div className="rasta-divider my-6 flex items-center gap-4 text-[#fcd116]">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#fcd116]"></div>
            <LucideIcon name="fa-sparkles" size={24} />
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#fcd116]"></div>
          </div>
          <div className="mb-6 text-center">
            <Image
              src="/legacy/img/logo.jpg"
              alt="ZION Logo"
              width={120}
              height={120}
              decoding="async"
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
                <LucideIcon name={s.icon} size={28} />
              </a>
            ))}
          </div>
        </section>
      </article>
    </PageLayout>
  );
}
