"use client";

import { useState } from "react";
import Image from "next/image";
import PageLayout from "../components/PageLayout";
import HeroImage from "../components/HeroImage";
import LucideIcon from "../components/LucideIcon";
import ImageSlider from "../components/ImageSlider";
import data from "../data/evoluzion-data.json";

export default function EvoluzionPage() {
  const [lang, setLang] = useState<"cs" | "en">("cs");

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

  return (
    <PageLayout lang={lang} setLang={setLang}>
      <HeroImage
        src="/legacy/img/org1.jpg"
        alt="EvoluZion"
        className="py-20 md:py-28"
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
      </HeroImage>

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
          <p className="rasta-text flex items-center justify-center gap-2"><LucideIcon name="fa-heart" size={20} /> <LucideIcon name="fa-heart" size={20} /> <LucideIcon name="fa-heart" size={20} /></p>
          <p className="rasta-text">{t.head.desc}</p>
          <div className="my-8 text-center">
            <Image
              src={data.head2008.image}
              alt={data.head2008.imageAlt}
              width={600}
              height={600}
              sizes="(max-width: 768px) 100vw, 50vw"
              decoding="async"
              className="mx-auto rounded-xl border-[3px] border-[#fcd116] opacity-95 !w-full h-auto"
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
                  <LucideIcon name={p.icon} size={24} />
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
          <ImageSlider
            slides={data.gallery.slides.map((s: any) => ({
              src: s.src,
              alt: s.alt,
              caption: s.caption,
            }))}
          />
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
            <a href="/" className="button primary small rasta-green">
              <LucideIcon name="fa-arrow-left" size={16} className="mr-2" /> {t.cta.home}
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
                <LucideIcon name={link.icon} size={32} />
              </a>
            ))}
          </div>
        </section>

        {/* Footer quote */}
        <section className="mt-12 text-center">
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
          <p className="italic text-[#fcd116]">{t.footer.quote}</p>
          <div className="mt-6 flex justify-center gap-6 text-2xl">
            <a href="https://www.facebook.com/ZionTerraNova/" className="text-[#078930]">
              <LucideIcon name="fa-facebook" size={28} />
            </a>
            <a href="https://x.com/ZionTerraNova" className="text-[#fcd116]">
              <LucideIcon name="fa-twitter" size={28} />
            </a>
            <a href="https://www.instagram.com/terranova_project/" className="text-[#e41e2b]">
              <LucideIcon name="fa-instagram" size={28} />
            </a>
          </div>
        </section>
      </article>
    </PageLayout>
  );
}
