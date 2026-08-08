"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import PageLayout from "../components/PageLayout";
import HeroImage from "../components/HeroImage";
import LucideIcon from "../components/LucideIcon";
import data from "../data/seeds-data.json";

export default function SeedsIndexPage() {
  const [lang, setLang] = useState<"cs" | "en">("cs");
  const t = data.index[lang];

  return (
    <PageLayout lang={lang} setLang={setLang}>
      <HeroImage
        src="/legacy/img/seeds/emc2.jpg"
        alt="Seeds"
        className="py-20 md:py-28"
      >
        <span className="rounded-full border border-[#078930]/30 bg-black/40 px-4 py-1 text-sm font-semibold text-[#078930] backdrop-blur-sm">
          {t.heroBadge}
        </span>
        <h1 className="text-5xl font-extrabold tracking-tight text-white md:text-6xl">
          {t.heroTitle}
        </h1>
        <p className="max-w-xl text-white/70">{t.heroSubtitle}</p>
        <a href="#strains" className="button primary small rasta-green">
          <LucideIcon name="fa-seedling" size={16} className="mr-2" /> {t.cta}
        </a>
      </HeroImage>

      <article className="active" id="strains">
        <section>
          <div className="text-center">
            <h2 className="major">{t.title}</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.strains.map((strain: any) => (
              <Link
                key={strain.slug}
                href={`/seeds/${strain.slug}/`}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-[#078930]/40"
              >
                <div className="relative h-48 w-full overflow-hidden">
                  <Image
                    src={strain.image}
                    alt={strain.name}
                    fill
                    className="object-cover transition duration-500 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-[#fcd116] backdrop-blur-sm">
                    {strain.badge}
                  </div>
                </div>
                <div className="p-5 text-center">
                  <h3 className="mb-1 text-[#fcd116]">{strain.name}</h3>
                  <p className="!text-sm !text-white/60">{strain.subtitle}</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-white/70">
                    {strain.stats.slice(0, 3).map((s: any, i: number) => (
                      <span
                        key={i}
                        className="rounded-full border border-white/10 bg-white/5 px-2 py-1"
                      >
                        {s.value} {s.label}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <hr className="my-8 border-white/10" />

        <section className="text-center">
          <div className="rasta-divider my-6 flex items-center gap-4 text-[#fcd116]">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#fcd116]"></div>
            <LucideIcon name="fa-leaf" size={24} />
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#fcd116]"></div>
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
                <LucideIcon name={s.icon} size={28} />
              </a>
            ))}
          </div>
        </section>
      </article>
    </PageLayout>
  );
}
