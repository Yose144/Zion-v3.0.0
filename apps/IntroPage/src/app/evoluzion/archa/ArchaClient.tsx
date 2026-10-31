"use client";

import { useState } from "react";
import Image from "next/image";
import PageLayout from "../../components/PageLayout";
import HeroImage from "../../components/HeroImage";
import LucideIcon from "../../components/LucideIcon";
import data from "../../data/archa-data.json";

export default function ArchaClient() {
  const [lang, setLang] = useState<"cs" | "en">("cs");

  const t = {
    hero: data.hero[lang],
    kofer: data.kofer[lang],
    fleet: data.fleet[lang],
    numbers: data.numbers[lang],
    decks: data.decks[lang],
    systems: data.systems[lang],
    whale: data.whale[lang],
    studies: data.studies[lang],
    status: data.status[lang],
    footer: data.footer[lang],
  };

  return (
    <PageLayout lang={lang} setLang={setLang}>
      <HeroImage
        src="/archa/ship-sunset.jpg"
        alt="Nirvana — archa"
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
        <a href="#kofer" className="button primary small rasta-gold">
          <LucideIcon name="fa-waves" size={16} className="mr-2" /> {t.hero.cta}
        </a>
      </HeroImage>

      <article className="active">
        {/* Kofer — jméno na kýlu */}
        <section id="kofer">
          <div className="text-center">
            <h2 className="major">{t.kofer.title}</h2>
          </div>
          <div className="float-none mx-auto mb-4 max-w-[240px] sm:float-right sm:ml-6 sm:max-w-[220px]">
            <Image
              src="/legacy/img/maria1.jpg"
              alt="Království srdce"
              width={564}
              height={697}
              className="rounded-lg border border-[#fcd116]/30 opacity-90"
            />
          </div>
          <p>{t.kofer.p1}</p>
          <p>{t.kofer.p2}</p>
          <blockquote className="my-6 border-l-4 border-[#fcd116] bg-[rgba(252,209,22,0.04)] p-4 italic text-[#fcd116]">
            {t.kofer.quote}
          </blockquote>
        </section>

        <hr className="my-8 border-white/10" />

        {/* Flotila */}
        <section id="fleet">
          <div className="text-center">
            <h2 className="major">{t.fleet.title}</h2>
          </div>
          <p className="text-center">{t.fleet.intro}</p>
          <figure className="mx-auto mt-6 max-w-3xl">
            <Image
              src="/archa/tres-marias.jpg"
              alt="Tres Marías — tři lodě, tři oceány, jedna cesta"
              width={1024}
              height={768}
              className="rounded-lg border border-white/10"
            />
          </figure>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {t.fleet.items.map((ship: any, i: number) => (
              <div
                key={i}
                className={`rounded-lg border p-4 ${
                  i === 3
                    ? "border-[#fcd116]/50 bg-[rgba(252,209,22,0.06)]"
                    : "border-white/10 bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <LucideIcon
                    name={ship.icon}
                    size={20}
                    className={i === 3 ? "text-[#fcd116]" : "text-white/50"}
                  />
                  <span className="font-semibold text-white">{ship.name}</span>
                </div>
                <p className="mt-1 text-sm text-white/60">{ship.role}</p>
              </div>
            ))}
          </div>
        </section>

        <hr className="my-8 border-white/10" />

        {/* Čísla */}
        <section id="numbers">
          <div className="text-center">
            <h2 className="major">{t.numbers.title}</h2>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {t.numbers.items.map((n: any, i: number) => (
              <div
                key={i}
                className="rounded-lg border border-white/10 bg-white/[0.02] p-5 text-center"
              >
                <div className="text-3xl font-extrabold text-[#fcd116]">
                  {n.value}
                </div>
                <div className="mt-1 text-sm text-white/60">{n.label}</div>
              </div>
            ))}
          </div>
        </section>

        <hr className="my-8 border-white/10" />

        {/* Paluby — průřez trupem */}
        <section id="decks">
          <div className="text-center">
            <h2 className="major">{t.decks.title}</h2>
          </div>
          <div className="mx-auto mt-6 max-w-2xl space-y-2">
            {t.decks.items.map((d: any, i: number) => (
              <div
                key={i}
                className="flex items-start gap-4 rounded-md border border-white/10 bg-gradient-to-r from-[rgba(7,30,60,0.6)] to-[rgba(7,30,60,0.2)] p-4"
                style={{ marginLeft: `${i * 6}%`, marginRight: `${i * 2}%` }}
              >
                <LucideIcon name={d.icon} size={22} className="mt-0.5 shrink-0 text-[#fcd116]" />
                <div>
                  <div className="font-bold text-white">{d.deck}</div>
                  <div className="text-sm text-white/60">{d.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <hr className="my-8 border-white/10" />

        {/* Systémy */}
        <section id="systems">
          <div className="text-center">
            <h2 className="major">{t.systems.title}</h2>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {t.systems.items.map((s: any, i: number) => (
              <div
                key={i}
                className="rounded-lg border border-white/10 bg-white/[0.02] p-5"
              >
                <LucideIcon name={s.icon} size={24} className="text-[#fcd116]" />
                <h3 className="mt-2 font-bold text-white">{s.name}</h3>
                <p className="mt-1 text-sm text-white/60">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <hr className="my-8 border-white/10" />

        {/* Velrybí navigace */}
        <section id="whale">
          <div className="text-center">
            <h2 className="major">{t.whale.title}</h2>
          </div>
          <p>{t.whale.p1}</p>
          <p>{t.whale.p2}</p>
          <figure className="mx-auto mt-5 max-w-2xl">
            <Image
              src="/archa/route-masterplan.png"
              alt="María del Camino — masterplan trasy přes uzly"
              width={1024}
              height={768}
              className="rounded-lg border border-white/10 opacity-95"
            />
          </figure>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {t.whale.seasons.map((s: any, i: number) => (
              <div
                key={i}
                className="rounded-lg border border-[#078930]/30 bg-[rgba(7,137,48,0.05)] p-4 text-center"
              >
                <div className="font-bold uppercase tracking-wide text-[#078930]">
                  {s.when}
                </div>
                <div className="mt-1 text-sm text-white/60">{s.where}</div>
              </div>
            ))}
          </div>
        </section>

        <hr className="my-8 border-white/10" />

        {/* Studie */}
        <section id="studies">
          <div className="text-center">
            <h2 className="major">{t.studies.title}</h2>
          </div>
          <p className="text-center">{t.studies.intro}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {t.studies.items.map((s: any, i: number) => (
              <div
                key={i}
                className="flex gap-4 rounded-lg border border-white/10 bg-white/[0.02] p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#fcd116]/40 font-bold text-[#fcd116]">
                  {s.id}
                </div>
                <div>
                  <div className="font-bold text-white">{s.name}</div>
                  <div className="text-sm text-white/60">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-sm italic text-white/50">
            {t.studies.note}
          </p>
        </section>

        <hr className="my-8 border-white/10" />

        {/* Status */}
        <section id="status" className="text-center">
          <figure className="mx-auto mb-6 max-w-xl">
            <Image
              src="/archa/ship-stars.png"
              alt="Loď pod hvězdami — Nirvana"
              width={1024}
              height={1024}
              className="rounded-lg border border-white/10"
            />
          </figure>
          <span className="rounded-full border border-white/20 bg-white/[0.03] px-4 py-1 text-xs font-semibold uppercase tracking-widest text-white/50">
            {t.status.badge}
          </span>
          <p className="mx-auto mt-4 max-w-xl text-white/70">{t.status.p1}</p>
          <a
            href="https://github.com/Yose144/Zion-v3.0.0/blob/main/ARCHA-NOEMOVA.md"
            target="_blank"
            rel="noopener"
            className="mt-3 inline-block text-sm text-[#fcd116]/70 transition hover:text-[#fcd116]"
          >
            {t.status.link}
          </a>
        </section>

        {/* Footer */}
        <section className="mt-12 text-center">
          <div className="rasta-divider my-6 flex items-center gap-4 text-[#fcd116]">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#fcd116]"></div>
            <LucideIcon name="fa-waves" size={24} />
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#fcd116]"></div>
          </div>
          <p className="italic text-[#fcd116]">{t.footer.quote}</p>
        </section>
      </article>
    </PageLayout>
  );
}
