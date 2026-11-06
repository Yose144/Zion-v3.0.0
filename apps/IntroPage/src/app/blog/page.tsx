"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import PageLayout from "../components/PageLayout";
import HeroImage from "../components/HeroImage";
import LucideIcon from "../components/LucideIcon";
import blogData from "../data/blog-posts.json";

const { posts, categories } = blogData;

const monthNames: Record<string, string[]> = {
  cs: ["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  pt: ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"],
  fr: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
};

function formatDate(dateStr: string, lang: string) {
  const names = monthNames[lang] ?? monthNames.en;
  const d = new Date(dateStr);
  return `${d.getDate()}. ${names[d.getMonth()]} ${d.getFullYear()}`;
}

function say(lang: string, row: { cs: string; en: string; es: string; pt: string; fr: string }) {
  if (lang === "cs") return row.cs;
  return row[lang as "en"] ?? row.en;
}

function catLabel(cat: { label: string; labelEn: string; labelEs?: string; labelPt?: string; labelFr?: string }, lang: string) {
  if (lang === "cs") return cat.label;
  if (lang === "es") return cat.labelEs || cat.labelEn;
  if (lang === "pt") return cat.labelPt || cat.labelEn;
  if (lang === "fr") return cat.labelFr || cat.labelEn;
  return cat.labelEn;
}

export default function BlogPage() {
  const [lang, setLang] = useState<"cs" | "en" | "es" | "pt" | "fr">("cs");
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
    return catLabel(cat as any, lang);
  };

  const stats = [
    { num: posts.length, label: say(lang, { cs: "Příspěvků", en: "Posts", es: "Entradas", pt: "Publicações", fr: "Articles" }) },
    { num: Object.keys(years).length, label: say(lang, { cs: "Roků", en: "Years", es: "Años", pt: "Anos", fr: "Années" }) },
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
          {say(lang, { cs: "Kronika", en: "Chronicle", es: "Crónica", pt: "Crónica", fr: "Chronique" })}
        </h1>
        <h2 className="text-xl text-[#fcd116] md:text-2xl">
          {say(lang, { cs: "Nové Země", en: "New Earth", es: "Nueva Tierra", pt: "Nova Terra", fr: "Nouvelle Terre" })}
        </h2>
        <p className="max-w-xl text-white/70">
          {say(lang, {
            cs: "Od prvního dne cesty — po probuzení ZION sítě",
            en: "From the first day of the journey — to the awakening of the ZION network",
            es: "Desde el primer día del camino — hasta el despertar de la red ZION",
            pt: "Desde o primeiro dia da viagem — até ao despertar da rede ZION",
            fr: "Du premier jour du chemin — jusqu’à l’éveil du réseau ZION",
          })}
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
              {say(lang, { cs: "Archiv příspěvků", en: "Archive posts", es: "Archivo de entradas", pt: "Arquivo de publicações", fr: "Archive des articles" })}
            </h2>
          </div>
          <p className="text-center text-white/70">
            {say(lang, {
              cs: "Kompletní kronika projektu — od prvního dne cesty v roce 2023 po ZION MAINNET BETA 2026.",
              en: "The complete chronicle of the project — from the first day of the journey in 2023 to ZION MAINNET BETA 2026.",
              es: "La crónica completa del proyecto — del primer día del camino en 2023 a ZION MAINNET BETA 2026.",
              pt: "A crónica completa do projeto — do primeiro dia da viagem em 2023 ao ZION MAINNET BETA 2026.",
              fr: "La chronique complète du projet — du premier jour du chemin en 2023 à ZION MAINNET BETA 2026.",
            })}
          </p>

          <div className="my-6 flex flex-wrap justify-center gap-2">
            {Object.keys(categories).map((key) => {
              const cat = categories[key as keyof typeof categories] as any;
              const label = catLabel(cat, lang);
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
              <p>{say(lang, { cs: "Žádné příspěvky v této kategorii.", en: "No posts in this category.", es: "No hay entradas en esta categoría.", pt: "Não há publicações nesta categoria.", fr: "Aucun article dans cette catégorie." })}</p>
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
                    {years[year].length} {say(lang, { cs: "příspěvků", en: "posts", es: "entradas", pt: "publicações", fr: "articles" })}
                  </span>
                </div>
                <div className="space-y-4">
                  {years[year].map((post) => {
                    const cat = categories[post.category as keyof typeof categories] as any;
                    const title = lang === "cs" ? post.title : post.titleEn || post.title;
                    const excerpt = lang === "cs" ? post.excerpt : post.excerptEn || post.excerpt;
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
                              {cat ? catLabel(cat, lang) : ""}
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
              {say(lang, {
                cs: "V jednotě je síla. Ve vědomí je pravda. V lásce je vše.",
                en: "In unity there is strength. In consciousness there is truth. In love there is everything.",
                es: "En la unidad está la fuerza. En la conciencia está la verdad. En el amor está todo.",
                pt: "Na unidade está a força. Na consciência está a verdade. No amor está tudo.",
                fr: "Dans l’unité est la force. Dans la conscience est la vérité. Dans l’amour est tout.",
              })}
            </p>
          </div>
        </section>
      </article>
    </PageLayout>
  );
}
