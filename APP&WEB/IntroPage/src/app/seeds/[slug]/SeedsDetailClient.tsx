"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import PageLayout from "../../components/PageLayout";
import HeroImage from "../../components/HeroImage";
import data from "../../data/seeds-data.json";

export default function SeedsDetailClient({ slug }: { slug: string }) {
  const [lang, setLang] = useState<"cs" | "en">("cs");
  const strain = data.strains.find((s: any) => s.slug === slug) || data.strains[0];

  const colors: Record<string, string> = {
    thc: "bg-[#e41e2b]",
    cbd: "bg-[#078930]",
    indica: "bg-[#6549d5]",
    sativa: "bg-[#fcd116]",
  };

  return (
    <PageLayout lang={lang} setLang={setLang}>
      <HeroImage
        src={strain.heroBg}
        alt={strain.name}
        className="pb-16 pt-36 md:pb-20 md:pt-44"
      >
        <span
          className="rounded-full border border-white/10 bg-black/40 px-4 py-1 text-sm font-semibold text-[#fcd116] backdrop-blur-sm"
          style={strain.badgeStyle}
        >
          {strain.badge}
        </span>
        <h1 className="text-5xl font-extrabold tracking-tight text-white md:text-7xl">
          {strain.name}
        </h1>
        <p className="max-w-2xl text-[#aaa] italic">{strain.subtitle}</p>
        <Image
          src={strain.image}
          alt={strain.name}
          width={180}
          height={180}
          priority
          sizes="180px"
          decoding="async"
          className="rounded-full border-4 border-white/10 object-cover shadow-2xl"
        />
      </HeroImage>

      <div className="mx-auto grid w-full max-w-4xl grid-cols-2 gap-3 px-4 py-6 md:grid-cols-4">
        {strain.stats.map((stat: any, i: number) => (
          <div
            key={i}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center backdrop-blur-sm"
          >
            <div className="mb-2 text-2xl text-[#078930]">
              <i className={`fa-solid ${stat.icon}`}></i>
            </div>
            <div className="text-lg font-bold text-white">{stat.value}</div>
            <div className="text-xs text-white/60">{stat.label}</div>
          </div>
        ))}
      </div>

      <article className="active">
        <section>
          <h2 className="major">O tomto strainu</h2>
          <div
            className="rasta-text"
            dangerouslySetInnerHTML={{ __html: strain.description.intro }}
          />
          <div
            className="rasta-text"
            dangerouslySetInnerHTML={{ __html: strain.description.body }}
          />
          {strain.description.note && (
            <div
              className="my-4 rounded-xl border border-[#fcd116]/30 p-4"
              style={{
                background:
                  "linear-gradient(145deg, rgba(252,209,22,0.08), rgba(252,209,22,0.03))",
              }}
            >
              <p className="!m-0 text-[#fcd116]">
                <i
                  className={`fa-solid ${strain.description.note.icon}`}
                  style={{ marginRight: 8 }}
                ></i>
                <strong>{strain.description.note.title}</strong>{" "}
                {strain.description.note.text}
              </p>
            </div>
          )}
        </section>

        <hr className="my-8 border-white/10" />

        <section>
          <h2 className="major">Genetický profil</h2>
          <div className="space-y-4">
            {strain.genetics.map((g: any, i: number) => (
              <div key={i}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-white/80">{g.label}</span>
                  <span className="text-[#fcd116]">{g.value}</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full ${colors[g.key] || "bg-[#078930]"}`}
                    style={{ width: `${g.width}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <hr className="my-8 border-white/10" />

        <section>
          <h2 className="major">Efekty</h2>
          <div className="flex flex-wrap gap-3">
            {strain.effects.positive.map((e: any, i: number) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-full border border-[#078930]/30 bg-[#078930]/10 px-3 py-1 text-sm text-[#078930]"
              >
                <i className={`fa-solid ${e.icon}`}></i>
                <span>{e.label}</span>
              </div>
            ))}
          </div>
          <h3 className="mb-3 mt-6 text-sm text-white/60">
            {strain.effects.negativeTitle}
          </h3>
          <div className="flex flex-wrap gap-3">
            {strain.effects.negative.map((e: any, i: number) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-full border border-[#e41e2b]/30 bg-[#e41e2b]/10 px-3 py-1 text-sm text-[#e41e2b]"
              >
                <i className={`fa-solid ${e.icon}`}></i>
                <span>{e.label}</span>
              </div>
            ))}
          </div>
        </section>

        <hr className="my-8 border-white/10" />

        <section>
          <h2 className="major">Terpenový profil</h2>
          <div className="space-y-3">
            {strain.terpenes.map((t: any, i: number) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
              >
                <span className="w-24 text-sm text-white/80">{t.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#078930] to-[#fcd116]"
                    style={{ width: `${t.width}%` }}
                  />
                </div>
                <span className="w-40 text-right text-xs text-white/60">
                  {t.aroma}
                </span>
              </div>
            ))}
          </div>
        </section>

        <hr className="my-8 border-white/10" />

        <section>
          <h2 className="major">Informace o pěstování</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {strain.growInfo.map((g: any, i: number) => (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center"
              >
                <div className="mb-2 text-2xl text-[#fcd116]">
                  <i className={`fa-solid ${g.icon}`}></i>
                </div>
                <div className="text-xs text-white/60">{g.title}</div>
                <div className="text-lg font-semibold text-white">{g.value}</div>
              </div>
            ))}
          </div>
        </section>

        <hr className="my-8 border-white/10" />

        <section className="text-center">
          <h2 className="major">Genetická linie</h2>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.05] p-5 text-center">
              <div className="text-xs text-white/50">Matka</div>
              <div className="text-lg font-bold text-[#e41e2b]">
                {strain.lineage.mother}
              </div>
              <div className="text-xs text-white/50">
                {strain.lineage.motherDesc}
              </div>
            </div>
            <div className="text-2xl text-white/30">+</div>
            <div className="rounded-xl border border-white/10 bg-white/[0.05] p-5 text-center">
              <div className="text-xs text-white/50">Otec</div>
              <div className="text-lg font-bold text-[#078930]">
                {strain.lineage.father}
              </div>
              <div className="text-xs text-white/50">
                {strain.lineage.fatherDesc}
              </div>
            </div>
            <div className="text-2xl text-white/30">↓</div>
            <div className="rounded-xl border border-[#fcd116]/30 bg-[#fcd116]/10 p-5 text-center">
              <div className="text-xs text-[#fcd116]">Potomek</div>
              <div className="text-lg font-bold text-[#fcd116]">
                {strain.lineage.child}
              </div>
            </div>
          </div>
        </section>

        <hr className="my-8 border-white/10" />

        <section className="text-center">
          <div className="rounded-2xl border border-[#078930]/30 bg-gradient-to-br from-[#078930]/10 to-transparent p-8">
            <h3 className="mb-2 text-2xl text-white">{strain.cta.title}</h3>
            <p className="mb-4 text-white/70">{strain.cta.desc}</p>
            <div className="mb-4 text-3xl font-bold text-[#fcd116]">
              {strain.cta.price}
            </div>
            <a href="/legacy/shop.html" className="button primary small rasta-green">
              <i className="fa-solid fa-cart-plus"></i> {strain.cta.buy}
            </a>
          </div>
        </section>

        <hr className="my-8 border-white/10" />

        <section className="text-center">
          <div className="rasta-divider my-6 flex items-center gap-4 text-[#078930]">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#078930]"></div>
            <span className="text-2xl">🌿</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#078930]"></div>
          </div>
          <p className="italic text-[#078930]">{data.footer[lang]}</p>
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

        <div className="mt-8 flex flex-wrap justify-between gap-4">
          <Link
            href={`/seeds/${strain.nav.prev.slug}/`}
            className="button primary small rasta-gold"
          >
            <i className="fa-solid fa-arrow-left"></i> {strain.nav.prev.label}
          </Link>
          <Link
            href={`/seeds/${strain.nav.next.slug}/`}
            className="button primary small rasta-gold"
          >
            {strain.nav.next.label} <i className="fa-solid fa-arrow-right"></i>
          </Link>
        </div>

        <div className="mt-6 text-center">
          <Link href="/seeds/" className="button primary small rasta-green">
            <i className="fa-solid fa-arrow-left"></i> Zpět na seeds
          </Link>
        </div>
      </article>
    </PageLayout>
  );
}
