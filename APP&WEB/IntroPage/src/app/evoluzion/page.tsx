"use client";

import { useState } from "react";
import Image from "next/image";
import PageLayout from "../components/PageLayout";
import data from "../data/evoluzion-data.json";

export default function EvoluzionPage() {
  const [lang, setLang] = useState<"cs" | "en">("cs");
  const [slide, setSlide] = useState(0);

  const t = {
    hero: data.hero[lang],
    manifest: data.manifest[lang],
    head: data.head2008[lang],
    stats: data.stats[lang],
    pillarsTitle: data.pillarsTitle[lang],
    pillars: data.pillars[lang],
    timelineTitle: data.timelineTitle[lang],
    timeline: data.timeline[lang],
    gallery: { ...data.gallery, ...data.gallery[lang] },
    dropsTitle: data.dropsTitle[lang],
    drops: data.drops[lang],
    music: { ...data.music[lang], spotify: data.music.spotify },
    cta: data.cta[lang],
    connect: { ...data.connect, ...data.connect[lang], links: data.connect.links },
    footer: data.footer[lang],
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
        <span className="rounded-full border border-[#fcd116]/30 bg-black/40 px-4 py-1 text-sm font-semibold text-[#fcd116] backdrop-blur-sm">
          {t.hero.badge}
        </span>
        <h1 className="text-5xl font-extrabold tracking-tight text-white md:text-7xl">
          {t.hero.title}
        </h1>
        <h2 className="max-w-2xl text-xl text-[#fcd116] md:text-2xl">
          {t.hero.subtitle}
        </h2>
        <p className="max-w-xl text-white/70">{t.hero.desc}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
          <a href="/legacy/shop.html" className="button primary small rasta-gold">
            <i className="fa-solid fa-cart-shopping"></i> {t.hero.shopCta}
          </a>
          <a href="/legacy/woodart.html" className="button primary small rasta-green">
            <i className="fa-solid fa-tree"></i> {t.hero.woodartCta}
          </a>
        </div>
      </section>

      <article className="active">
        {/* Manifest */}
        <section id="manifest">
          <div className="text-center">
            <h2 className="major">{t.manifest.title}</h2>
          </div>
          <p>{t.manifest.p1}</p>
          <p>{t.manifest.p2}</p>
          <blockquote className="my-6 border-l-4 border-[#fcd116] bg-[rgba(252,209,22,0.04)] p-4 italic text-[#fcd116]">
            {t.manifest.quote}
          </blockquote>
        </section>

        <hr className="my-8 border-white/10" />

        {/* Original Head */}
        <section id="head" className="text-center">
          <div className="text-center">
            <h2 className="major">{t.head.title}</h2>
          </div>
          <p className="rasta-text">༺꧁🤍꧂༻</p>
          <p className="rasta-text">{t.head.desc}</p>
          <div className="my-8 text-center">
            <Image
              src={data.head2008.image}
              alt={data.head2008.imageAlt}
              width={600}
              height={600}
              className="mx-auto rounded-xl border-[3px] border-[#fcd116] opacity-95"
            />
          </div>
        </section>

        <hr className="my-8 border-white/10" />

        {/* Stats */}
        <section id="stats">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {t.stats.map((s: any, i: number) => (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center"
              >
                <div className="text-3xl font-extrabold text-[#fcd116]">{s.value}</div>
                <div className="text-sm text-white/70">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        <hr className="my-8 border-white/10" />

        {/* Pillars */}
        <section id="pillars">
          <div className="text-center">
            <h2 className="major">{t.pillarsTitle}</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {t.pillars.map((p: any, i: number) => (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-center backdrop-blur-sm transition hover:border-[#fcd116]/40"
              >
                <div className="mb-3 text-2xl text-[#fcd116]">
                  <i className={`fa-solid ${p.icon}`}></i>
                </div>
                <h4 className="mb-2 text-[#fcd116]">{p.title}</h4>
                <p className="!text-sm !text-white/70">{p.desc}</p>
                <span className="mt-3 inline-block rounded-full border border-[#078930]/30 bg-[#078930]/10 px-2 py-1 text-xs text-[#078930]">
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </section>

        <hr className="my-8 border-white/10" />

        {/* Timeline */}
        <section id="timeline">
          <div className="text-center">
            <h2 className="major">{t.timelineTitle}</h2>
          </div>
          <div className="relative border-l-2 border-[#fcd116]/30 pl-6">
            {t.timeline.map((item: any, i: number) => (
              <div key={i} className="relative mb-8">
                <span className="absolute -left-[33px] top-1 h-4 w-4 rounded-full border-2 border-[#fcd116] bg-black"></span>
                <div className="text-lg font-bold text-[#fcd116]">{item.year}</div>
                <div className="font-semibold text-white">{item.title}</div>
                <div className="text-white/70">{item.text}</div>
              </div>
            ))}
          </div>
        </section>

        <hr className="my-8 border-white/10" />

        {/* Gallery */}
        <section id="gallery" className="text-center">
          <div className="text-center">
            <h2 className="major">{t.gallery.title}</h2>
          </div>
          <div className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-4">
            <div
              className="flex transition-transform duration-500"
              style={{ transform: `translateX(-${slide * 100}%)` }}
            >
              {data.gallery.slides.map((s: any, i: number) => (
                <div key={i} className="w-full flex-shrink-0 p-2 text-center">
                  <Image
                    src={s.src}
                    alt={s.alt}
                    width={600}
                    height={600}
                    className={`mx-auto rounded-xl ${s.width} object-cover`}
                  />
                  <div className="mt-3 text-[#fcd116]">{s.caption}</div>
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
            {data.gallery.slides.map((_: any, i: number) => (
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

        {/* Drops */}
        <section id="drops">
          <div className="text-center">
            <h2 className="major">{t.dropsTitle}</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {t.drops.map((d: any, i: number) => (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm transition hover:border-[#fcd116]/40"
              >
                <h4 className="mb-2 text-[#fcd116]">{d.title}</h4>
                <p className="!text-sm !text-white/70">{d.desc}</p>
                <span className="mt-3 inline-block rounded-full border border-[#e41e2b]/30 bg-[#e41e2b]/10 px-2 py-1 text-xs text-[#e41e2b]">
                  {d.tag}
                </span>
              </div>
            ))}
          </div>
        </section>

        <hr className="my-8 border-white/10" />

        {/* Music */}
        <section id="music" className="text-center">
          <div className="text-center">
            <h2 className="major">{t.music.title}</h2>
          </div>
          <p className="rasta-text">{t.music.desc}</p>
          <iframe
            className="mt-6 w-full max-w-2xl rounded-xl border-2 border-[#fcd116]"
            src={data.music.spotify}
            height={352}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          ></iframe>
        </section>

        <hr className="my-8 border-white/10" />

        {/* CTA */}
        <section id="cta" className="text-center">
          <h2 className="major">{t.cta.title}</h2>
          <p className="rasta-text">{t.cta.desc}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-4">
            <a href="/legacy/shop.html" className="button primary small rasta-gold">
              <i className="fa-solid fa-cart-shopping"></i> {t.cta.shop}
            </a>
            <a href="/" className="button primary small rasta-green">
              <i className="fa-solid fa-arrow-left"></i> {t.cta.home}
            </a>
            <a href="/legacy/arts.html" className="button primary small">
              <i className="fa-solid fa-palette"></i> {t.cta.arts}
            </a>
          </div>
        </section>

        <hr className="my-8 border-white/10" />

        {/* Connect */}
        <section id="connect" className="text-center">
          <h2 className="major">{t.connect.title}</h2>
          <p className="rasta-text">{t.connect.desc}</p>
          <div className="mt-6 flex justify-center gap-6 text-3xl">
            {data.connect.links.map((link: any, i: number) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener"
                className="text-[#fcd116] transition hover:text-white"
              >
                <i className={`fa-brands ${link.icon}`}></i>
              </a>
            ))}
          </div>
        </section>

        {/* Footer quote */}
        <section className="mt-12 text-center">
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
          <p className="italic text-[#fcd116]">{t.footer.quote}</p>
          <div className="mt-6 flex justify-center gap-6 text-2xl">
            <a href="https://www.facebook.com/ZionTerraNova/" className="text-[#078930]">
              <i className="fa-brands fa-facebook"></i>
            </a>
            <a href="https://x.com/ZionTerraNova" className="text-[#fcd116]">
              <i className="fa-brands fa-twitter"></i>
            </a>
            <a href="https://www.instagram.com/terranova_project/" className="text-[#e41e2b]">
              <i className="fa-brands fa-instagram"></i>
            </a>
          </div>
        </section>
      </article>
    </PageLayout>
  );
}
