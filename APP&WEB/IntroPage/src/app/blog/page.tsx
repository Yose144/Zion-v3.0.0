"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import PageLayout from "../components/PageLayout";
import HeroImage from "../components/HeroImage";
import LucideIcon from "../components/LucideIcon";
import blogData from "../data/blog-posts.json";

const { posts, categories } = blogData;

const monthNames = {
  cs: ["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

function formatDate(dateStr: string, lang: "cs" | "en") {
  const d = new Date(dateStr);
  return `${d.getDate()}. ${monthNames[lang][d.getMonth()]} ${d.getFullYear()}`;
}

export default function BlogPage() {
  const [lang, setLang] = useState<"cs" | "en">("cs");
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => {
    return filter === "all" ? posts : posts.filter((p) => p.category === filter);
  }, [filter]);

  const years = useMemo(() => {
    const y: Record<number, typeof posts> = {};
    filtered.forEach((p) => {
      const year = new Date(p.date).getFullYear();
      if (!y[year]) y[year] = [];
      y[year].push(p);
    });
    Object.keys(y).forEach((k) => {
      y[Number(k)].sort((a, b) => b.date.localeCompare(a.date));
    });
    return y;
  }, [filtered]);

  const sortedYears = useMemo(
    () => Object.keys(years).map(Number).sort((a, b) => b - a),
    [years]
  );

  const categoryLabel = (key: string) => {
    const cat = categories[key as keyof typeof categories];
    if (!cat) return key;
    return lang === "cs" ? (cat as any).label : (cat as any).labelEn;
  };

  const stats = [
    { num: posts.length, label: lang === "cs" ? "Příspěvků" : "Posts" },
    { num: Object.keys(years).length, label: lang === "cs" ? "Roků" : "Years" },
    { num: posts.filter((p) => p.category === "tech").length, label: categoryLabel("tech") },
    { num: posts.filter((p) => p.category === "journey").length, label: categoryLabel("journey") },
  ];

  const fixImage = (src?: string) => {
    if (!src) return "";
    return src.replace(/^\.\//, "/legacy/");
  };

  return (
    <PageLayout lang={lang} setLang={setLang}>
      <HeroImage
        src="/legacy/img/org1.jpg"
        alt="Blog"
        className="py-20 md:py-24"
      >
        <span className="rounded-full border border-[#fcd116]/30 bg-black/40 px-4 py-1 text-sm font-semibold text-[#fcd116]">
          <LucideIcon name="fa-file-lines" size={14} className="mr-1" /> ®Genesis Blog
        </span>
        <h1 className="text-5xl font-extrabold text-white md:text-6xl">
          {lang === "cs" ? "Kronika" : "Chronicle"}
        </h1>
        <h2 className="text-xl text-[#fcd116] md:text-2xl">
          {lang === "cs" ? "Nové Země" : "New Earth"}
        </h2>
        <p className="max-w-xl text-white/70">
          {lang === "cs"
            ? "Od prvního dne cesty — po probuzení ZION sítě"
            : "From the first day of the journey — to the awakening of the ZION network"}
        </p>
      </HeroImage>

      <article className="active">
        <section className="text-center">
          <div className="flex flex-wrap justify-center gap-6">
            {stats.map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl font-extrabold text-[#fcd116]">{s.num}</div>
                <div className="text-xs uppercase tracking-widest text-white/50">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="text-center">
            <h2 className="major">
              {lang === "cs" ? "Archiv příspěvků" : "Archive posts"}
            </h2>
          </div>
          <p className="text-center text-white/70">
            {lang === "cs"
              ? "Kompletní kronika projektu — od prvního dne cesty v roce 2023 po ZION MAINNET ALPHA 2026."
              : "The complete chronicle of the project — from the first day of the journey in 2023 to ZION MAINNET ALPHA 2026."}
          </p>

          <div className="my-6 flex flex-wrap justify-center gap-2">
            {Object.keys(categories).map((key) => {
              const cat = categories[key as keyof typeof categories] as any;
              const label = lang === "cs" ? cat.label : cat.labelEn;
              const active = filter === key;
              return (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                    active
                      ? "border-[#fcd116] bg-gradient-to-r from-[#078930] to-[#fcd116] text-black"
                      : "border-white/10 bg-white/5 text-white/70 hover:border-[#fcd116]/50"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {sortedYears.length === 0 && (
            <div className="py-12 text-center text-white/40">
              <LucideIcon name="fa-search" size={32} className="mb-2 opacity-30" />
              <p>{lang === "cs" ? "Žádné příspěvky v této kategorii." : "No posts in this category."}</p>
            </div>
          )}

          <div className="relative space-y-10 pl-6 md:pl-10">
            <div
              className="absolute bottom-0 left-3 top-0 w-0.5 rounded md:left-5"
              style={{
                background: "linear-gradient(180deg, #078930, #fcd116 50%, #e41e2b 85%, transparent)",
              }}
            ></div>

            {sortedYears.map((year) => (
              <div key={year}>
                <div className="mb-4 flex items-center gap-3">
                  <span className="rounded-xl bg-gradient-to-r from-[#e41e2b] to-[#fcd116] px-4 py-1 text-lg font-extrabold text-black">
                    {year}
                  </span>
                  <div className="h-0.5 flex-1 bg-gradient-to-r from-[#fcd116] to-transparent"></div>
                  <span className="text-xs text-white/50">
                    {years[year].length} {lang === "cs" ? "příspěvků" : "posts"}
                  </span>
                </div>
                <div className="space-y-4">
                  {years[year].map((post) => {
                    const cat = categories[post.category as keyof typeof categories] as any;
                    const title = lang === "en" ? post.titleEn || post.title : post.title;
                    const excerpt = lang === "en" ? post.excerptEn || post.excerpt : post.excerpt;
                    return (
                      <Link
                        key={post.slug}
                        href={`/blog/${post.slug}`}
                        className="group relative flex gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-[#fcd116]/30 hover:bg-white/[0.04]"
                      >
                        <div
                          className="absolute -left-8 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-black md:-left-12"
                          style={{ backgroundColor: cat?.color || "#fcd116", boxShadow: `0 0 8px ${cat?.color || "#fcd116"}` }}
                        ></div>
                        {post.image ? (
                          <Image
                            src={fixImage(post.image)}
                            alt={title}
                            width={115}
                            height={78}
                            decoding="async"
                            className="hidden h-20 w-28 rounded-lg object-cover opacity-80 group-hover:opacity-100 sm:block"
                          />
                        ) : null}
                        <div className="flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-white/40">{formatDate(post.date, lang)}</span>
                            <span
                              className="rounded-full px-2 py-0.5 font-semibold"
                              style={{ backgroundColor: `${cat?.color}1A`, color: cat?.color }}
                            >
                              {lang === "cs" ? cat?.label : cat?.labelEn}
                            </span>
                          </div>
                          <h3 className="!my-1 flex items-center gap-2 text-lg font-bold text-white group-hover:text-[#fcd116]">
                            <LucideIcon name={post.icon} size={18} /> {title}
                          </h3>
                          <p className="!my-0 !text-sm !text-white/50 line-clamp-2">{excerpt}</p>
                        </div>
                        <LucideIcon name="fa-chevron-right" size={18} className="self-center text-white/20 group-hover:text-[#fcd116]" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-xl border border-[#fcd116]/10 bg-[rgba(252,209,22,0.03)] p-6 text-center text-[#fcd116]">
            <LucideIcon name="fa-om" size={32} className="mb-2" />
            <p>
              {lang === "cs"
                ? "V jednotě je síla. Ve vědomí je pravda. V lásce je vše."
                : "In unity there is strength. In consciousness there is truth. In love there is everything."}
            </p>
          </div>
        </section>
      </article>
    </PageLayout>
  );
}
